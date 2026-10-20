import { applyPercentDiscount, percentOf, type Currency } from '../../../common/utils/money';
import { BUSINESS_RULES } from '../../../config/business-rules';
import type { OfferType, ScholarshipLevel } from '../../../generated/prisma/client';

/** Orden canónico de los niveles (menor a mayor porcentaje). */
export const SCHOLARSHIP_LEVEL_ORDER: readonly ScholarshipLevel[] = [
  'AGUA_VIVA',
  'RIOS_VIVOS',
  'AGUAS_LIBRES',
  'CENOTES_VIVOS',
  'SPECIAL',
];

export interface AmountRange {
  minAmountCents: number;
  maxAmountCents: number;
  currency: Currency;
}

export interface ScholarshipLevelEstimate {
  level: ScholarshipLevel;
  label: string;
  minPercent: number;
  maxPercent: number;
  /** > 70%: entrevista por Zoom (HU-19). */
  requiresInterview: boolean;
  /** Monto estimado de la beca (descuento). null si la oferta no tiene precio en la moneda. */
  estimatedScholarship: AmountRange | null;
  /** Saldo estimado a pagar tras la beca. */
  estimatedBalance: AmountRange | null;
}

/**
 * La beca solo existe en diplomados NAS con beca habilitada y al menos un nivel (HU-15/16/19/27).
 * Nunca en cursos, talleres, eventos, convocatorias ni ofertas Moodle.
 */
export function offersScholarship(offer: {
  type: OfferType;
  origin: 'NAS' | 'MOODLE';
  scholarshipEnabled: boolean;
  scholarshipLevels: readonly ScholarshipLevel[];
}): boolean {
  return (
    offer.type === 'DIPLOMA' &&
    offer.origin === 'NAS' &&
    offer.scholarshipEnabled &&
    offer.scholarshipLevels.length > 0
  );
}

/** Rango de porcentajes de los niveles habilitados (badge "10%–80%"). */
export function scholarshipPercentRange(
  levels: readonly ScholarshipLevel[],
): { minPercent: number; maxPercent: number } | null {
  if (levels.length === 0) return null;
  const defs = levels.map((level) => BUSINESS_RULES.SCHOLARSHIP_LEVELS[level]);
  return {
    minPercent: Math.min(...defs.map((d) => d.minPercent)),
    maxPercent: Math.max(...defs.map((d) => d.maxPercent)),
  };
}

/**
 * Niveles habilitados con su monto estimado en la moneda del visitante (HU-16 / HU-19: "el nivel
 * final lo asigna el equipo"). Redondeo half-up al centavo (`percentOf`).
 */
export function estimateScholarshipLevels(
  levels: readonly ScholarshipLevel[],
  priceCents: number | null,
  currency: Currency,
): ScholarshipLevelEstimate[] {
  const enabled = SCHOLARSHIP_LEVEL_ORDER.filter((level) => levels.includes(level));
  return enabled.map((level) => {
    const def = BUSINESS_RULES.SCHOLARSHIP_LEVELS[level];
    const hasPrice = priceCents !== null && priceCents > 0;
    return {
      level,
      label: def.label,
      minPercent: def.minPercent,
      maxPercent: def.maxPercent,
      requiresInterview:
        def.maxPercent > BUSINESS_RULES.SCHOLARSHIP_INTERVIEW_REQUIRED_ABOVE_PERCENT,
      estimatedScholarship: hasPrice
        ? {
            minAmountCents: percentOf(priceCents, def.minPercent),
            maxAmountCents: percentOf(priceCents, def.maxPercent),
            currency,
          }
        : null,
      estimatedBalance: hasPrice
        ? {
            // Mayor porcentaje → menor saldo.
            minAmountCents: applyPercentDiscount(priceCents, def.maxPercent),
            maxAmountCents: applyPercentDiscount(priceCents, def.minPercent),
            currency,
          }
        : null,
    };
  });
}
