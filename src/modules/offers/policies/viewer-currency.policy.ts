import { currencyForCountry, type Currency } from '../../../common/utils/money';
import { isValidTimezone } from '../../../common/utils/time';

/**
 * Moneda en que se muestran los precios (HU-15 / HU-16 / HU-22, Anexo A):
 * - Con sesión: país del perfil (México → MXN; resto → USD). Es la moneda de cobro.
 * - Sin sesión: se estima por la zona horaria del navegador (zona de México → MXN; resto → USD).
 * - Sin datos: USD (misma regla que un país distinto de México).
 */
export const CurrencySource = {
  PROFILE: 'PROFILE',
  TIMEZONE: 'TIMEZONE',
  DEFAULT: 'DEFAULT',
} as const;
export type CurrencySource = (typeof CurrencySource)[keyof typeof CurrencySource];

/** Zonas IANA de México (incluye alias legados). */
export const MEXICO_TIMEZONES: ReadonlySet<string> = new Set([
  'America/Mexico_City',
  'America/Cancun',
  'America/Merida',
  'America/Monterrey',
  'America/Matamoros',
  'America/Chihuahua',
  'America/Ciudad_Juarez',
  'America/Ojinaga',
  'America/Mazatlan',
  'America/Bahia_Banderas',
  'America/Hermosillo',
  'America/Tijuana',
  'America/Ensenada',
  'America/Santa_Isabel',
  'Mexico/BajaNorte',
  'Mexico/BajaSur',
  'Mexico/General',
]);

export function isMexicoTimezone(zone: string): boolean {
  return MEXICO_TIMEZONES.has(zone);
}

export interface ViewerCurrency {
  currency: Currency;
  source: CurrencySource;
}

export function resolveViewerCurrency(input: {
  profileCountryCode?: string | null;
  timezone?: string | null;
}): ViewerCurrency {
  if (input.profileCountryCode) {
    return { currency: currencyForCountry(input.profileCountryCode), source: 'PROFILE' };
  }
  const zone = input.timezone?.trim();
  if (zone && isValidTimezone(zone)) {
    return { currency: isMexicoTimezone(zone) ? 'MXN' : 'USD', source: 'TIMEZONE' };
  }
  return { currency: 'USD', source: 'DEFAULT' };
}
