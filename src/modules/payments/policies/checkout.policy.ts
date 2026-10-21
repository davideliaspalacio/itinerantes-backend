import type {
  ApplicationStatus,
  EnrollmentStatus,
  OfferOrigin,
  OfferType,
} from '../../../generated/prisma/client';
import {
  OfferActionReason,
  type OfferActionType,
} from '../../offers/policies/offer-actions.policy';
import { OfferAvailability } from '../../offers/policies/offer-status.policy';

/**
 * ¿Se puede iniciar un pago? (HU-22 / HU-23 / HU-24). Reglas PURAS; el servicio las evalúa dentro de
 * una transacción con la fila de la oferta bloqueada (cupo).
 */

export const PaymentNotAllowedReason = {
  /** Oferta Moodle: pagada fuera ("Ya estoy inscrito: activar mi acceso", HU-25). */
  MOODLE: 'MOODLE',
  /** Convocatoria: se postula (HU-20); si tiene costo se paga el saldo de la postulación. */
  OPEN_CALL: 'OPEN_CALL',
  /** Gratuita: [Inscribirme] (POST /me/enrollments). */
  FREE: 'FREE',
  /** Sin precio en la moneda de la persona (configuración incompleta). */
  PRICE_NOT_AVAILABLE: 'PRICE_NOT_AVAILABLE',
  /** Tiene una beca aprobada con saldo: se paga el saldo, no el precio completo (HU-23). */
  PAY_BALANCE: 'PAY_BALANCE',
} as const;
export type PaymentNotAllowedReason =
  (typeof PaymentNotAllowedReason)[keyof typeof PaymentNotAllowedReason];

/** Acción de la ficha que corresponde a cada motivo (para `meta.requiredAction`). */
const REQUIRED_ACTION: Record<PaymentNotAllowedReason, OfferActionType | null> = {
  MOODLE: 'ACTIVATE_MOODLE_ACCESS',
  OPEN_CALL: 'APPLY_OPEN_CALL',
  FREE: 'ENROLL_FREE',
  PRICE_NOT_AVAILABLE: null,
  PAY_BALANCE: 'PAY_BALANCE',
};

/** Estados de inscripción que impiden pagar de nuevo (ya inscrito, también suspendido). */
const ENROLLED_STATUSES: readonly EnrollmentStatus[] = ['ACTIVE', 'COMPLETED', 'SUSPENDED'];

export type CheckoutDecision =
  | { ok: true }
  | { ok: false; code: 'ENROLLMENT_ALREADY_EXISTS'; meta: { enrollmentStatus: EnrollmentStatus } }
  | {
      ok: false;
      code: 'PAYMENT_NOT_ALLOWED';
      meta: { reason: PaymentNotAllowedReason; requiredAction: OfferActionType | null };
    }
  | {
      ok: false;
      code: 'ENROLLMENT_CLOSED';
      meta: { reason: OfferActionReason; availableFrom: Date | null };
    }
  | { ok: false; code: 'OFFER_SOLD_OUT'; meta: Record<string, never> };

export interface EnrollmentCheckoutInput {
  type: OfferType;
  origin: OfferOrigin;
  isFree: boolean;
  availability: OfferAvailability;
  enrollmentOpensAt: Date | null;
  /** Precio > 0 en la moneda de cobro. */
  hasPrice: boolean;
  /** Cupo agotado SIN contar la reserva propia. */
  soldOut: boolean;
  existingEnrollmentStatus: EnrollmentStatus | null;
  /** Postulación de la persona en la oferta (una por cohorte). */
  applicationStatus: ApplicationStatus | null;
}

/** HU-22 / HU-24 (pago completo o en cuotas desde la ficha). */
export function decideEnrollmentCheckout(input: EnrollmentCheckoutInput): CheckoutDecision {
  if (
    input.existingEnrollmentStatus &&
    ENROLLED_STATUSES.includes(input.existingEnrollmentStatus)
  ) {
    return {
      ok: false,
      code: 'ENROLLMENT_ALREADY_EXISTS',
      meta: { enrollmentStatus: input.existingEnrollmentStatus },
    };
  }
  if (input.origin === 'MOODLE') return notAllowed(PaymentNotAllowedReason.MOODLE);
  if (input.type === 'OPEN_CALL') return notAllowed(PaymentNotAllowedReason.OPEN_CALL);
  if (input.isFree) return notAllowed(PaymentNotAllowedReason.FREE);
  if (input.applicationStatus === 'APPROVED_PENDING_PAYMENT') {
    return notAllowed(PaymentNotAllowedReason.PAY_BALANCE);
  }
  switch (input.availability) {
    case OfferAvailability.FINISHED:
      return closed(OfferActionReason.OFFER_FINISHED, null);
    case OfferAvailability.UPCOMING:
      return closed(OfferActionReason.ENROLLMENT_NOT_OPEN_YET, input.enrollmentOpensAt);
    case OfferAvailability.ENROLLMENT_CLOSED:
      return closed(OfferActionReason.ENROLLMENT_CLOSED, null);
    default:
      break;
  }
  if (!input.hasPrice) return notAllowed(PaymentNotAllowedReason.PRICE_NOT_AVAILABLE);
  if (input.soldOut) return { ok: false, code: 'OFFER_SOLD_OUT', meta: {} };
  return { ok: true };
}

export type BalanceDecision =
  | { ok: true }
  | { ok: false; code: 'PAYMENT_BALANCE_NOT_DUE'; meta: { status: ApplicationStatus } }
  | { ok: false; code: 'APPLICATION_DEADLINE_PASSED'; meta: { dueAt: Date } }
  | { ok: false; code: 'PAYMENT_TRANSFER_PENDING'; meta: Record<string, never> };

/** HU-23: pagar el saldo de una postulación aprobada (tarjeta o transferencia). */
export function decideBalancePayment(input: {
  status: ApplicationStatus;
  balanceCents: number | null;
  hasCurrency: boolean;
  responseDueAt: Date | null;
  pendingTransfer: boolean;
  now: Date;
}): BalanceDecision {
  if (
    input.status !== 'APPROVED_PENDING_PAYMENT' ||
    !input.hasCurrency ||
    (input.balanceCents ?? 0) <= 0
  ) {
    return { ok: false, code: 'PAYMENT_BALANCE_NOT_DUE', meta: { status: input.status } };
  }
  if (input.responseDueAt && input.responseDueAt.getTime() <= input.now.getTime()) {
    return { ok: false, code: 'APPLICATION_DEADLINE_PASSED', meta: { dueAt: input.responseDueAt } };
  }
  if (input.pendingTransfer) return { ok: false, code: 'PAYMENT_TRANSFER_PENDING', meta: {} };
  return { ok: true };
}

function notAllowed(reason: PaymentNotAllowedReason): CheckoutDecision {
  return {
    ok: false,
    code: 'PAYMENT_NOT_ALLOWED',
    meta: { reason, requiredAction: REQUIRED_ACTION[reason] },
  };
}

function closed(reason: OfferActionReason, availableFrom: Date | null): CheckoutDecision {
  return { ok: false, code: 'ENROLLMENT_CLOSED', meta: { reason, availableFrom } };
}
