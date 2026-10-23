import type { ApplicationStatus } from '../../../generated/prisma/client';

/**
 * Cupo máximo por tipo de beca — reglas PURAS.
 *
 * - `ScholarshipType.maxRecipients`: cupo GLOBAL del tipo (todas las ofertas). null = sin límite.
 * - `OfferScholarshipType.maxRecipients`: tope adicional SOLO en esa oferta. Si existen ambos, aplican
 *   los dos (lo disponible es el mínimo).
 * - Cupo usado = postulaciones con ese `assignedScholarshipTypeId` en un estado que OCUPA la beca
 *   (`SCHOLARSHIP_SEAT_STATUSES`). Se calcula siempre: si una aprobada vence o no es seleccionada,
 *   el cupo se libera solo.
 */

/**
 * Estados que ocupan una beca asignada: aprobada pendiente de pago, aprobada pendiente de
 * confirmación e inscrita. NO ocupan: borrador, enviada, en revisión, entrevista agendada (aún sin
 * asignación), no seleccionada ni vencida.
 */
export const SCHOLARSHIP_SEAT_STATUSES: readonly ApplicationStatus[] = [
  'APPROVED_PENDING_PAYMENT',
  'APPROVED_PENDING_CONFIRMATION',
  'ENROLLED',
];

export function occupiesScholarshipSeat(status: ApplicationStatus): boolean {
  return SCHOLARSHIP_SEAT_STATUSES.includes(status);
}

export interface QuotaState {
  /** null = sin límite. */
  maxRecipients: number | null;
  usedRecipients: number;
  /** null = sin límite. Nunca negativo (si se bajó el cupo por debajo de lo usado → 0). */
  availableRecipients: number | null;
  isFull: boolean;
}

export function quotaState(maxRecipients: number | null, usedRecipients: number): QuotaState {
  const availableRecipients =
    maxRecipients === null ? null : Math.max(0, maxRecipients - usedRecipients);
  return {
    maxRecipients,
    usedRecipients,
    availableRecipients,
    isFull: availableRecipients === 0,
  };
}

/** Cupo de un tipo en una oferta: el global del tipo y el propio de la oferta. */
export interface OfferQuotaInput {
  type: { maxRecipients: number | null; usedRecipients: number };
  offer: { maxRecipients: number | null; usedRecipients: number };
}

export interface OfferQuotaState {
  type: QuotaState;
  offer: QuotaState;
  /** Mínimo entre ambos (null = ninguno tiene límite). */
  availableRecipients: number | null;
  isFull: boolean;
}

export function offerQuotaState(input: OfferQuotaInput): OfferQuotaState {
  const type = quotaState(input.type.maxRecipients, input.type.usedRecipients);
  const offer = quotaState(input.offer.maxRecipients, input.offer.usedRecipients);
  const limits = [type.availableRecipients, offer.availableRecipients].filter(
    (n): n is number => n !== null,
  );
  const availableRecipients = limits.length > 0 ? Math.min(...limits) : null;
  return { type, offer, availableRecipients, isFull: availableRecipients === 0 };
}

export interface QuotaViolation {
  scope: 'TYPE' | 'OFFER';
  maxRecipients: number;
  used: number;
}

/**
 * ¿Cabe UNA asignación más? `used*` NO incluye la postulación que se está aprobando. Devuelve la
 * primera restricción violada (primero la global del tipo, luego la de la oferta) o null.
 */
export function quotaViolation(input: OfferQuotaInput): QuotaViolation | null {
  const { type, offer } = input;
  if (type.maxRecipients !== null && type.usedRecipients >= type.maxRecipients) {
    return { scope: 'TYPE', maxRecipients: type.maxRecipients, used: type.usedRecipients };
  }
  if (offer.maxRecipients !== null && offer.usedRecipients >= offer.maxRecipients) {
    return { scope: 'OFFER', maxRecipients: offer.maxRecipients, used: offer.usedRecipients };
  }
  return null;
}

/** Forma plana para el panel (`OfferScholarshipQuotaDto`). */
export function flattenOfferQuota(state: OfferQuotaState) {
  return {
    typeMaxRecipients: state.type.maxRecipients,
    typeUsedRecipients: state.type.usedRecipients,
    offerMaxRecipients: state.offer.maxRecipients,
    offerUsedRecipients: state.offer.usedRecipients,
    availableRecipients: state.availableRecipients,
    isFull: state.isFull,
  };
}

/** Sin datos de uso (p. ej. tipo sin límites): disponible ilimitado. */
export const UNLIMITED_OFFER_QUOTA: OfferQuotaState = offerQuotaState({
  type: { maxRecipients: null, usedRecipients: 0 },
  offer: { maxRecipients: null, usedRecipients: 0 },
});
