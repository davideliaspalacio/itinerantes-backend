import { BUSINESS_RULES } from '../../config/business-rules';

/**
 * Reglas puras del OTP (HU-03, HU-05). Sin BD: reciben el estado del código y el instante actual.
 *
 * - Código de N dígitos que expira tras `ttlMinutes`.
 * - Reenvío disponible `cooldownSeconds` después del último envío; reenviar invalida el anterior.
 * - `maxAttempts` intentos fallidos CONSECUTIVOS (se arrastran al reenviar) → bloqueo temporal de
 *   `lockoutMinutes` durante el cual no se puede verificar ni reenviar.
 */
export interface OtpRules {
  length: number;
  ttlMinutes: number;
  cooldownSeconds: number;
  maxAttempts: number;
  lockoutMinutes: number;
}

export const OTP_RULES: OtpRules = {
  length: BUSINESS_RULES.OTP_LENGTH,
  ttlMinutes: BUSINESS_RULES.OTP_TTL_MINUTES,
  cooldownSeconds: BUSINESS_RULES.OTP_RESEND_COOLDOWN_SECONDS,
  maxAttempts: BUSINESS_RULES.OTP_MAX_ATTEMPTS,
  lockoutMinutes: BUSINESS_RULES.OTP_LOCKOUT_MINUTES,
};

/** Estado mínimo de un código para evaluar las reglas. */
export interface OtpState {
  createdAt: Date;
  expiresAt: Date;
  attempts: number;
  lockedUntil: Date | null;
  verifiedAt: Date | null;
  consumedAt: Date | null;
  invalidatedAt: Date | null;
}

export type OtpUsability =
  | { status: 'USABLE' }
  | { status: 'LOCKED'; lockedUntil: Date }
  | { status: 'EXPIRED' }
  /** No hay código vigente (nunca se envió, ya se usó o se invalidó). */
  | { status: 'NONE' };

export function otpExpiresAt(now: Date, rules: OtpRules = OTP_RULES): Date {
  return new Date(now.getTime() + rules.ttlMinutes * 60_000);
}

export function resendAvailableAt(lastSentAt: Date, rules: OtpRules = OTP_RULES): Date {
  return new Date(lastSentAt.getTime() + rules.cooldownSeconds * 1000);
}

export function isLocked(otp: Pick<OtpState, 'lockedUntil'> | null, now: Date): boolean {
  return !!otp?.lockedUntil && otp.lockedUntil.getTime() > now.getTime();
}

/** ¿Se puede verificar el último código emitido? */
export function checkOtpUsability(latest: OtpState | null, now: Date): OtpUsability {
  if (!latest) return { status: 'NONE' };
  if (isLocked(latest, now)) return { status: 'LOCKED', lockedUntil: latest.lockedUntil! };
  if (latest.consumedAt || latest.invalidatedAt || latest.verifiedAt) return { status: 'NONE' };
  if (latest.expiresAt.getTime() <= now.getTime()) return { status: 'EXPIRED' };
  return { status: 'USABLE' };
}

export type FailedAttemptOutcome =
  | { locked: false; attempts: number; attemptsRemaining: number }
  | { locked: true; attempts: number; lockedUntil: Date };

/** Resultado de un intento fallido; `attempts` ya incluye el intento actual. */
export function evaluateFailedAttempt(
  attempts: number,
  now: Date,
  rules: OtpRules = OTP_RULES,
): FailedAttemptOutcome {
  if (attempts >= rules.maxAttempts) {
    return {
      locked: true,
      attempts,
      lockedUntil: new Date(now.getTime() + rules.lockoutMinutes * 60_000),
    };
  }
  return { locked: false, attempts, attemptsRemaining: rules.maxAttempts - attempts };
}

export type IssueDecision =
  | { allowed: true; carriedAttempts: number }
  | { allowed: false; reason: 'LOCKED'; until: Date }
  | { allowed: false; reason: 'COOLDOWN'; until: Date };

/**
 * ¿Se puede emitir (enviar/reenviar) un código nuevo?
 * - Bloqueado → no (ni reenviar, para que el bloqueo no se pueda saltar).
 * - Dentro del cooldown del último envío → no.
 * - Si no: sí, arrastrando los intentos fallidos consecutivos del código anterior, salvo que ese
 *   código se haya usado con éxito o ya haya cumplido un bloqueo.
 */
export function decideIssue(
  latest: OtpState | null,
  now: Date,
  rules: OtpRules = OTP_RULES,
): IssueDecision {
  if (!latest) return { allowed: true, carriedAttempts: 0 };
  if (isLocked(latest, now))
    return { allowed: false, reason: 'LOCKED', until: latest.lockedUntil! };
  const availableAt = resendAvailableAt(latest.createdAt, rules);
  if (availableAt.getTime() > now.getTime()) {
    return { allowed: false, reason: 'COOLDOWN', until: availableAt };
  }
  const carriedAttempts = latest.consumedAt || latest.lockedUntil ? 0 : latest.attempts;
  return { allowed: true, carriedAttempts };
}
