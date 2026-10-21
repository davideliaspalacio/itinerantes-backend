/**
 * Punto de extensión para el badge "Inscrito" (HU-15/16) y el cupo ("Cupo agotado", HU-16/22).
 *
 * Implementación real (Fase 03): `EnrollmentLookupService` (src/modules/enrollments), registrada en
 * OffersModule con `{ provide: OFFER_ENROLLMENT_LOOKUP, useExisting: EnrollmentLookupService }`.
 * Las pruebas pueden sustituirla con `overrideProvider(OFFER_ENROLLMENT_LOOKUP)`.
 *
 * Contrato: "activa" = la inscripción da acceso al Aula (ACTIVE o COMPLETED, incluidas las de
 * origen Moodle vinculadas); el cupo lo ocupan ACTIVE, COMPLETED y SUSPENDED.
 */
export interface OfferEnrollmentLookup {
  /** Ids (de `offerIds`) en los que `userId` tiene una inscripción activa. */
  activeOfferIdsForUser(userId: string, offerIds: readonly string[]): Promise<Set<string>>;
  /** Inscripciones que ocupan cupo, por oferta (las ofertas sin inscripciones pueden faltar). */
  countSeatsTaken(offerIds: readonly string[]): Promise<Map<string, number>>;
}

export const OFFER_ENROLLMENT_LOOKUP = Symbol('OFFER_ENROLLMENT_LOOKUP');
