import { Injectable } from '@nestjs/common';

/**
 * Punto de extensión para el badge "Inscrito" (HU-15/16) y el cupo ("Cupo agotado", HU-16/22).
 *
 * Fase 02 no tiene inscripciones: `NoEnrollmentLookup` responde "no inscrito" y 0 inscritos.
 * La Fase 03 (Enrollment) debe proveer una implementación real y registrarla en OffersModule:
 *
 * ```ts
 * { provide: OFFER_ENROLLMENT_LOOKUP, useExisting: EnrollmentsLookupService }
 * ```
 *
 * Contrato: "activa" = la inscripción da acceso al Aula (incluye las de origen Moodle vinculadas).
 */
export interface OfferEnrollmentLookup {
  /** Ids (de `offerIds`) en los que `userId` tiene una inscripción activa. */
  activeOfferIdsForUser(userId: string, offerIds: readonly string[]): Promise<Set<string>>;
  /** Inscripciones que ocupan cupo, por oferta (las ofertas sin inscripciones pueden faltar). */
  countSeatsTaken(offerIds: readonly string[]): Promise<Map<string, number>>;
}

export const OFFER_ENROLLMENT_LOOKUP = Symbol('OFFER_ENROLLMENT_LOOKUP');

@Injectable()
export class NoEnrollmentLookup implements OfferEnrollmentLookup {
  activeOfferIdsForUser(): Promise<Set<string>> {
    return Promise.resolve(new Set<string>());
  }

  countSeatsTaken(): Promise<Map<string, number>> {
    return Promise.resolve(new Map<string, number>());
  }
}
