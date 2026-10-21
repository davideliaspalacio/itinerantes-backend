import type { CalendarAudience, CalendarCategory } from '../../../generated/prisma/client';
import { BUSINESS_RULES } from '../../../config/business-rules';

/**
 * Reglas puras del calendario central (HU-10).
 *
 * Fuentes (ARCHITECTURE.md → "Sesiones vs. calendario"):
 * - Sesiones (`OfferSession`) de las ofertas en que la persona tiene acceso al Aula (Formación /
 *   Territorio solo para inscritos, Anexo A HU-10).
 * - Eventos (`CalendarEvent`): audiencia ALL_REGISTERED (todas las personas registradas; si tienen
 *   oferta, solo si la oferta está publicada) u OFFER_ENROLLED de sus ofertas.
 * - Canceladas: siguen visibles como "Cancelada", sin enlace (HU-10 §5.1).
 */

export interface CalendarRangeError {
  field: 'from' | 'to';
  code: 'INVALID_RANGE' | 'RANGE_TOO_LARGE';
  message: string;
}

/** Valida `from < to` y que el rango no supere CALENDAR_MAX_RANGE_DAYS. */
export function validateCalendarRange(
  from: Date,
  to: Date,
  maxDays: number = BUSINESS_RULES.CALENDAR_MAX_RANGE_DAYS,
): CalendarRangeError | null {
  if (to.getTime() <= from.getTime()) {
    return { field: 'to', code: 'INVALID_RANGE', message: '`to` debe ser posterior a `from`.' };
  }
  if (to.getTime() - from.getTime() > maxDays * 24 * 3600_000) {
    return {
      field: 'to',
      code: 'RANGE_TOO_LARGE',
      message: `El rango máximo es de ${maxDays} días.`,
    };
  }
  return null;
}

export interface EventAudienceInput {
  audience: CalendarAudience;
  offerId: string | null;
  /** La oferta relacionada está publicada (null si no hay oferta). */
  offerPublished: boolean | null;
}

/** ¿La persona está en la audiencia del evento? (HU-10 criterio 5). */
export function isEventVisibleTo(
  event: EventAudienceInput,
  accessibleOfferIds: ReadonlySet<string>,
): boolean {
  if (event.audience === 'OFFER_ENROLLED') {
    return !!event.offerId && accessibleOfferIds.has(event.offerId);
  }
  // ALL_REGISTERED: eventos generales, o fechas importantes de ofertas publicadas.
  return event.offerId === null || event.offerPublished === true;
}

/** ¿Un intervalo [startsAt, endsAt] se cruza con [from, to)? (eventos sin fin = instante). */
export function overlapsRange(startsAt: Date, endsAt: Date | null, from: Date, to: Date): boolean {
  const end = (endsAt ?? startsAt).getTime();
  return startsAt.getTime() < to.getTime() && end >= from.getTime();
}

/** Orden cronológico; a igual inicio, primero los de día completo y luego por título. */
export function compareCalendarItems(
  a: { startsAt: Date; allDay: boolean; title: string },
  b: { startsAt: Date; allDay: boolean; title: string },
): number {
  const diff = a.startsAt.getTime() - b.startsAt.getTime();
  if (diff !== 0) return diff;
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return a.title.localeCompare(b.title, 'es');
}

/** Filtro de categorías (chips de HU-10); vacío/undefined = todas. */
export function matchesCategories(
  category: CalendarCategory,
  categories: readonly CalendarCategory[] | undefined,
): boolean {
  return !categories?.length || categories.includes(category);
}
