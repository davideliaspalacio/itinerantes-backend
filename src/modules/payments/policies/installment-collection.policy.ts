import { addDaysInZone } from '../../../common/utils/time';
import { BUSINESS_RULES } from '../../../config/business-rules';

/**
 * Cobro automático de cuotas, reintentos y mora (HU-24 / HU-33). Reglas PURAS.
 *
 * - Cada cuota se cobra en su `dueAt` (PaymentIntent off-session con la tarjeta guardada).
 * - Si falla: hasta `INSTALLMENT_RETRY_ATTEMPTS` reintentos repartidos en
 *   `INSTALLMENT_RETRY_WINDOW_DAYS` desde el primer fallo ("3 reintentos en 7 días": días 3, 5 y 7).
 * - El plan pasa a "En mora" a los `DELINQUENCY_AFTER_DAYS` del primer cobro fallido sin regularizar.
 */

/** Días (desde el primer fallo) de cada reintento: 3 en 7 días → [3, 5, 7]. */
export function retryOffsetsDays(
  attempts: number = BUSINESS_RULES.INSTALLMENT_RETRY_ATTEMPTS,
  windowDays: number = BUSINESS_RULES.INSTALLMENT_RETRY_WINDOW_DAYS,
): number[] {
  if (attempts <= 0) return [];
  return Array.from({ length: attempts }, (_, i) =>
    Math.max(1, Math.ceil((windowDays * (i + 1)) / attempts)),
  );
}

/** Total de intentos de cobro por cuota: el original + los reintentos. */
export function maxChargeAttempts(): number {
  return 1 + BUSINESS_RULES.INSTALLMENT_RETRY_ATTEMPTS;
}

/**
 * Próximo reintento tras `attemptsMade` intentos fallidos (contando el original), o null si se
 * agotaron (queda en "Cobro fallido" hasta que la persona regularice o venza la mora).
 */
export function nextRetryAt(firstFailedAt: Date, attemptsMade: number): Date | null {
  const offsets = retryOffsetsDays();
  const retryIndex = attemptsMade - 1; // tras el 1.er intento → reintento 0
  if (retryIndex < 0 || retryIndex >= offsets.length) return null;
  return addDaysInZone(firstFailedAt, offsets[retryIndex]);
}

/** Fecha en que el plan pasa a "En mora". */
export function delinquencyDueAt(failedSince: Date): Date {
  return addDaysInZone(failedSince, BUSINESS_RULES.DELINQUENCY_AFTER_DAYS);
}

export function isDelinquent(failedSince: Date | null, now: Date): boolean {
  return !!failedSince && delinquencyDueAt(failedSince).getTime() <= now.getTime();
}

/** Días transcurridos desde el cobro fallido (HU-33 "días desde el cobro fallido"). */
export function daysSinceFailure(failedSince: Date | null, now: Date): number | null {
  if (!failedSince) return null;
  return Math.max(0, Math.floor((now.getTime() - failedSince.getTime()) / 86_400_000));
}

/** HU-06 / HU-13: aviso "cuota próxima" desde N días antes del cobro (y antes de que venza). */
export function isUpcomingNoticeDue(dueAt: Date, now: Date): boolean {
  const from = addDaysInZone(dueAt, -BUSINESS_RULES.INSTALLMENT_UPCOMING_NOTICE_DAYS);
  return from.getTime() <= now.getTime() && dueAt.getTime() > now.getTime();
}
