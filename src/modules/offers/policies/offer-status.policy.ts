import type { OfferPublicationStatus, OfferType } from '../../../generated/prisma/client';

/**
 * Estado público derivado de una oferta (HU-15 / HU-27): se calcula SIEMPRE a partir del estado de
 * publicación y las fechas; nunca se guarda.
 *
 * | Valor              | Texto en la UI          |
 * |--------------------|-------------------------|
 * | ENROLLMENT_OPEN    | Inscripciones abiertas  |
 * | UPCOMING           | Próximamente            |
 * | ENROLLMENT_CLOSED  | Inscripciones cerradas  |
 * | FINISHED           | Finalizado              |
 */
export const OfferAvailability = {
  ENROLLMENT_OPEN: 'ENROLLMENT_OPEN',
  UPCOMING: 'UPCOMING',
  ENROLLMENT_CLOSED: 'ENROLLMENT_CLOSED',
  FINISHED: 'FINISHED',
} as const;
export type OfferAvailability = (typeof OfferAvailability)[keyof typeof OfferAvailability];
export const OFFER_AVAILABILITY_VALUES = Object.values(OfferAvailability);

/** Filtro por defecto del catálogo (HU-15): abiertas y próximamente. */
export const DEFAULT_CATALOG_AVAILABILITY: readonly OfferAvailability[] = [
  OfferAvailability.ENROLLMENT_OPEN,
  OfferAvailability.UPCOMING,
];

/**
 * Estado de la convocatoria (solo OPEN_CALL, HU-20): ventana de postulación.
 * OPEN = "Abierta", UPCOMING = "Próximamente", CLOSED = "Cerrada".
 */
export const OpenCallStatus = {
  OPEN: 'OPEN',
  UPCOMING: 'UPCOMING',
  CLOSED: 'CLOSED',
} as const;
export type OpenCallStatus = (typeof OpenCallStatus)[keyof typeof OpenCallStatus];

export interface OfferDates {
  enrollmentOpensAt: Date | null;
  enrollmentClosesAt: Date | null;
  startsAt: Date | null;
  endsAt: Date | null;
}

/** `true` solo para ofertas publicadas: el catálogo y la ficha nunca muestran borradores ni archivadas. */
export function isPubliclyVisible(status: OfferPublicationStatus): boolean {
  return status === 'PUBLISHED';
}

/**
 * Cierre efectivo de inscripciones: `enrollmentClosesAt` o, si no se capturó, el inicio de la oferta.
 */
export function effectiveEnrollmentClose(dates: OfferDates): Date | null {
  return dates.enrollmentClosesAt ?? dates.startsAt;
}

/**
 * Deriva el estado público (sin considerar publicación; filtra antes con `isPubliclyVisible`).
 *
 * Reglas, en orden:
 * 1. `endsAt` ya pasó → FINISHED.
 * 2. Sin fechas de inscripción ni de inicio ("sin fechas programadas") → UPCOMING.
 * 3. `enrollmentOpensAt` en el futuro → UPCOMING (la UI muestra "Inscripciones abren el …").
 * 4. Cierre efectivo (`enrollmentClosesAt` o `startsAt`) ya pasó → ENROLLMENT_CLOSED.
 * 5. Si no → ENROLLMENT_OPEN.
 */
export function deriveOfferAvailability(dates: OfferDates, now: Date): OfferAvailability {
  const t = now.getTime();
  if (dates.endsAt && dates.endsAt.getTime() < t) return OfferAvailability.FINISHED;
  if (!dates.enrollmentOpensAt && !dates.enrollmentClosesAt && !dates.startsAt) {
    return OfferAvailability.UPCOMING;
  }
  if (dates.enrollmentOpensAt && dates.enrollmentOpensAt.getTime() > t) {
    return OfferAvailability.UPCOMING;
  }
  const close = effectiveEnrollmentClose(dates);
  if (close && close.getTime() <= t) return OfferAvailability.ENROLLMENT_CLOSED;
  return OfferAvailability.ENROLLMENT_OPEN;
}

/** Estado de la convocatoria (null si la oferta no es OPEN_CALL). */
export function deriveOpenCallStatus(
  type: OfferType,
  availability: OfferAvailability,
): OpenCallStatus | null {
  if (type !== 'OPEN_CALL') return null;
  switch (availability) {
    case OfferAvailability.ENROLLMENT_OPEN:
      return OpenCallStatus.OPEN;
    case OfferAvailability.UPCOMING:
      return OpenCallStatus.UPCOMING;
    default:
      return OpenCallStatus.CLOSED;
  }
}

/** Rango de orden del catálogo: abiertas y próximas primero; cerradas y finalizadas al final. */
export function availabilitySortRank(availability: OfferAvailability): number {
  return availability === OfferAvailability.ENROLLMENT_OPEN ||
    availability === OfferAvailability.UPCOMING
    ? 0
    : availability === OfferAvailability.ENROLLMENT_CLOSED
      ? 1
      : 2;
}
