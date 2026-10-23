import { DEFAULT_SCHOLARSHIP_TYPES } from '../scholarship-types.defaults';
import type { OfferScholarshipTypeLink, ScholarshipTypeDef } from './scholarship-type.policy';

/**
 * Tipos de beca por defecto como `ScholarshipTypeDef` (id = `st-<KEY>`) para pruebas unitarias de
 * las reglas puras.
 */
export const TEST_SCHOLARSHIP_TYPES: Record<string, ScholarshipTypeDef> = Object.fromEntries(
  DEFAULT_SCHOLARSHIP_TYPES.map((t) => [
    t.key,
    { ...t, id: `st-${t.key}`, description: null, maxRecipients: null, active: true },
  ]),
);

/** Enlace oferta ↔ tipo sin override. */
export function testLink(
  key: string,
  override: Partial<Omit<OfferScholarshipTypeLink, 'scholarshipType'>> & {
    active?: boolean;
  } = {},
): OfferScholarshipTypeLink {
  const { active, ...rest } = override;
  const type = TEST_SCHOLARSHIP_TYPES[key];
  return {
    minPercent: null,
    maxPercent: null,
    sortOrder: null,
    maxRecipients: null,
    ...rest,
    scholarshipType: { ...type, active: active ?? type.active },
  };
}
