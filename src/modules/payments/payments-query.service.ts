import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { paginate, type PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { formatMoney } from '../../common/utils/money';
import { formatInZone, nowUtc, OFFICIAL_TIMEZONE } from '../../common/utils/time';
import { BUSINESS_RULES } from '../../config/business-rules';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CheckoutService } from './checkout.service';
import type { ListPaymentsQueryDto } from './dto/payments.request.dto';
import type {
  DashboardPaymentsDto,
  PaymentAlertDto,
  PaymentDto,
  PaymentPlanDto,
  PaymentsSummaryDto,
} from './dto/payments.response.dto';
import {
  PAYMENT_INCLUDE,
  PLAN_INCLUDE,
  type PlanRow,
  toOfferRef,
  toPaymentDto,
  toPlanDto,
} from './payment-view';
import { isUpcomingNoticeDue } from './policies/installment-collection.policy';
import { formatPaymentFolio } from './policies/payment-amounts.policy';
import {
  ACTIVE_PLAN_STATUSES,
  HISTORY_STATUSES,
  hasReceipt,
  paymentMethodLabel,
  paymentStatusLabel,
} from './policies/payment-status.policy';
import { renderSimplePdf } from '../../common/utils/simple-pdf';

/**
 * "Mis pagos" (HU-26 / pestaña de HU-14), consulta de un pago al volver de Stripe (HU-22
 * "Procesando pago…"), recibo PDF y bloque del Dashboard (HU-06 / HU-24). Solo pagos propios:
 * un pago o plan ajeno responde 404.
 */
@Injectable()
export class PaymentsQueryService {
  private readonly logger = new Logger(PaymentsQueryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly checkout: CheckoutService,
  ) {}

  async list(
    userId: string,
    query: ListPaymentsQueryDto,
  ): Promise<PaginatedResponseDto<PaymentDto>> {
    const where = {
      userId,
      status: query.status ? query.status : { in: [...HISTORY_STATUSES] },
    };
    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: PAYMENT_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { number: 'desc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.payment.count({ where }),
    ]);
    const now = nowUtc();
    return paginate(
      rows.map((r) => toPaymentDto(r, now)),
      total,
      query,
    );
  }

  /**
   * Detalle de un pago. Si es un checkout aún PENDING y el webhook no ha llegado tras unos segundos,
   * concilia con Stripe antes de responder (HU-22: "Procesando pago…" → confirmado).
   */
  async get(userId: string, paymentId: string): Promise<PaymentDto> {
    let row = await this.requireOwn(userId, paymentId);
    const now = nowUtc();
    if (
      row.status === 'PENDING' &&
      row.stripeCheckoutSessionId &&
      now.getTime() - row.updatedAt.getTime() >=
        BUSINESS_RULES.CHECKOUT_RECONCILE_AFTER_SECONDS * 1000
    ) {
      try {
        await this.checkout.reconcile(row.id);
        row = await this.requireOwn(userId, paymentId);
      } catch (error) {
        this.logger.warn({ err: error, paymentId }, 'No se pudo conciliar el checkout');
      }
    }
    return toPaymentDto(row, nowUtc());
  }

  async plans(userId: string): Promise<PaymentPlanDto[]> {
    const rows = await this.prisma.installmentPlan.findMany({
      where: { userId, status: { not: 'PENDING_ACTIVATION' } },
      include: PLAN_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    const now = nowUtc();
    const active = (p: PlanRow) => (ACTIVE_PLAN_STATUSES.includes(p.status) ? 0 : 1);
    return rows.sort((a, b) => active(a) - active(b)).map((p) => toPlanDto(p, now));
  }

  async plan(userId: string, planId: string): Promise<PaymentPlanDto> {
    const row = await this.prisma.installmentPlan.findFirst({
      where: { id: planId, userId },
      include: PLAN_INCLUDE,
    });
    if (!row) throw AppException.notFound('El plan no existe.');
    return toPlanDto(row, nowUtc());
  }

  async summary(userId: string): Promise<PaymentsSummaryDto> {
    const now = nowUtc();
    const [plans, paymentsCount, moodleCount, alerts] = await Promise.all([
      this.prisma.installmentPlan.findMany({
        where: { userId, status: { in: [...ACTIVE_PLAN_STATUSES] } },
        include: PLAN_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where: { userId, status: { in: [...HISTORY_STATUSES] } } }),
      this.prisma.enrollment.count({ where: { userId, origin: 'MOODLE' } }),
      this.alerts(userId, now),
    ]);
    return {
      activePlans: plans.map((p) => toPlanDto(p, now)),
      alerts: alerts.attention,
      hasPayments: paymentsCount > 0,
      moodleOnly: paymentsCount === 0 && moodleCount > 0,
    };
  }

  /** Bloque del Dashboard: aviso de cuota próxima (7 días) y banners de atención. */
  async dashboard(userId: string): Promise<DashboardPaymentsDto> {
    const { attention, upcoming } = await this.alerts(userId, nowUtc());
    return { upcomingInstallments: upcoming, alerts: attention };
  }

  /** Recibo PDF (HU-26): folio, fecha, concepto, monto, moneda y método. No es factura fiscal. */
  async receipt(userId: string, paymentId: string): Promise<{ fileName: string; pdf: Buffer }> {
    const row = await this.requireOwn(userId, paymentId);
    if (!hasReceipt(row.status)) throw new AppException('PAYMENT_RECEIPT_NOT_AVAILABLE');
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { fullName: true, email: true },
    });
    const dto = toPaymentDto(row, nowUtc());
    const folio = formatPaymentFolio(row.number);
    const paidAt = row.paidAt ?? row.reviewedAt ?? row.createdAt;
    const pairs: Array<[string, string]> = [
      ['Folio', folio],
      [
        'Fecha de pago',
        `${formatInZone(paidAt, OFFICIAL_TIMEZONE, 'd/MM/yyyy HH:mm')} (hora CDMX)`,
      ],
      ['Participante', `${user.fullName} (${user.email})`],
      [
        'Formación',
        `${row.offer.name}${row.offer.cohortLabel ? ` — ${row.offer.cohortLabel}` : ''}`,
      ],
      ['Concepto', dto.conceptLabel],
      ['Monto', formatMoney({ amountCents: row.amountCents, currency: row.currency })],
      ['Moneda', row.currency],
      [
        'Método',
        row.method === 'CARD' && row.cardLast4
          ? `${paymentMethodLabel(row.method)} ${row.cardBrand?.toUpperCase() ?? ''} •••• ${row.cardLast4}`.replace(
              /\s+/g,
              ' ',
            )
          : paymentMethodLabel(row.method),
      ],
      ['Estado', paymentStatusLabel(row.status, row.method)],
    ];
    if (row.method === 'BANK_TRANSFER' && row.transferReference) {
      pairs.push(['Referencia', row.transferReference]);
    }
    if (row.stripePaymentIntentId) pairs.push(['ID de Stripe', row.stripePaymentIntentId]);
    const pdf = renderSimplePdf({
      title: `Recibo de pago ${folio}`,
      lines: [
        { text: 'Escuela Itinerante del Agua', size: 18, bold: true },
        { text: 'Recibo de pago', size: 13, color: 'muted' },
        { rule: true, spaceBefore: 6 },
        { pairs, size: 11 },
        { rule: true, spaceBefore: 12 },
        {
          text: 'Este documento es un recibo de pago, no una factura fiscal (CFDI).',
          size: 9,
          color: 'muted',
          spaceBefore: 4,
        },
        {
          text: `Emitido el ${formatInZone(nowUtc(), OFFICIAL_TIMEZONE, 'd/MM/yyyy HH:mm')} (hora CDMX).`,
          size: 9,
          color: 'muted',
        },
      ],
    });
    return { fileName: `recibo-${folio}.pdf`, pdf };
  }

  // ------------------------------------------------------------------------------------------------

  private async requireOwn(userId: string, paymentId: string) {
    const row = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId },
      include: PAYMENT_INCLUDE,
    });
    if (!row) throw AppException.notFound('El pago no existe.');
    return row;
  }

  private async alerts(
    userId: string,
    now: Date,
  ): Promise<{ attention: PaymentAlertDto[]; upcoming: PaymentAlertDto[] }> {
    const [plans, transfers] = await Promise.all([
      this.prisma.installmentPlan.findMany({
        where: { userId, status: { in: [...ACTIVE_PLAN_STATUSES] } },
        include: PLAN_INCLUDE,
      }),
      this.prisma.payment.findMany({
        where: {
          userId,
          method: 'BANK_TRANSFER',
          status: { in: ['PENDING_VALIDATION', 'REJECTED'] },
          application: { status: 'APPROVED_PENDING_PAYMENT' },
        },
        include: {
          ...PAYMENT_INCLUDE,
          application: { select: { kind: true, responseDueAt: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const attention: PaymentAlertDto[] = [];
    const upcoming: PaymentAlertDto[] = [];
    for (const plan of plans) {
      const currency = plan.currency;
      const card = plan.cardLast4 ? { brand: plan.cardBrand, last4: plan.cardLast4 } : null;
      const failed = plan.installments.filter((i) => i.status === 'FAILED');
      if (plan.status === 'PAST_DUE' || plan.status === 'DELINQUENT') {
        attention.push({
          type: plan.status === 'DELINQUENT' ? 'PLAN_DELINQUENT' : 'INSTALLMENT_FAILED',
          offer: toOfferRef(plan.offer),
          amount: { amountCents: failed.reduce((s, i) => s + i.amountCents, 0), currency },
          date: plan.failedSince?.toISOString() ?? null,
          planId: plan.id,
          paymentId: null,
          applicationId: plan.applicationId,
          card,
        });
      }
      const next = plan.installments.find((i) => i.status === 'SCHEDULED' && i.sequence > 1);
      if (next && isUpcomingNoticeDue(next.dueAt, now)) {
        upcoming.push({
          type: 'INSTALLMENT_UPCOMING',
          offer: toOfferRef(plan.offer),
          amount: { amountCents: next.amountCents, currency },
          date: next.dueAt.toISOString(),
          planId: plan.id,
          paymentId: null,
          applicationId: plan.applicationId,
          card,
        });
      }
    }
    // Una por postulación: la transferencia más reciente.
    const seen = new Set<string>();
    for (const t of transfers) {
      if (!t.applicationId || seen.has(t.applicationId)) continue;
      seen.add(t.applicationId);
      attention.push({
        type: t.status === 'REJECTED' ? 'TRANSFER_REJECTED' : 'TRANSFER_PENDING',
        offer: toOfferRef(t.offer),
        amount: { amountCents: t.amountCents, currency: t.currency },
        date: t.application?.responseDueAt?.toISOString() ?? null,
        planId: null,
        paymentId: t.id,
        applicationId: t.applicationId,
        card: null,
      });
    }
    return { attention, upcoming };
  }
}
