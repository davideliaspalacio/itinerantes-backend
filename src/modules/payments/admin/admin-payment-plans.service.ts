import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import type { AdminUser } from '../../../common/guards/permissions.guard';
import { paginate, type PaginatedResponseDto } from '../../../common/dto/pagination.dto';
import { nowUtc } from '../../../common/utils/time';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { EnrollmentsService } from '../../enrollments/enrollments.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { InstallmentCollectionService } from '../installment-collection.service';
import { PaymentLedgerService } from '../payment-ledger.service';
import type { PaymentMessage } from '../policies/payment-messages.policy';
import { PLAN_STATUS_LABELS } from '../policies/payment-status.policy';
import { ADMIN_PLAN_INCLUDE, type AdminPlanRow, toAdminPlanDto } from './admin-payment-view';
import type { ListAdminPlansQueryDto } from './dto/admin-payments.request.dto';
import type { AdminPaymentPlanDto } from './dto/admin-payments.response.dto';
import {
  accessRestoredMessage,
  accessSuspendedKeyPrefix,
  accessSuspendedMessage,
  canPlanAction,
  type PlanAction,
} from './policies/admin-payments.policy';

/**
 * Planes de cuotas en el panel (HU-33): listado y acciones (reintentar cobro, marcar mora,
 * suspender / restablecer acceso MANUAL, cancelar plan). Reutiliza `InstallmentCollectionService`,
 * `PaymentLedgerService` y `EnrollmentsService`; cada acción queda en la auditoría.
 */
@Injectable()
export class AdminPaymentPlansService {
  private readonly logger = new Logger(AdminPaymentPlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly collection: InstallmentCollectionService,
    private readonly ledger: PaymentLedgerService,
    private readonly enrollments: EnrollmentsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListAdminPlansQueryDto): Promise<PaginatedResponseDto<AdminPaymentPlanDto>> {
    const q = query.q?.trim();
    const contains = q ? { contains: q, mode: 'insensitive' as const } : null;
    const where: Prisma.InstallmentPlanWhereInput = {
      status: query.status?.length ? { in: query.status } : { not: 'PENDING_ACTIVATION' },
      ...(query.offerId ? { offerId: query.offerId } : {}),
      ...(contains
        ? { OR: [{ user: { fullName: contains } }, { user: { email: contains } }] }
        : {}),
    };
    const orderBy: Prisma.InstallmentPlanOrderByWithRelationInput[] =
      query.sort === 'CREATED_DESC'
        ? [{ createdAt: 'desc' }]
        : [{ failedSince: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }];
    const [rows, total] = await Promise.all([
      this.prisma.installmentPlan.findMany({
        where,
        include: ADMIN_PLAN_INCLUDE,
        orderBy: [...orderBy, { id: 'asc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.installmentPlan.count({ where }),
    ]);
    const now = nowUtc();
    return paginate(
      rows.map((row) => toAdminPlanDto(row, now)),
      total,
      query,
    );
  }

  async detail(planId: string): Promise<AdminPaymentPlanDto> {
    return toAdminPlanDto(await this.require(planId), nowUtc());
  }

  /** [Reintentar cobro]: cobra ya las cuotas fallidas con la tarjeta registrada. */
  async retry(planId: string, user: AdminUser): Promise<AdminPaymentPlanDto> {
    const plan = await this.requireAction(planId, 'RETRY');
    try {
      await this.collection.payNow(plan.userId, planId);
    } catch (error) {
      if (error instanceof AppException && error.code === 'PAYMENT_CHARGE_FAILED') {
        await this.record(user, plan, 'plan.retry', 'reintentó el cobro (rechazado)', {
          outcome: 'FAILED',
        });
      }
      throw error;
    }
    const after = await this.require(planId);
    await this.record(user, plan, 'plan.retry', 'reintentó el cobro (pagado)', {
      outcome: 'PAID',
      status: after.status,
    });
    return toAdminPlanDto(after, nowUtc());
  }

  /** Marca "En mora" un plan en Cobro fallido (misma regla que el job). */
  async markDelinquent(planId: string, user: AdminUser): Promise<AdminPaymentPlanDto> {
    const plan = await this.requireAction(planId, 'MARK_DELINQUENT');
    const changed = await this.ledger.markDelinquent(planId, nowUtc());
    if (!changed) throw invalidPlanState(plan);
    const after = await this.require(planId);
    await this.record(user, plan, 'plan.mark-delinquent', 'marcó el plan "En mora"', {
      status: after.status,
      enrollmentStatus: after.enrollment?.status ?? null,
    });
    return toAdminPlanDto(after, nowUtc());
  }

  /**
   * [Suspender acceso] (HU-33: solo "En mora", siempre con confirmación). Deja `accessSuspendedAt`
   * para que al regularizar el pago el acceso se restablezca solo (como la suspensión automática).
   */
  async suspendAccess(
    planId: string,
    user: AdminUser,
    reason: string,
  ): Promise<AdminPaymentPlanDto> {
    const plan = await this.requireAction(planId, 'SUSPEND_ACCESS');
    const now = nowUtc();
    await this.prisma.$transaction(async (tx) => {
      const suspended = await this.enrollments.suspendForDelinquency(
        tx,
        plan.enrollmentId!,
        `Suspensión manual por mora: ${reason}`.slice(0, 500),
        now,
      );
      if (!suspended) throw invalidPlanState(plan);
      await tx.installmentPlan.update({ where: { id: planId }, data: { accessSuspendedAt: now } });
      await this.audit.record(
        {
          actor: user,
          action: 'plan.suspend-access',
          entityType: 'InstallmentPlan',
          entityId: planId,
          summary: `Suspendió el acceso de ${plan.user.fullName} a «${plan.offer.name}» por mora.`,
          before: { enrollmentStatus: 'ACTIVE' },
          after: { enrollmentStatus: 'SUSPENDED', reason },
        },
        tx,
      );
    });
    await this.safeNotify(plan.userId, accessSuspendedMessage({ offerName: plan.offer.name }), {
      data: { planId, offerId: plan.offerId },
      dedupeKey: `${accessSuspendedKeyPrefix(planId)}${now.getTime()}`,
    });
    return this.detail(planId);
  }

  /** [Restablecer acceso]: SUSPENDED → ACTIVE (aunque el plan siga en mora). */
  async restoreAccess(
    planId: string,
    user: AdminUser,
    reason: string,
  ): Promise<AdminPaymentPlanDto> {
    const plan = await this.requireAction(planId, 'RESTORE_ACCESS');
    const now = nowUtc();
    await this.prisma.$transaction(async (tx) => {
      const restored = await this.enrollments.restoreAccess(tx, plan.enrollmentId!);
      if (!restored) throw invalidPlanState(plan);
      await tx.installmentPlan.update({ where: { id: planId }, data: { accessSuspendedAt: null } });
      await this.audit.record(
        {
          actor: user,
          action: 'plan.restore-access',
          entityType: 'InstallmentPlan',
          entityId: planId,
          summary: `Restableció el acceso de ${plan.user.fullName} a «${plan.offer.name}».`,
          before: { enrollmentStatus: 'SUSPENDED' },
          after: { enrollmentStatus: 'ACTIVE', reason },
        },
        tx,
      );
    });
    try {
      await this.notifications.resolve(plan.userId, {
        dedupeKeyPrefix: accessSuspendedKeyPrefix(planId),
      });
    } catch (error) {
      this.logger.error({ err: error, planId }, 'No se pudo desfijar el aviso de suspensión');
    }
    await this.safeNotify(
      plan.userId,
      accessRestoredMessage({ offerId: plan.offerId, offerName: plan.offer.name }),
      {
        data: { planId, offerId: plan.offerId },
        dedupeKey: `plan-access-restored:${planId}:${now.getTime()}`,
      },
    );
    return this.detail(planId);
  }

  /**
   * [Cancelar plan]: plan CANCELLED y sus cuotas programadas/fallidas canceladas (ya no se cobran).
   * No cambia la inscripción (suspender o dar de baja es una acción aparte).
   */
  async cancel(planId: string, user: AdminUser, reason: string): Promise<AdminPaymentPlanDto> {
    const plan = await this.requireAction(planId, 'CANCEL');
    const now = nowUtc();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.installmentPlan.updateMany({
        where: { id: planId, status: plan.status },
        data: { status: 'CANCELLED', cancelledAt: now, cancelReason: reason.slice(0, 500) },
      });
      if (updated.count === 0) throw invalidPlanState(plan);
      const installments = await tx.installment.updateMany({
        where: { planId, status: { in: ['SCHEDULED', 'FAILED'] } },
        data: { status: 'CANCELLED', nextRetryAt: null },
      });
      await this.audit.record(
        {
          actor: user,
          action: 'plan.cancel',
          entityType: 'InstallmentPlan',
          entityId: planId,
          summary: `Canceló el plan de cuotas de ${plan.user.fullName} («${plan.offer.name}»).`,
          before: { status: plan.status },
          after: { status: 'CANCELLED', reason, cancelledInstallments: installments.count },
        },
        tx,
      );
    });
    await this.ledger.resolvePlanAlerts(plan.userId, planId);
    return this.detail(planId);
  }

  // ------------------------------------------------------------------------------------------------

  private async require(planId: string): Promise<AdminPlanRow> {
    const plan = await this.prisma.installmentPlan.findUnique({
      where: { id: planId },
      include: ADMIN_PLAN_INCLUDE,
    });
    if (!plan) throw AppException.notFound('El plan no existe.');
    return plan;
  }

  private async requireAction(planId: string, action: PlanAction): Promise<AdminPlanRow> {
    const plan = await this.require(planId);
    const allowed = canPlanAction(action, {
      status: plan.status,
      hasFailedInstallments: plan.installments.some((i) => i.status === 'FAILED'),
      enrollmentStatus: plan.enrollment?.status ?? null,
    });
    if (!allowed || (action.endsWith('ACCESS') && !plan.enrollmentId)) throw invalidPlanState(plan);
    return plan;
  }

  private async record(
    user: AdminUser,
    plan: AdminPlanRow,
    action: string,
    verb: string,
    after: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.record({
      actor: user,
      action,
      entityType: 'InstallmentPlan',
      entityId: plan.id,
      summary: `${capitalize(verb)} del plan de ${plan.user.fullName} («${plan.offer.name}»).`,
      before: { status: plan.status },
      after,
    });
  }

  private async safeNotify(
    userId: string,
    message: PaymentMessage,
    extra: { data: Record<string, string | null>; dedupeKey: string },
  ): Promise<void> {
    try {
      await this.notifications.notify({ userIds: [userId], ...message, ...extra });
    } catch (error) {
      this.logger.error(
        { err: error, type: message.type },
        'No se pudo notificar la acción del plan',
      );
    }
  }
}

function invalidPlanState(plan: AdminPlanRow): AppException {
  return new AppException('PAYMENT_PLAN_INVALID_STATE', {
    meta: {
      status: plan.status,
      statusLabel: PLAN_STATUS_LABELS[plan.status],
      enrollmentStatus: plan.enrollment?.status ?? null,
    },
  });
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
