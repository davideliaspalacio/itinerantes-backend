import { applyPercentDiscount, percentOf, type Currency } from '../../../common/utils/money';
import type { OfferType } from '../../../generated/prisma/client';
import {
  type OfferScholarshipTypeLink,
  type ScholarshipOption,
  scholarshipOptions,
  type ScholarshipTypeSummary,
  toScholarshipTypeSummary,
} from '../../scholarship-types/policies/scholarship-type.policy';

export interface AmountRange {
  minAmountCents: number;
  maxAmountCents: number;
  currency: Currency;
}

/** Tipo de beca habilitado en la oferta con su monto estimado (ficha y formulario). */
export interface ScholarshipTypeEstimate {
  scholarshipTypeId: string;
  /** Rango EFECTIVO de esta oferta. */
  scholarshipType: ScholarshipTypeSummary;
  description: string | null;
  /** Monto estimado de la beca (descuento). null si la oferta no tiene precio en la moneda. */
  estimatedScholarship: AmountRange | null;
  /** Saldo estimado a pagar tras la beca. */
  estimatedBalance: AmountRange | null;
}

/**
 * La beca solo existe en diplomados NAS con beca habilitada y al menos un tipo ACTIVO
 * (HU-15/16/19/27). Nunca en cursos, talleres, eventos, convocatorias ni ofertas Moodle.
 */
export function offersScholarship(offer: {
  type: OfferType;
  origin: 'NAS' | 'MOODLE';
  scholarshipEnabled: boolean;
  scholarshipTypes: readonly OfferScholarshipTypeLink[];
}): boolean {
  return (
    offer.type === 'DIPLOMA' &&
    offer.origin === 'NAS' &&
    offer.scholarshipEnabled &&
    offer.scholarshipTypes.some((link) => link.scholarshipType.active)
  );
}

/**
 * Tipos activos de la oferta con su monto estimado en la moneda del visitante (HU-16 / HU-19: "el
 * tipo final lo asigna el equipo"). Redondeo half-up al centavo (`percentOf`).
 */
export function estimateScholarshipTypes(
  links: readonly OfferScholarshipTypeLink[],
  priceCents: number | null,
  currency: Currency,
): ScholarshipTypeEstimate[] {
  return scholarshipOptions(links).map((option) => estimateOption(option, priceCents, currency));
}

function estimateOption(
  option: ScholarshipOption,
  priceCents: number | null,
  currency: Currency,
): ScholarshipTypeEstimate {
  const hasPrice = priceCents !== null && priceCents > 0;
  return {
    scholarshipTypeId: option.id,
    scholarshipType: toScholarshipTypeSummary(option),
    description: option.description,
    estimatedScholarship: hasPrice
      ? {
          minAmountCents: percentOf(priceCents, option.minPercent),
          maxAmountCents: percentOf(priceCents, option.maxPercent),
          currency,
        }
      : null,
    estimatedBalance: hasPrice
      ? {
          // Mayor porcentaje → menor saldo.
          minAmountCents: applyPercentDiscount(priceCents, option.maxPercent),
          maxAmountCents: applyPercentDiscount(priceCents, option.minPercent),
          currency,
        }
      : null,
  };
}
