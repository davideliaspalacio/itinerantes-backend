import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { nowUtc } from '../../common/utils/time';
import { BUSINESS_RULES } from '../../config/business-rules';
import type { Payment, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  type GatewayCard,
  type GatewayCheckoutSession,
  type GatewayPaymentIntent,
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from '../../infra/stripe/payment-gateway';
import { ApplicationWorkflowService } from '../applications/application-workflow.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { nextRetryAt } from './policies/installment-collection.policy';
import { formatPaymentFolio, paymentConceptLabel } from './policies/payment-amounts.policy';
import {
  installmentFailedMessage,
  installmentPaidMessage,
  type PaymentMessage,
  paymentConfirmedMessage,
  planDelinquentMessage,
} from './policies/payment-messages.policy';
import {
  canTransitionPlan,
  paymentStatusesBefore,
  planStatusAfterInstallmentPaid,
} from './policies/payment-status.policy';

/** Datos de Stripe al confirmar un cobro. */
export interface PaidDetails {
  paymentIntentId?: string | null;
  chargeId?: string | null;
  receiptUrl?: string | null;
  card?: GatewayCard | null;
  /** Tarjeta guardada (1.ª cuota de un plan). */
  paymentMethodId?: string | null;
  customerId?: string | null;
}

export interface FailedDetails {
  paymentIntentId?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
}

/** Claves de notificación de un plan (se regularizan con `notifications.resolve` por prefijo). */
export const planFailedKey = (planId: string, installmentId: string) =>
  `plan-failed:${planId}:${installmentId}`;
export const planFailedPrefix = (planId: string) => `plan-failed:${planId}:`;
export const planDelinquentPrefix = (planId: string) => `plan-delinquent:${planId}:`;

/**
 * Libro de pagos: aplica los resultados de Stripe (webhook, conciliación o job) de forma IDEMPOTENTE
 * y tolerante a eventos fuera de orden (todas las transiciones son updates condicionados al estado
 * previo, ver `payment-status.policy.ts`). Efectos:
 * - Pago completo / saldo / 1.ª cuota → inscripción ACTIVE (`source` PAYMENT/INSTALLMENTS) o
 *   `markEnrolled` si viene de una postulación; notificación PAYMENT_CONFIRMED.
 * - Cuotas: plan Al día / Cobro fallido / Completado, regularización (`notifications.resolve` y
 *   reactivación del acceso suspendido por mora).
 * Las notificaciones se envían después del commit (un fallo de aviso no revierte el pago).
 */
@Injectable()
export class PaymentLedgerService {
  private readonly logger = new Logger(PaymentLedgerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollments: EnrollmentsService,
    private readonly workflow: ApplicationWorkflowService,
    private readonly notifications: NotificationsService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  // --- Checkout (HU-22 / 23 / 24) -----------------------------------------------------------------

  /** `checkout.session.completed` / `async_payment_succeeded` / `expired`, o conciliación. */
  async applyCheckoutSession(session: GatewayCheckoutSession): Promise<void> {
    const payment = await this.findCheckoutPayment(session);
    if (!payment) {
      this.logger.warn({ sessionId: session.id }, 'Sesión de Checkout sin pago asociado');
      return;
    }
    if (session.status === 'complete' && session.paymentStatus === 'paid') {
      const pi = session.paymentIntentId
        ? await this.gateway.retrievePaymentIntent(session.paymentIntentId)
        : null;
      await this.markPaid(payment.id, {
        paymentIntentId: pi?.id ?? session.paymentIntentId,
        chargeId: pi?.chargeId,
        receiptUrl: pi?.receiptUrl,
        card: pi?.card,
        paymentMethodId: pi?.paymentMethodId,
        customerId: pi?.customerId ?? session.customerId,
      });
    } else if (session.status === 'expired') {
      await this.cancelCheckoutPayment(payment.id, 'La sesión de pago venció sin completarse.');
    }
    // complete + unpaid: pago asíncrono en proceso (solo tarjeta: no ocurre) → se espera el evento.
  }

  /** `checkout.session.async_payment_failed`. */
  async failCheckoutPayment(session: GatewayCheckoutSession): Promise<void> {
    const payment = await this.findCheckoutPayment(session);
    if (!payment) return;
    await this.markCardPaymentFailed(payment.id, { failureMessage: 'El pago fue rechazado.' });
    await this.cancelCheckoutPayment(payment.id, 'El pago fue rechazado.');
  }

  /** `payment_intent.succeeded` (cuotas off-session o, fuera de orden, el PI de un checkout). */
  async applyPaymentIntentSucceeded(event: GatewayPaymentIntent): Promise<void> {
    const payment = await this.findIntentPayment(event);
    if (!payment || !['PENDING', 'FAILED', 'CANCELLED'].includes(payment.status)) return;
    // El objeto del evento no trae la tarjeta expandida: se consulta el PaymentIntent completo.
    const pi = event.card ? event : await this.gateway.retrievePaymentIntent(event.id);
    await this.markPaid(payment.id, {
      paymentIntentId: pi.id,
      chargeId: pi.chargeId,
      receiptUrl: pi.receiptUrl,
      card: pi.card,
      paymentMethodId: pi.paymentMethodId,
      customerId: pi.customerId,
    });
  }

  /** `payment_intent.payment_failed`: solo cuotas off-session (en Checkout la persona reintenta). */
  async applyPaymentIntentFailed(pi: GatewayPaymentIntent): Promise<void> {
    if (pi.metadata.kind !== 'installment') return;
    const payment = await this.findIntentPayment(pi);
    // Un intento viejo que llega tarde no pisa el intento vigente.
    if (!payment || (payment.stripePaymentIntentId && payment.stripePaymentIntentId !== pi.id)) {
      return;
    }
    await this.markInstallmentFailed(payment.id, {
      paymentIntentId: pi.id,
      failureCode: pi.failureCode,
      failureMessage: pi.failureMessage,
    });
  }

  /** `charge.refunded` (reembolsos hechos en Stripe; la acción del panel es Fase 06). */
  async applyRefund(charge: {
    paymentIntentId: string | null;
    amountRefundedCents: number;
    refunded: boolean;
  }): Promise<void> {
    if (!charge.paymentIntentId) return;
    const payment = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: charge.paymentIntentId },
    });
    if (!payment) return;
    const now = nowUtc();
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        refundedCents: Math.max(payment.refundedCents, charge.amountRefundedCents),
        ...(charge.refunded && payment.status === 'PAID'
          ? { status: 'REFUNDED' as const, refundedAt: now }
          : {}),
      },
    });
  }

  // --- Núcleo -------------------------------------------------------------------------------------

  /**
   * Marca un pago con tarjeta como PAID (idempotente: si ya estaba pagado no hace nada) y aplica sus
   * efectos. Devuelve true si este llamado lo confirmó.
   */
  async markPaid(paymentId: string, details: PaidDetails): Promise<boolean> {
    const now = nowUtc();
    const outcome = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: paymentId, status: { in: paymentStatusesBefore('PAID') } },
        data: {
          status: 'PAID',
          paidAt: now,
          failureCode: null,
          failureMessage: null,
          ...(details.paymentIntentId ? { stripePaymentIntentId: details.paymentIntentId } : {}),
          ...(details.chargeId ? { stripeChargeId: details.chargeId } : {}),
          ...(details.receiptUrl ? { stripeReceiptUrl: details.receiptUrl } : {}),
          ...(details.card?.last4
            ? { cardBrand: details.card.brand, cardLast4: details.card.last4 }
            : {}),
        },
      });
      if (updated.count === 0) return null;
      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        include: { installment: true, offer: { select: { id: true, name: true } } },
      });

      let regularizedPlanId: string | null = null;
      let restoredAccess = false;
      let installmentCount: number | null = null;
      const firstPayment = !payment.installment || payment.installment.sequence === 1;

      if (payment.installment && payment.planId) {
        await tx.installment.update({
          where: { id: payment.installment.id },
          data: {
            status: 'PAID',
            paidAt: now,
            processingSince: null,
            nextRetryAt: null,
            failureMessage: null,
          },
        });
        const plan = await tx.installmentPlan.findUniqueOrThrow({
          where: { id: payment.planId },
          include: { installments: { select: { status: true } } },
        });
        installmentCount = plan.installmentCount;
        const next = planStatusAfterInstallmentPaid(plan.status, plan.installments);
        const data: Prisma.InstallmentPlanUncheckedUpdateInput = {};
        if (plan.status === 'PENDING_ACTIVATION') {
          Object.assign(data, {
            activatedAt: now,
            stripeCustomerId: details.customerId ?? plan.stripeCustomerId,
            stripePaymentMethodId: details.paymentMethodId ?? plan.stripePaymentMethodId,
            cardBrand: details.card?.brand ?? plan.cardBrand,
            cardLast4: details.card?.last4 ?? plan.cardLast4,
            cardExpMonth: details.card?.expMonth ?? plan.cardExpMonth,
            cardExpYear: details.card?.expYear ?? plan.cardExpYear,
          });
        }
        if (next !== plan.status && canTransitionPlan(plan.status, next)) {
          data.status = next;
          if (next === 'COMPLETED') data.completedAt = now;
          if ((next === 'CURRENT' || next === 'COMPLETED') && plan.failedSince) {
            // Regularizado (HU-24): deja de contar la mora y se restablece el acceso suspendido.
            regularizedPlanId = plan.id;
            data.failedSince = null;
            data.delinquentAt = null;
            if (plan.accessSuspendedAt && plan.enrollmentId) {
              restoredAccess = await this.enrollments.restoreAccess(tx, plan.enrollmentId);
            }
            data.accessSuspendedAt = null;
          }
        }
        if (Object.keys(data).length > 0) {
          await tx.installmentPlan.update({ where: { id: plan.id }, data });
        }
      }

      let enrolled = false;
      if (firstPayment && !payment.applicationId) {
        const { enrollment } = await this.enrollments.activateFromPayment(tx, {
          userId: payment.userId,
          offerId: payment.offerId,
          source: payment.concept === 'INSTALLMENT' ? 'INSTALLMENTS' : 'PAYMENT',
          now,
        });
        enrolled = true;
        await tx.payment.update({
          where: { id: payment.id },
          data: { enrollmentId: enrollment.id },
        });
        if (payment.planId) {
          await tx.installmentPlan.update({
            where: { id: payment.planId },
            data: { enrollmentId: enrollment.id },
          });
        }
      }
      return {
        payment,
        firstPayment,
        enrolled,
        regularizedPlanId,
        restoredAccess,
        installmentCount,
      };
    });
    if (!outcome) return false;

    const { payment } = outcome;
    let enrolled = outcome.enrolled;
    if (outcome.firstPayment && payment.applicationId) {
      enrolled = await this.enrollApplication(payment);
    }
    if (outcome.regularizedPlanId) {
      await this.resolvePlanAlerts(payment.userId, outcome.regularizedPlanId);
    }

    const amount = { amountCents: payment.amountCents, currency: payment.currency };
    const folio = formatPaymentFolio(payment.number);
    const application = payment.applicationId
      ? await this.prisma.application.findUnique({
          where: { id: payment.applicationId },
          select: { kind: true },
        })
      : null;
    const message: PaymentMessage =
      payment.installment && payment.installment.sequence > 1
        ? installmentPaidMessage({
            offerName: payment.offer.name,
            folio,
            sequence: payment.installment.sequence,
            count: outcome.installmentCount ?? payment.installment.sequence,
            amount,
          })
        : paymentConfirmedMessage({
            offerId: payment.offerId,
            offerName: payment.offer.name,
            folio,
            concept: paymentConceptLabel({
              concept: payment.concept,
              applicationKind: application?.kind ?? null,
              installment: payment.installment
                ? {
                    sequence: payment.installment.sequence,
                    count: outcome.installmentCount ?? 1,
                  }
                : null,
            }),
            amount,
            enrolled,
          });
    await this.safeNotify(payment.userId, message, {
      data: { paymentId: payment.id, offerId: payment.offerId, planId: payment.planId },
      dedupeKey: `${message.type === 'INSTALLMENT_PAID' ? 'installment-paid' : 'payment-confirmed'}:${payment.id}`,
    });
    return true;
  }

  /**
   * Cobro de cuota rechazado (off-session): pago FAILED, cuota FAILED con próximo reintento y plan
   * "Cobro fallido" (la mora se cuenta desde el primer fallo). Aviso de prioridad alta, una vez por
   * cuota (fijado hasta regularizar). Idempotente.
   */
  async markInstallmentFailed(paymentId: string, details: FailedDetails): Promise<void> {
    const now = nowUtc();
    const outcome = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: paymentId, status: { in: ['PENDING', 'FAILED'] } },
        data: {
          status: 'FAILED',
          failedAt: now,
          failureCode: details.failureCode ?? null,
          failureMessage: details.failureMessage?.slice(0, 500) ?? null,
          ...(details.paymentIntentId ? { stripePaymentIntentId: details.paymentIntentId } : {}),
        },
      });
      if (updated.count === 0) return null;
      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        include: { installment: true, plan: true, offer: { select: { name: true } } },
      });
      const installment = payment.installment;
      const plan = payment.plan;
      if (!installment || !plan || installment.status === 'PAID') return null;
      const firstFailedAt = installment.failedAt ?? now;
      const retryAt = nextRetryAt(firstFailedAt, Math.max(installment.attempts, 1));
      await tx.installment.update({
        where: { id: installment.id },
        data: {
          status: 'FAILED',
          failedAt: firstFailedAt,
          processingSince: null,
          nextRetryAt: retryAt,
          failureMessage: details.failureMessage?.slice(0, 500) ?? null,
        },
      });
      if (plan.status === 'CURRENT' || plan.status === 'PAST_DUE') {
        await tx.installmentPlan.update({
          where: { id: plan.id },
          data: { status: 'PAST_DUE', failedSince: plan.failedSince ?? now },
        });
      }
      return { payment, installment, plan, retryAt };
    });
    if (!outcome) return;
    const user = await this.prisma.user.findUnique({
      where: { id: outcome.payment.userId },
      select: { timezone: true },
    });
    await this.safeNotify(
      outcome.payment.userId,
      installmentFailedMessage({
        offerName: outcome.payment.offer.name,
        sequence: outcome.installment.sequence,
        count: outcome.plan.installmentCount,
        amount: {
          amountCents: outcome.payment.amountCents,
          currency: outcome.payment.currency,
        },
        nextRetryAt: outcome.retryAt,
        failureMessage: details.failureMessage ?? null,
        timezone: user?.timezone ?? BUSINESS_RULES.OFFICIAL_TIMEZONE,
      }),
      {
        data: { paymentId: outcome.payment.id, planId: outcome.plan.id },
        dedupeKey: planFailedKey(outcome.plan.id, outcome.installment.id),
      },
    );
  }

  /** Pago con tarjeta de un checkout rechazado (asíncrono). */
  private async markCardPaymentFailed(paymentId: string, details: FailedDetails): Promise<void> {
    await this.prisma.payment.updateMany({
      where: { id: paymentId, status: 'PENDING' },
      data: {
        status: 'FAILED',
        failedAt: nowUtc(),
        failureMessage: details.failureMessage ?? null,
      },
    });
  }

  /**
   * Checkout cancelado o vencido: pago CANCELLED (si seguía pendiente), plan sin activar CANCELLED y
   * se libera la reserva de cupo. Idempotente. Devuelve true si lo canceló.
   */
  async cancelCheckoutPayment(paymentId: string, reason: string): Promise<boolean> {
    const now = nowUtc();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: paymentId, status: { in: ['PENDING', 'FAILED'] } },
        data: { status: 'CANCELLED', cancelledAt: now },
      });
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      if (updated.count === 0 && payment.status !== 'CANCELLED') return false;
      if (payment.planId) {
        const plan = await tx.installmentPlan.updateMany({
          where: { id: payment.planId, status: 'PENDING_ACTIVATION' },
          data: { status: 'CANCELLED', cancelledAt: now, cancelReason: reason },
        });
        if (plan.count > 0) {
          await tx.installment.updateMany({
            where: { planId: payment.planId, status: { not: 'PAID' } },
            data: { status: 'CANCELLED' },
          });
        }
      }
      if (!payment.applicationId) {
        // Solo si no hay otro checkout abierto de la misma oferta.
        const open = await tx.payment.count({
          where: {
            userId: payment.userId,
            offerId: payment.offerId,
            status: 'PENDING',
            id: { not: payment.id },
            stripeCheckoutSessionId: { not: null },
          },
        });
        if (open === 0) {
          await this.enrollments.releaseCheckoutHold(tx, {
            userId: payment.userId,
            offerId: payment.offerId,
            reason,
            now,
          });
        }
      }
      return updated.count > 0;
    });
  }

  /**
   * Plan "En mora" (HU-24): a los DELINQUENCY_AFTER_DAYS del primer cobro fallido. Si
   * SUSPEND_ACCESS_ON_DELINQUENCY, suspende el acceso (se restablece al regularizar). Idempotente.
   */
  async markDelinquent(planId: string, threshold: Date): Promise<boolean> {
    const now = nowUtc();
    const outcome = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.installmentPlan.updateMany({
        where: { id: planId, status: 'PAST_DUE', failedSince: { lte: threshold } },
        data: { status: 'DELINQUENT', delinquentAt: now },
      });
      if (updated.count === 0) return null;
      const plan = await tx.installmentPlan.findUniqueOrThrow({
        where: { id: planId },
        include: {
          offer: { select: { name: true } },
          installments: { where: { status: { in: ['FAILED', 'PROCESSING'] } } },
        },
      });
      let suspended = false;
      if (BUSINESS_RULES.SUSPEND_ACCESS_ON_DELINQUENCY && plan.enrollmentId) {
        suspended = await this.enrollments.suspendForDelinquency(
          tx,
          plan.enrollmentId,
          'Plan de pagos en mora (suspensión automática).',
          now,
        );
        if (suspended) {
          await tx.installmentPlan.update({
            where: { id: planId },
            data: { accessSuspendedAt: now },
          });
        }
      }
      return { plan, suspended };
    });
    if (!outcome) return false;
    const pending = outcome.plan.installments.reduce((sum, i) => sum + i.amountCents, 0);
    await this.safeNotify(
      outcome.plan.userId,
      planDelinquentMessage({
        offerName: outcome.plan.offer.name,
        pending: { amountCents: pending, currency: outcome.plan.currency },
        accessSuspended: outcome.suspended,
      }),
      {
        data: { planId, offerId: outcome.plan.offerId },
        dedupeKey: `${planDelinquentPrefix(planId)}${outcome.plan.failedSince?.getTime() ?? 0}`,
      },
    );
    return true;
  }

  async resolvePlanAlerts(userId: string, planId: string): Promise<void> {
    try {
      await this.notifications.resolve(userId, { dedupeKeyPrefix: planFailedPrefix(planId) });
      await this.notifications.resolve(userId, { dedupeKeyPrefix: planDelinquentPrefix(planId) });
    } catch (error) {
      this.logger.error({ err: error, planId }, 'No se pudieron regularizar los avisos del plan');
    }
  }

  // ------------------------------------------------------------------------------------------------

  /** Pago del saldo de una postulación: Inscrita + inscripción ACTIVE (`markEnrolled`). */
  private async enrollApplication(payment: Payment): Promise<boolean> {
    const applicationId = payment.applicationId!;
    try {
      await this.workflow.markEnrolled(applicationId);
    } catch (error) {
      if (!(error instanceof AppException && error.code === 'APPLICATION_INVALID_TRANSITION')) {
        throw error;
      }
      // Ya estaba Inscrita (evento repetido) u otro estado: el pago queda registrado para el equipo.
      this.logger.warn(
        { err: error, applicationId },
        'Pago de saldo sin transición de postulación',
      );
    }
    const enrollment = await this.prisma.enrollment.findUnique({ where: { applicationId } });
    if (enrollment) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { enrollmentId: enrollment.id },
      });
      if (payment.planId) {
        await this.prisma.installmentPlan.update({
          where: { id: payment.planId },
          data: { enrollmentId: enrollment.id },
        });
      }
    }
    return enrollment?.status === 'ACTIVE';
  }

  private async findCheckoutPayment(session: GatewayCheckoutSession): Promise<Payment | null> {
    const byId = session.metadata.paymentId
      ? await this.prisma.payment.findUnique({ where: { id: session.metadata.paymentId } })
      : null;
    return (
      byId ??
      (await this.prisma.payment.findUnique({ where: { stripeCheckoutSessionId: session.id } }))
    );
  }

  private async findIntentPayment(pi: GatewayPaymentIntent): Promise<Payment | null> {
    const id = pi.metadata.paymentId;
    if (id && /^[0-9a-f-]{36}$/i.test(id)) {
      const payment = await this.prisma.payment.findUnique({ where: { id } });
      if (payment) return payment;
    }
    return this.prisma.payment.findUnique({ where: { stripePaymentIntentId: pi.id } });
  }

  private async safeNotify(
    userId: string,
    message: PaymentMessage,
    extra: { data: Record<string, string | null>; dedupeKey: string },
  ): Promise<void> {
    try {
      await this.notifications.notify({ userIds: [userId], ...message, ...extra });
    } catch (error) {
      this.logger.error({ err: error, type: message.type }, 'No se pudo notificar el pago');
    }
  }
}
