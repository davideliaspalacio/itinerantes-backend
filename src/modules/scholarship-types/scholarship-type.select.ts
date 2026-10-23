import type { Prisma } from '../../generated/prisma/client';

/** Columnas de un tipo de beca que usan las reglas (`ScholarshipTypeDef`). */
export const SCHOLARSHIP_TYPE_SELECT = {
  id: true,
  key: true,
  name: true,
  description: true,
  minPercent: true,
  maxPercent: true,
  requiresInterview: true,
  active: true,
  sortOrder: true,
} as const satisfies Prisma.ScholarshipTypeSelect;

/**
 * Relación `Offer.scholarshipTypes` lista para `select`/`include` de una oferta
 * (→ `OfferScholarshipTypeLink[]`).
 */
export const OFFER_SCHOLARSHIP_TYPES_RELATION = {
  select: {
    minPercent: true,
    maxPercent: true,
    sortOrder: true,
    scholarshipType: { select: SCHOLARSHIP_TYPE_SELECT },
  },
} as const satisfies Prisma.Offer$scholarshipTypesArgs;
