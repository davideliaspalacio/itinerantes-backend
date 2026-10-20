import { BUSINESS_RULES } from '../../config/business-rules';

/**
 * Utilidades de dinero. Reglas (docs/ARCHITECTURE.md):
 * - Montos SIEMPRE en centavos enteros (`amountCents`) + `currency`. Nunca floats.
 * - MXN y USD nunca se suman ni se convierten (precios fijos por moneda).
 */

export const CURRENCIES = BUSINESS_RULES.SUPPORTED_CURRENCIES;
export type Currency = (typeof CURRENCIES)[number];

export interface Money {
  amountCents: number;
  currency: Currency;
}

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

function assertCents(amountCents: number): void {
  if (!Number.isSafeInteger(amountCents)) {
    throw new Error(`El monto debe ser un entero de centavos: ${amountCents}`);
  }
}

/** Crea un Money validando que el monto sea entero. */
export function money(amountCents: number, currency: Currency): Money {
  assertCents(amountCents);
  return { amountCents, currency };
}

/**
 * Convierte un monto decimal ("10200.50" o 10200.5) a centavos sin errores de punto flotante.
 * Acepta como máximo 2 decimales.
 */
export function toCents(amount: string | number): number {
  const text = typeof amount === 'number' ? amount.toString() : amount.trim();
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) {
    throw new Error(`Monto inválido: "${text}" (usa hasta 2 decimales)`);
  }
  const [, sign, whole, fraction = ''] = match;
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return sign ? -cents : cents;
}

/** Centavos → texto decimal con 2 decimales: 1020050 → "10200.50". */
export function fromCents(amountCents: number): string {
  assertCents(amountCents);
  const sign = amountCents < 0 ? '-' : '';
  const abs = Math.abs(amountCents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Suma montos de la MISMA moneda. Lanza si se mezclan monedas. */
export function addMoney(...items: Money[]): Money {
  if (items.length === 0) throw new Error('addMoney requiere al menos un monto');
  const currency = items[0].currency;
  let total = 0;
  for (const item of items) {
    if (item.currency !== currency) {
      throw new Error(`No se pueden sumar ${currency} y ${item.currency}`);
    }
    total += item.amountCents;
  }
  return money(total, currency);
}

/** Resta b de a (misma moneda). */
export function subtractMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`No se pueden restar ${a.currency} y ${b.currency}`);
  }
  return money(a.amountCents - b.amountCents, a.currency);
}

/**
 * Porcentaje de un monto en centavos, redondeado al centavo (half-up).
 * @example percentOf(1020000, 50) → 510000
 */
export function percentOf(amountCents: number, percent: number): number {
  assertCents(amountCents);
  return Math.round((amountCents * percent) / 100);
}

/**
 * Saldo tras aplicar un porcentaje de descuento (p. ej. beca, HU-23).
 * @example applyPercentDiscount(1020000, 50) → 510000 (10,200 MXN con beca 50% → 5,100 MXN)
 */
export function applyPercentDiscount(amountCents: number, percent: number): number {
  return amountCents - percentOf(amountCents, percent);
}

/**
 * Divide un total en N cuotas iguales; los centavos de ajuste van en la ÚLTIMA (HU-24).
 * @example splitInstallments(1000000, 3) → [333333, 333333, 333334]
 */
export function splitInstallments(totalCents: number, count: number): number[] {
  assertCents(totalCents);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`Número de cuotas inválido: ${count}`);
  }
  const base = Math.floor(totalCents / count);
  const parts = Array.from({ length: count }, () => base);
  parts[count - 1] = totalCents - base * (count - 1);
  return parts;
}

/** Formato legible (solo para correos/PDF; la API devuelve centavos): "$10,200.00 MXN". */
export function formatMoney({ amountCents, currency }: Money, locale = 'es-MX'): string {
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
  return `$${formatted} ${currency}`;
}

/**
 * Moneda de cobro según el país del perfil (HU-14, HU-22): México → MXN; resto → USD.
 * Afecta solo pagos nuevos; nunca convierte montos existentes.
 */
export function currencyForCountry(countryCode: string | null | undefined): Currency {
  return countryCode?.toUpperCase() === BUSINESS_RULES.MXN_COUNTRY_CODE ? 'MXN' : 'USD';
}
