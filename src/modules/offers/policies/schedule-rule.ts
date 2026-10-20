import { DateTime } from 'luxon';
import { z } from 'zod';
import { OFFICIAL_TIMEZONE } from '../../../common/utils/time';

/**
 * Regla de horario de una oferta (HU-27 paso 3 / HU-29), guardada en `Offer.scheduleRule` (JSON).
 * Las horas son SIEMPRE hora oficial CDMX (America/Mexico_City); la API devuelve además los
 * instantes UTC de la primera sesión para que el frontend convierta a la zona del visitante.
 *
 * @example { weekdays: [6, 7], startTime: '10:00', endTime: '13:00', excludedDates: ['2026-12-19'] }
 */
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const scheduleRuleSchema = z
  .object({
    /** Días ISO: 1 = lunes … 7 = domingo. */
    weekdays: z
      .array(z.number().int().min(1).max(7))
      .min(1)
      .refine((days) => new Set(days).size === days.length, 'weekdays no debe repetir días'),
    /** Hora de inicio en CDMX, "HH:mm". */
    startTime: z.string().regex(TIME),
    /** Hora de fin en CDMX, "HH:mm" (posterior al inicio, mismo día). */
    endTime: z.string().regex(TIME),
    /** Fechas (CDMX) que se omiten sin reprogramar (recesos manuales, HU-29). */
    excludedDates: z
      .array(z.string().regex(DATE))
      .default([])
      .refine((d) => new Set(d).size === d.length, 'excludedDates no debe repetir fechas'),
    /** Omite también los festivos oficiales de México (precargados, HU-29). */
    excludeMexicanHolidays: z.boolean().default(false),
  })
  .refine((rule) => rule.endTime > rule.startTime, {
    message: 'endTime debe ser posterior a startTime',
    path: ['endTime'],
  });

export type ScheduleRule = z.output<typeof scheduleRuleSchema>;
export type ScheduleRuleInput = z.input<typeof scheduleRuleSchema>;

/** Valida y normaliza una regla (lanza ZodError si no es válida). */
export function parseScheduleRule(value: unknown): ScheduleRule {
  return scheduleRuleSchema.parse(value);
}

/** Igual que `parseScheduleRule` pero devuelve null si el JSON guardado no es válido. */
export function safeParseScheduleRule(value: unknown): ScheduleRule | null {
  if (value === null || value === undefined) return null;
  const result = scheduleRuleSchema.safeParse(value);
  return result.success ? result.data : null;
}

/** Minutos de una ocurrencia de la regla (endTime − startTime). */
export function ruleSlotMinutes(rule: Pick<ScheduleRule, 'startTime' | 'endTime'>): number {
  const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return toMinutes(rule.endTime) - toMinutes(rule.startTime);
}

/** Fecha (YYYY-MM-DD) de un instante en la zona oficial. */
export function cdmxDate(instant: Date, zone: string = OFFICIAL_TIMEZONE): string {
  return DateTime.fromJSDate(instant, { zone: 'utc' }).setZone(zone).toISODate()!;
}

/** Instantes UTC de inicio y fin de la regla en una fecha CDMX dada. */
export function slotOnDate(
  date: string,
  rule: Pick<ScheduleRule, 'startTime' | 'endTime'>,
  zone: string = OFFICIAL_TIMEZONE,
): { startsAt: Date; endsAt: Date } {
  const day = DateTime.fromISO(date, { zone });
  const at = (time: string) =>
    day
      .set({ hour: Number(time.slice(0, 2)), minute: Number(time.slice(3, 5)) })
      .toUTC()
      .toJSDate();
  return { startsAt: at(rule.startTime), endsAt: at(rule.endTime) };
}

/**
 * Primera ocurrencia de la regla en o después de `from` (fecha CDMX), saltando fechas excluidas.
 * La usa el catálogo para dar los instantes UTC de referencia del horario (hora CDMX + local).
 */
export function firstOccurrence(
  rule: ScheduleRule,
  from: string,
  zone: string = OFFICIAL_TIMEZONE,
): { date: string; startsAt: Date; endsAt: Date } | null {
  const excluded = new Set(rule.excludedDates);
  let day = DateTime.fromISO(from, { zone });
  if (!day.isValid) return null;
  for (let i = 0; i < 60; i++, day = day.plus({ days: 1 })) {
    const date = day.toISODate();
    if (rule.weekdays.includes(day.weekday) && !excluded.has(date)) {
      return { date, ...slotOnDate(date, rule, zone) };
    }
  }
  return null;
}
