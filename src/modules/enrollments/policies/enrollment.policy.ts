import type { EnrollmentStatus, OfferOrigin, OfferType } from '../../../generated/prisma/client';
import {
  OfferActionReason,
  type OfferActionType,
} from '../../offers/policies/offer-actions.policy';
import { OfferAvailability } from '../../offers/policies/offer-status.policy';

/**
 * Reglas puras de inscripción (Fase 03). Ver docs/ARCHITECTURE.md → "Portal del participante".
 */

/** Estados que dan acceso al Aula, materiales, sesiones y asistencia (HU-07/08/12/17/18). */
export const CLASSROOM_ACCESS_STATUSES = [
  'ACTIVE',
  'COMPLETED',
] as const satisfies readonly EnrollmentStatus[];

/**
 * Estados que ocupan cupo (HU-16 "Cupo agotado", HU-22). PENDING_PAYMENT no ocupa cupo en Fase 03;
 * la Fase 05 decide si una reserva en checkout lo retiene (con vencimiento).
 */
export const SEAT_HOLDING_STATUSES = [
  'ACTIVE',
  'COMPLETED',
  'SUSPENDED',
] as const satisfies readonly EnrollmentStatus[];

/** Estados que aparecen en "Mi formación" (HU-07). PENDING_PAYMENT y CANCELLED no se listan. */
export const MY_FORMATION_STATUSES = [
  'ACTIVE',
  'COMPLETED',
  'SUSPENDED',
] as const satisfies readonly EnrollmentStatus[];

/** Estados que bloquean una nueva inscripción en la misma oferta (una por cohorte). */
const BLOCKING_STATUSES: readonly EnrollmentStatus[] = [
  'PENDING_PAYMENT',
  'ACTIVE',
  'COMPLETED',
  'SUSPENDED',
];

export function hasClassroomAccess(status: EnrollmentStatus | null | undefined): boolean {
  return !!status && (CLASSROOM_ACCESS_STATUSES as readonly string[]).includes(status);
}

/**
 * Fase de la formación para las pestañas de HU-07 ("Activos / Completados"):
 * COMPLETED si el equipo la cerró o si la oferta ya terminó (`endsAt` pasado); si no, ACTIVE.
 */
export const FormationPhase = { ACTIVE: 'ACTIVE', COMPLETED: 'COMPLETED' } as const;
export type FormationPhase = (typeof FormationPhase)[keyof typeof FormationPhase];

export function deriveFormationPhase(
  status: EnrollmentStatus,
  offerEndsAt: Date | null,
  now: Date,
): FormationPhase {
  if (status === 'COMPLETED') return FormationPhase.COMPLETED;
  if (offerEndsAt && offerEndsAt.getTime() < now.getTime()) return FormationPhase.COMPLETED;
  return FormationPhase.ACTIVE;
}

// -------------------------------------------------------------------------------------------------
// Inscripción gratuita ([Inscribirme] = ENROLL_FREE de la ficha, HU-16)
// -------------------------------------------------------------------------------------------------

export interface FreeEnrollmentInput {
  type: OfferType;
  origin: OfferOrigin;
  isFree: boolean;
  availability: OfferAvailability;
  enrollmentOpensAt: Date | null;
  soldOut: boolean;
  /** Estado de una inscripción previa de la persona en esta oferta (null si no hay). */
  existingStatus: EnrollmentStatus | null;
}

export type FreeEnrollmentDecision =
  | { ok: true; reactivate: boolean }
  | {
      ok: false;
      code: 'ENROLLMENT_ALREADY_EXISTS';
      meta: { enrollmentStatus: EnrollmentStatus };
    }
  | {
      ok: false;
      code: 'ENROLLMENT_NOT_FREE';
      /** Acción de la ficha que corresponde (HU-16): pagar, postular o activar Moodle. */
      meta: { requiredAction: OfferActionType };
    }
  | {
      ok: false;
      code: 'ENROLLMENT_CLOSED';
      meta: { reason: OfferActionReason; availableFrom: Date | null };
    }
  | { ok: false; code: 'OFFER_SOLD_OUT'; meta: Record<string, never> };

/**
 * ¿Puede la persona inscribirse directamente (sin pago ni postulación)?
 * Solo ofertas NAS gratuitas que no sean convocatorias, con inscripciones abiertas y cupo.
 * Una inscripción CANCELLED previa se reactiva (única por persona y oferta).
 */
export function decideFreeEnrollment(input: FreeEnrollmentInput): FreeEnrollmentDecision {
  if (input.existingStatus && BLOCKING_STATUSES.includes(input.existingStatus)) {
    return {
      ok: false,
      code: 'ENROLLMENT_ALREADY_EXISTS',
      meta: { enrollmentStatus: input.existingStatus },
    };
  }
  if (input.origin === 'MOODLE') {
    return {
      ok: false,
      code: 'ENROLLMENT_NOT_FREE',
      meta: { requiredAction: 'ACTIVATE_MOODLE_ACCESS' },
    };
  }
  if (input.type === 'OPEN_CALL') {
    return { ok: false, code: 'ENROLLMENT_NOT_FREE', meta: { requiredAction: 'APPLY_OPEN_CALL' } };
  }
  if (!input.isFree) {
    return { ok: false, code: 'ENROLLMENT_NOT_FREE', meta: { requiredAction: 'ENROLL_AND_PAY' } };
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
  if (input.soldOut) return { ok: false, code: 'OFFER_SOLD_OUT', meta: {} };
  return { ok: true, reactivate: input.existingStatus === 'CANCELLED' };
}

function closed(reason: OfferActionReason, availableFrom: Date | null): FreeEnrollmentDecision {
  return { ok: false, code: 'ENROLLMENT_CLOSED', meta: { reason, availableFrom } };
}
