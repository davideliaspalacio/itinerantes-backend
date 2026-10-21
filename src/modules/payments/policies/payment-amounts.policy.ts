import { type Currency, splitInstallments } from '../../../common/utils/money';
import { addMonthsInZone } from '../../../common/utils/time';
import { BUSINESS_RULES } from '../../../config/business-rules';

/**
 * Montos y calendario de cuotas (HU-22, 23, 24). Reglas PURAS: el servidor calcula SIEMPRE lo que se
 * cobra (nunca confía en montos del cliente). Dinero en centavos enteros + moneda.
 */

export interface PricedOffer {
  priceMxnCents: number | null;
  priceUsdCents: number | null;
}

/** Precio fijo de la oferta en la moneda de cobro (null si no tiene precio > 0 en esa moneda). */
export function offerPriceFor(offer: PricedOffer, currency: Currency): number | null {
  const cents = currency === 'MXN' ? offer.priceMxnCents : offer.priceUsdCents;
  return cents !== null && cents > 0 ? cents : null;
}

export interface InstallmentConfig {
  installmentsEnabled: boolean;
  /** Máximo de la oferta (HU-27: 2 a 4). */
  installmentsMax: number | null;
}

/** Números de cuotas permitidos por la oferta: [MIN .. min(MAX, máximo de la oferta)]. */
export function allowedInstallmentCounts(offer: InstallmentConfig): number[] {
  if (!offer.installmentsEnabled || !offer.installmentsMax) return [];
  const max = Math.min(offer.installmentsMax, BUSINESS_RULES.INSTALLMENTS_MAX);
  const counts: number[] = [];
  for (let n = BUSINESS_RULES.INSTALLMENTS_MIN; n <= max; n++) counts.push(n);
  return counts;
}

export interface ScheduledInstallment {
  sequence: number;
  amountCents: number;
  dueAt: Date;
}

/**
 * Calendario de cobros (HU-24): cuotas iguales, mensuales y sin recargo; los centavos de ajuste van
 * en la ÚLTIMA. La 1.ª vence en `firstDueAt` (se cobra al confirmar).
 * @example buildInstallmentSchedule(29_250, 3, hoy) → 9_750 / 9_750 / 9_750 ($292.50 USD en 3)
 */
export function buildInstallmentSchedule(
  totalCents: number,
  count: number,
  firstDueAt: Date,
  intervalMonths: number = BUSINESS_RULES.INSTALLMENT_INTERVAL_MONTHS,
): ScheduledInstallment[] {
  return splitInstallments(totalCents, count).map((amountCents, index) => ({
    sequence: index + 1,
    amountCents,
    dueAt: index === 0 ? firstDueAt : addMonthsInZone(firstDueAt, index * intervalMonths),
  }));
}

export const InstallmentOptionReason = {
  /** HU-24: "Última cuota antes del fin de la oferta". */
  LAST_INSTALLMENT_AFTER_END: 'LAST_INSTALLMENT_AFTER_END',
} as const;
export type InstallmentOptionReason =
  (typeof InstallmentOptionReason)[keyof typeof InstallmentOptionReason];

export interface InstallmentOption {
  count: number;
  available: boolean;
  reason: InstallmentOptionReason | null;
  schedule: ScheduledInstallment[];
}

/**
 * Opciones de cuotas para un total (chips de HU-24). Una opción no está disponible si su última
 * cuota caería en o después del fin de la oferta.
 */
export function installmentOptions(
  totalCents: number,
  offer: InstallmentConfig & { endsAt: Date | null },
  now: Date,
): InstallmentOption[] {
  return allowedInstallmentCounts(offer).map((count) => {
    const schedule = buildInstallmentSchedule(totalCents, count, now);
    const last = schedule[schedule.length - 1];
    const fits = !offer.endsAt || last.dueAt.getTime() < offer.endsAt.getTime();
    return {
      count,
      available: fits,
      reason: fits ? null : InstallmentOptionReason.LAST_INSTALLMENT_AFTER_END,
      schedule,
    };
  });
}

/** Folio legible del pago: PAG-000123. */
export function formatPaymentFolio(number: number): string {
  return `PAG-${String(number).padStart(6, '0')}`;
}

/** Recibo / correo: "Saldo tras beca", "Cuota 2 de 3", "Pago completo". */
export function paymentConceptLabel(input: {
  concept: 'FULL_PRICE' | 'BALANCE' | 'INSTALLMENT';
  applicationKind?: 'SCHOLARSHIP' | 'OPEN_CALL' | null;
  installment?: { sequence: number; count: number } | null;
}): string {
  switch (input.concept) {
    case 'FULL_PRICE':
      return 'Pago completo';
    case 'BALANCE':
      return input.applicationKind === 'OPEN_CALL' ? 'Pago de convocatoria' : 'Saldo tras beca';
    case 'INSTALLMENT':
      return input.installment
        ? `Cuota ${input.installment.sequence} de ${input.installment.count}`
        : 'Cuota';
  }
}
