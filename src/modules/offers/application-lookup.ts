import type { ApplicationKind, ApplicationStatus } from '../../generated/prisma/client';

/**
 * Punto de extensión para las acciones de la ficha con postulación (HU-16/21: [Ver mi postulación],
 * [Pagar saldo]). Implementación real (Fase 04): `ApplicationLookupService`
 * (src/modules/applications), registrada en OffersModule con `useExisting`.
 */
export interface OfferApplicationRef {
  id: string;
  kind: ApplicationKind;
  status: ApplicationStatus;
  folio: string;
  /** Fase 05: comprobante de transferencia "Pendiente de validación" → "Pago en validación". */
  transferPending?: boolean;
}

export interface OfferApplicationLookup {
  /** Postulación de `userId` en cada oferta de `offerIds` (las que no tienen, faltan). */
  applicationsForUser(
    userId: string,
    offerIds: readonly string[],
  ): Promise<Map<string, OfferApplicationRef>>;
}

export const OFFER_APPLICATION_LOOKUP = Symbol('OFFER_APPLICATION_LOOKUP');
