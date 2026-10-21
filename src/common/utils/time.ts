import { DateTime, IANAZone } from 'luxon';
import { BUSINESS_RULES } from '../../config/business-rules';

/**
 * Utilidades de tiempo.
 *
 * Reglas (docs/ARCHITECTURE.md):
 * - En BD y en la API todo se guarda/devuelve en UTC (ISO 8601 con `Z`).
 * - La hora oficial de las actividades es CDMX (`America/Mexico_City`). Los horarios que captura el
 *   equipo (p. ej. "sáb 10:00–13:00", HU-27/HU-29) están en hora CDMX y se convierten a UTC aquí.
 * - El frontend convierte UTC a la zona del usuario. Nunca uses `new Date(string sin zona)`.
 */

export const OFFICIAL_TIMEZONE = BUSINESS_RULES.OFFICIAL_TIMEZONE;

/** Instante actual (punto único para poder simularlo en pruebas con jest.useFakeTimers). */
export function nowUtc(): Date {
  return new Date();
}

/** `true` si es una zona IANA válida (`America/Bogota`, `Europe/Madrid`, ...). */
export function isValidTimezone(zone: string): boolean {
  return IANAZone.isValidZone(zone);
}

/** Serializa un instante a ISO 8601 UTC: `2026-11-07T16:00:00.000Z`. */
export function toIsoUtc(date: Date): string {
  return date.toISOString();
}

/**
 * Convierte fecha + hora LOCAL de una zona (por defecto CDMX) a un instante UTC.
 *
 * @example zonedToUtc('2026-11-07', '10:00') → 2026-11-07T16:00:00.000Z (CDMX = UTC−6)
 * @throws Error si la fecha/hora o la zona no son válidas.
 */
export function zonedToUtc(date: string, time: string, zone: string = OFFICIAL_TIMEZONE): Date {
  const dt = DateTime.fromISO(`${date}T${time}`, { zone });
  if (!dt.isValid) {
    throw new Error(`Fecha/hora inválida: ${date} ${time} (${zone}): ${dt.invalidExplanation}`);
  }
  return dt.toUTC().toJSDate();
}

/** Atajo de `zonedToUtc` para la hora oficial CDMX. */
export function cdmxToUtc(date: string, time: string): Date {
  return zonedToUtc(date, time, OFFICIAL_TIMEZONE);
}

/** Representa un instante UTC en una zona (Luxon DateTime) para cálculos de calendario. */
export function utcToZoned(date: Date, zone: string = OFFICIAL_TIMEZONE): DateTime {
  return DateTime.fromJSDate(date, { zone: 'utc' }).setZone(zone);
}

/** Atajo de `utcToZoned` para CDMX. */
export function utcToCdmx(date: Date): DateTime {
  return utcToZoned(date, OFFICIAL_TIMEZONE);
}

/**
 * Formatea un instante en una zona. Formatos Luxon: https://moment.github.io/luxon/#/formatting
 * @example formatInZone(d, 'America/Mexico_City', "yyyy-MM-dd HH:mm") → '2026-11-07 10:00'
 */
export function formatInZone(
  date: Date,
  zone: string = OFFICIAL_TIMEZONE,
  format = "yyyy-MM-dd'T'HH:mm:ssZZ",
): string {
  return utcToZoned(date, zone).toFormat(format);
}

/** Inicio del día (00:00) en la zona dada, como instante UTC. */
export function startOfDayInZone(date: Date, zone: string = OFFICIAL_TIMEZONE): Date {
  return utcToZoned(date, zone).startOf('day').toUTC().toJSDate();
}

/** Fin del día (23:59:59.999) en la zona dada, como instante UTC. */
export function endOfDayInZone(date: Date, zone: string = OFFICIAL_TIMEZONE): Date {
  return utcToZoned(date, zone).endOf('day').toUTC().toJSDate();
}

/** Suma días naturales respetando el calendario de la zona (útil para plazos de "7 días"). */
export function addDaysInZone(date: Date, days: number, zone: string = OFFICIAL_TIMEZONE): Date {
  return utcToZoned(date, zone).plus({ days }).toUTC().toJSDate();
}

/** Suma meses de calendario en la zona (31-ene + 1 mes → 28/29-feb). Cuotas mensuales (HU-24). */
export function addMonthsInZone(
  date: Date,
  months: number,
  zone: string = OFFICIAL_TIMEZONE,
): Date {
  return utcToZoned(date, zone).plus({ months }).toUTC().toJSDate();
}

/** Suma minutos/horas a un instante (independiente de zona). */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function addHours(date: Date, hours: number): Date {
  return addMinutes(date, hours * 60);
}
