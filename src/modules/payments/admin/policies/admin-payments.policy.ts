import type { Money } from '../../../../common/utils/money';
import type {
  Currency,
  InstallmentPlanStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
} from '../../../../generated/prisma/client';
import type { PaymentMessage } from '../../policies/payment-messages.policy';
import { PORTAL_LINKS } from '../../../notifications/portal-links';
import { canTransitionPlan } from '../../policies/payment-status.policy';

/**
 * Reglas PURAS del panel de pagos (HU-33): reembolsos, acciones sobre planes de cuotas y resumen por
 * moneda (MXN y USD nunca se suman).
 */

// -------------------------------------------------------------------------------------------------
// Reembolsos
// -------------------------------------------------------------------------------------------------

/** Pagos que admiten reembolso: tarjeta pagada o transferencia validada (aunque ya tengan parciales). */
export function isRefundableStatus(status: PaymentStatus): boolean {
  return status === 'PAID' || status === 'VALIDATED';
}

/**
 * Monto que aún se puede reembolsar: cobrado − reembolsado − reembolsos en proceso. `refundedCents`
 * (columna del pago) cubre también reembolsos hechos directamente en el dashboard de Stripe.
 */
export function refundableCents(input: {
  amountCents: number;
  refundedCents?: number;
  refunds: ReadonlyArray<{ amountCents: number; status: RefundStatus }>;
}): number {
  const sum = (status: RefundStatus) =>
    input.refunds.filter((r) => r.status === status).reduce((acc, r) => acc + r.amountCents, 0);
  const refunded = Math.max(input.refundedCents ?? 0, sum('SUCCEEDED'));
  return Math.max(input.amountCents - refunded - sum('PENDING'), 0);
}

export type RefundDecision =
  | { ok: true; via: 'GATEWAY' | 'MANUAL_RECORD' }
  | {
      ok: false;
      code: 'PAYMENT_INVALID_STATE' | 'PAYMENT_REFUND_INVALID';
      refundableCents: number;
    };

/**
 * ¿Se puede reembolsar `requestedCents`? Tarjeta → vía Stripe (`GATEWAY`, requiere el
 * PaymentIntent); transferencia → se REGISTRA el reembolso hecho fuera (`MANUAL_RECORD`). Anexo A
 * HU-33: sin política de plazos (solo monto ≤ pagado).
 */
export function decideRefund(input: {
  status: PaymentStatus;
  method: PaymentMethod;
  stripePaymentIntentId: string | null;
  amountCents: number;
  refundedCents?: number;
  refunds: ReadonlyArray<{ amountCents: number; status: RefundStatus }>;
  requestedCents: number;
}): RefundDecision {
  const available = refundableCents(input);
  if (
    !isRefundableStatus(input.status) ||
    (input.method === 'CARD' && !input.stripePaymentIntentId)
  ) {
    return { ok: false, code: 'PAYMENT_INVALID_STATE', refundableCents: available };
  }
  if (
    !Number.isInteger(input.requestedCents) ||
    input.requestedCents <= 0 ||
    input.requestedCents > available
  ) {
    return { ok: false, code: 'PAYMENT_REFUND_INVALID', refundableCents: available };
  }
  return { ok: true, via: input.method === 'CARD' ? 'GATEWAY' : 'MANUAL_RECORD' };
}

/** Estado del registro de reembolso según la respuesta de Stripe. */
export function refundStatusFromGateway(status: 'pending' | 'succeeded' | 'failed'): RefundStatus {
  return status === 'succeeded' ? 'SUCCEEDED' : status === 'failed' ? 'FAILED' : 'PENDING';
}

/** `refundedCents` del pago = suma de reembolsos confirmados; total → "Reembolsado". */
export function paymentRefundTotals(input: {
  amountCents: number;
  refunds: ReadonlyArray<{ amountCents: number; status: RefundStatus }>;
}): { refundedCents: number; fullyRefunded: boolean } {
  const refundedCents = input.refunds
    .filter((r) => r.status === 'SUCCEEDED')
    .reduce((sum, r) => sum + r.amountCents, 0);
  return { refundedCents, fullyRefunded: refundedCents >= input.amountCents };
}

/**
 * Webhook `charge.refunded` (Stripe informa el TOTAL reembolsado del cargo): marca como confirmados
 * los reembolsos en proceso, del más antiguo al más reciente, mientras quepan en ese total.
 * Idempotente: con el mismo total devuelve los mismos ids.
 */
export function pendingRefundsCovered(input: {
  amountRefundedCents: number;
  refunds: ReadonlyArray<{
    id: string;
    amountCents: number;
    status: RefundStatus;
    createdAt: Date;
  }>;
}): string[] {
  let covered = input.refunds
    .filter((r) => r.status === 'SUCCEEDED')
    .reduce((sum, r) => sum + r.amountCents, 0);
  const ids: string[] = [];
  const pending = input.refunds
    .filter((r) => r.status === 'PENDING')
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const refund of pending) {
    if (covered + refund.amountCents > input.amountRefundedCents) break;
    covered += refund.amountCents;
    ids.push(refund.id);
  }
  return ids;
}

// -------------------------------------------------------------------------------------------------
// Acciones sobre un plan de cuotas (HU-33)
// -------------------------------------------------------------------------------------------------

export const PlanAction = {
  /** [Reintentar cobro]: en Cobro fallido / En mora con cuotas fallidas. */
  RETRY: 'RETRY',
  /** Marcar "En mora" manualmente (solo Cobro fallido). */
  MARK_DELINQUENT: 'MARK_DELINQUENT',
  /** [Suspender acceso]: solo En mora y con la inscripción activa ("suspensión siempre manual"). */
  SUSPEND_ACCESS: 'SUSPEND_ACCESS',
  /** [Restablecer acceso]: inscripción suspendida. */
  RESTORE_ACCESS: 'RESTORE_ACCESS',
  /** [Cancelar plan]: cualquier plan no terminado. */
  CANCEL: 'CANCEL',
} as const;
export type PlanAction = (typeof PlanAction)[keyof typeof PlanAction];

export interface PlanActionInput {
  status: InstallmentPlanStatus;
  hasFailedInstallments: boolean;
  enrollmentStatus: string | null;
}

export function canPlanAction(action: PlanAction, plan: PlanActionInput): boolean {
  switch (action) {
    case PlanAction.RETRY:
      return (
        (plan.status === 'PAST_DUE' || plan.status === 'DELINQUENT') && plan.hasFailedInstallments
      );
    case PlanAction.MARK_DELINQUENT:
      return plan.status === 'PAST_DUE';
    case PlanAction.SUSPEND_ACCESS:
      return plan.status === 'DELINQUENT' && plan.enrollmentStatus === 'ACTIVE';
    case PlanAction.RESTORE_ACCESS:
      return plan.enrollmentStatus === 'SUSPENDED';
    case PlanAction.CANCEL:
      return canTransitionPlan(plan.status, 'CANCELLED');
  }
}

/** Acciones habilitadas (el frontend muestra/oculta botones; las de escritura requieren payments.manage). */
export function availablePlanActions(plan: PlanActionInput): PlanAction[] {
  return (Object.values(PlanAction) as PlanAction[]).filter((a) => canPlanAction(a, plan));
}

// -------------------------------------------------------------------------------------------------
// Resumen por moneda
// -------------------------------------------------------------------------------------------------

export interface CurrencyTotals {
  currency: Currency;
  /** Cobrado (pagos con tarjeta pagados + transferencias validadas, incluidos los luego reembolsados). */
  collected: Money;
  refunded: Money;
  /** Cobrado − reembolsado. */
  net: Money;
  paymentCount: number;
}

/** Totales por moneda (siempre MXN y USD, en ese orden; nunca se suman entre sí). */
export function totalsByCurrency(
  rows: ReadonlyArray<{ currency: Currency; amountCents: number; refundedCents: number }>,
): CurrencyTotals[] {
  return (['MXN', 'USD'] as const).map((currency) => {
    const mine = rows.filter((r) => r.currency === currency);
    const collected = mine.reduce((sum, r) => sum + r.amountCents, 0);
    const refunded = mine.reduce((sum, r) => sum + r.refundedCents, 0);
    return {
      currency,
      collected: { amountCents: collected, currency },
      refunded: { amountCents: refunded, currency },
      net: { amountCents: collected - refunded, currency },
      paymentCount: mine.length,
    };
  });
}

// -------------------------------------------------------------------------------------------------
// Avisos de suspensión manual (HU-13 / HU-33)
// -------------------------------------------------------------------------------------------------

/** Prefijo de la clave del aviso de suspensión (dentro de `plan-delinquent:` para que se desfije al regularizar). */
export const accessSuspendedKeyPrefix = (planId: string) => `plan-delinquent:${planId}:suspended:`;

export function accessSuspendedMessage(input: { offerName: string }): PaymentMessage {
  return {
    type: 'PLAN_DELINQUENT',
    title: `Tu acceso fue suspendido: ${input.offerName}`,
    body:
      `El equipo de la Escuela suspendió tu acceso a ${input.offerName} porque tu plan de pagos ` +
      'está en mora. Regulariza tu pago para recuperarlo de inmediato.',
    action: { label: 'Pagar ahora', path: PORTAL_LINKS.myPayments() },
  };
}

export function accessRestoredMessage(input: {
  offerId: string;
  offerName: string;
}): PaymentMessage {
  return {
    type: 'GENERAL',
    title: `Tu acceso fue restablecido: ${input.offerName}`,
    body: `Ya puedes entrar de nuevo a ${input.offerName} desde tu aula.`,
    action: { label: 'Ir a mi aula', path: PORTAL_LINKS.classroom(input.offerId) },
  };
}
