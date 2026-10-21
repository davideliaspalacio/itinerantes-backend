import type {
  InstallmentPlanStatus,
  InstallmentStatus,
  PaymentMethod,
  PaymentStatus,
} from '../../../generated/prisma/client';

/**
 * Máquinas de estado del pago y del plan de cuotas (HU-22/23/24/26/33). Reglas PURAS: los servicios
 * aplican cada cambio con un update condicionado al estado previo, así un evento de Stripe repetido o
 * fuera de orden nunca "retrocede" un pago (p. ej. `checkout.session.expired` después de `completed`).
 *
 * ```
 * Tarjeta:        PENDING ──▶ PAID ──▶ REFUNDED
 *                    │  ╲───▶ FAILED ──(reintento exitoso)──▶ PAID
 *                    ╰──────▶ CANCELLED (checkout cancelado/vencido) ──(pago tardío confirmado)──▶ PAID
 * Transferencia:  PENDING_VALIDATION ──▶ VALIDATED (equipo) | REJECTED (equipo, con motivo)
 * ```
 */
export const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  PENDING: ['PAID', 'FAILED', 'CANCELLED'],
  FAILED: ['PAID', 'FAILED'],
  // Stripe nunca confirma una sesión ya vencida, pero si llega el cobro se registra (no se pierde dinero).
  CANCELLED: ['PAID'],
  PAID: ['REFUNDED'],
  REFUNDED: [],
  PENDING_VALIDATION: ['VALIDATED', 'REJECTED'],
  VALIDATED: ['REFUNDED'],
  REJECTED: [],
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

/** Estados desde los que un pago puede pasar a `to` (para el `where` del update condicionado). */
export function paymentStatusesBefore(to: PaymentStatus): PaymentStatus[] {
  return (Object.keys(PAYMENT_TRANSITIONS) as PaymentStatus[]).filter((from) =>
    PAYMENT_TRANSITIONS[from].includes(to),
  );
}

/** Pagos con comprobante descargable (HU-26: "Solo pagos Pagado o Validada"). */
export function hasReceipt(status: PaymentStatus): boolean {
  return status === 'PAID' || status === 'VALIDATED';
}

/** Pagos que se muestran en "Mis pagos" (los checkouts cancelados no son pagos). */
export const HISTORY_STATUSES: readonly PaymentStatus[] = [
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
  'PENDING_VALIDATION',
  'VALIDATED',
  'REJECTED',
];

/** Textos de HU-26 (badges). La API envía el enum; el frontend usa esta tabla (guía de la fase). */
export function paymentStatusLabel(status: PaymentStatus, method: PaymentMethod): string {
  switch (status) {
    case 'PENDING':
      return 'Procesando pago';
    case 'PAID':
      return 'Pagado';
    case 'FAILED':
      return 'Fallido';
    case 'CANCELLED':
      return 'Cancelado';
    case 'REFUNDED':
      return 'Reembolsado';
    case 'PENDING_VALIDATION':
      return 'Pendiente de validación';
    case 'VALIDATED':
      return method === 'BANK_TRANSFER' ? 'Validada' : 'Pagado';
    case 'REJECTED':
      return 'Rechazada';
  }
}

export function paymentMethodLabel(method: PaymentMethod): string {
  return method === 'CARD' ? 'Tarjeta' : 'Transferencia bancaria';
}

// -------------------------------------------------------------------------------------------------
// Plan de cuotas
// -------------------------------------------------------------------------------------------------

/**
 * ```
 * PENDING_ACTIVATION ──(1.ª cuota pagada)──▶ CURRENT ("Al día")
 *        ╰──(checkout abandonado)──▶ CANCELLED
 * CURRENT ──(cobro fallido)──▶ PAST_DUE ("Cobro fallido") ──(N días)──▶ DELINQUENT ("En mora")
 * PAST_DUE / DELINQUENT ──(regulariza)──▶ CURRENT
 * CURRENT / PAST_DUE / DELINQUENT ──(última cuota pagada)──▶ COMPLETED
 * cualquiera vigente ──(equipo, Fase 06)──▶ CANCELLED
 * ```
 */
export const PLAN_TRANSITIONS: Record<InstallmentPlanStatus, readonly InstallmentPlanStatus[]> = {
  PENDING_ACTIVATION: ['CURRENT', 'COMPLETED', 'CANCELLED'],
  CURRENT: ['PAST_DUE', 'COMPLETED', 'CANCELLED'],
  PAST_DUE: ['CURRENT', 'DELINQUENT', 'COMPLETED', 'CANCELLED'],
  DELINQUENT: ['CURRENT', 'COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionPlan(from: InstallmentPlanStatus, to: InstallmentPlanStatus): boolean {
  return PLAN_TRANSITIONS[from].includes(to);
}

/** Planes "vigentes" (HU-26: tarjeta del plan activo; se cobran cuotas). */
export const ACTIVE_PLAN_STATUSES: readonly InstallmentPlanStatus[] = [
  'CURRENT',
  'PAST_DUE',
  'DELINQUENT',
];

export function isActivePlan(status: InstallmentPlanStatus): boolean {
  return ACTIVE_PLAN_STATUSES.includes(status);
}

export const PLAN_STATUS_LABELS: Record<InstallmentPlanStatus, string> = {
  PENDING_ACTIVATION: 'Pendiente de activar',
  CURRENT: 'Al día',
  PAST_DUE: 'Cobro fallido',
  DELINQUENT: 'En mora',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

/**
 * Estado del plan tras pagar una cuota: todas pagadas → COMPLETED; quedan fallidas → se conserva el
 * estado de cobro fallido/mora; si no → CURRENT ("Al día", regularizado).
 */
export function planStatusAfterInstallmentPaid(
  current: InstallmentPlanStatus,
  installments: ReadonlyArray<{ status: InstallmentStatus }>,
): InstallmentPlanStatus {
  const pending = installments.filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED');
  if (pending.length === 0) return 'COMPLETED';
  if (pending.some((i) => i.status === 'FAILED')) {
    return current === 'DELINQUENT' ? 'DELINQUENT' : 'PAST_DUE';
  }
  return 'CURRENT';
}
