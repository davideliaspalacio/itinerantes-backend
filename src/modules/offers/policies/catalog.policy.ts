import type { OfferModality, OfferType, PublicTopic } from '../../../generated/prisma/client';
import { type OfferAvailability, availabilitySortRank } from './offer-status.policy';

/**
 * Filtro y orden del catálogo público (HU-15). Puro: se aplica en memoria sobre las ofertas
 * publicadas (decenas, no miles), porque el estado se deriva de fechas y la búsqueda ignora acentos.
 */
export interface CatalogEntry {
  name: string;
  type: OfferType;
  modality: OfferModality;
  publicTopic: PublicTopic | null;
  availability: OfferAvailability;
  scholarshipOffered: boolean;
  startsAt: Date | null;
  teacherNames: readonly string[];
}

export interface CatalogFilters {
  types?: readonly OfferType[];
  modality?: OfferModality;
  statuses: readonly OfferAvailability[];
  scholarship?: boolean;
  topic?: PublicTopic;
  /** Texto ya validado (≥ 3 caracteres). */
  q?: string;
}

/** Minúsculas y sin acentos: "Ecotecnologías" ≈ "ecotecnologias". */
export function normalizeSearchText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function matchesCatalogFilters(entry: CatalogEntry, filters: CatalogFilters): boolean {
  if (filters.types?.length && !filters.types.includes(entry.type)) return false;
  if (filters.modality && entry.modality !== filters.modality) return false;
  if (!filters.statuses.includes(entry.availability)) return false;
  if (filters.scholarship === true && !entry.scholarshipOffered) return false;
  if (filters.topic && entry.publicTopic !== filters.topic) return false;
  if (filters.q) {
    const needle = normalizeSearchText(filters.q);
    const haystacks = [entry.name, ...entry.teacherNames].map(normalizeSearchText);
    if (!haystacks.some((h) => h.includes(needle))) return false;
  }
  return true;
}

/**
 * Orden (HU-15): abiertas y próximas primero, luego cerradas y al final finalizadas; dentro de cada
 * grupo, inicio más cercano primero (sin fecha al final) y luego nombre.
 */
export function compareCatalogEntries(a: CatalogEntry, b: CatalogEntry): number {
  const rank = availabilitySortRank(a.availability) - availabilitySortRank(b.availability);
  if (rank !== 0) return rank;
  const aStart = a.startsAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const bStart = b.startsAt?.getTime() ?? Number.POSITIVE_INFINITY;
  if (aStart !== bStart) return aStart < bStart ? -1 : 1;
  return a.name.localeCompare(b.name, 'es');
}
