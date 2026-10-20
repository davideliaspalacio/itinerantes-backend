import type {
  CalendarAudience,
  CalendarEventKind,
  OfferType,
} from '../../../generated/prisma/client';

/**
 * Fechas importantes automáticas de una oferta (HU-29, eventos rojos de HU-10): cierre de
 * inscripciones, inicio, límite de beca y proyecto final. Solo se generan las fechas que existen.
 * Audiencia (Anexo A, HU-10): las de inscripciones/becas/convocatorias las ven todos los registrados;
 * inicio y proyecto final, solo los inscritos de la oferta.
 */
export interface ImportantDateInput {
  name: string;
  type: OfferType;
  enrollmentClosesAt: Date | null;
  startsAt: Date | null;
  scholarshipClosesAt: Date | null;
  finalProjectDueAt: Date | null;
}

export interface ImportantDate {
  kind: Exclude<CalendarEventKind, 'MANUAL'>;
  title: string;
  startsAt: Date;
  audience: CalendarAudience;
}

export function buildImportantDates(offer: ImportantDateInput): ImportantDate[] {
  const isCall = offer.type === 'OPEN_CALL';
  const dates: Array<ImportantDate | null> = [
    offer.enrollmentClosesAt && {
      kind: 'ENROLLMENT_CLOSES',
      title: `${isCall ? 'Cierre de convocatoria' : 'Cierre de inscripciones'}: ${offer.name}`,
      startsAt: offer.enrollmentClosesAt,
      audience: 'ALL_REGISTERED',
    },
    offer.scholarshipClosesAt && {
      kind: 'SCHOLARSHIP_DEADLINE',
      title: `Límite para postular a beca: ${offer.name}`,
      startsAt: offer.scholarshipClosesAt,
      audience: 'ALL_REGISTERED',
    },
    offer.startsAt && {
      kind: 'OFFER_STARTS',
      title: `Inicio: ${offer.name}`,
      startsAt: offer.startsAt,
      audience: 'OFFER_ENROLLED',
    },
    offer.finalProjectDueAt && {
      kind: 'FINAL_PROJECT',
      title: `Proyecto final: ${offer.name}`,
      startsAt: offer.finalProjectDueAt,
      audience: 'OFFER_ENROLLED',
    },
  ];
  return dates.filter((d): d is ImportantDate => d !== null);
}
