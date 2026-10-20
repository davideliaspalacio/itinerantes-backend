import { BUSINESS_RULES } from '../../config/business-rules';

/**
 * Reglas puras de autenticación (HU-02, HU-04, HU-05): contraseña, bloqueo de login y rotación de
 * refresh tokens. Sin BD.
 */

// --- Contraseña (HU-02 / HU-05 / HU-14) --------------------------------------------------------

export const PASSWORD_HAS_LETTER = /\p{L}/u;
export const PASSWORD_HAS_DIGIT = /\d/;

export type PasswordIssue = 'TOO_SHORT' | 'TOO_LONG' | 'MISSING_LETTER' | 'MISSING_DIGIT';

/** Mínimo 8 caracteres, al menos una letra y un número. Devuelve los incumplimientos. */
export function passwordIssues(password: string): PasswordIssue[] {
  const issues: PasswordIssue[] = [];
  if (password.length < BUSINESS_RULES.PASSWORD_MIN_LENGTH) issues.push('TOO_SHORT');
  if (password.length > BUSINESS_RULES.PASSWORD_MAX_LENGTH) issues.push('TOO_LONG');
  if (!PASSWORD_HAS_LETTER.test(password)) issues.push('MISSING_LETTER');
  if (!PASSWORD_HAS_DIGIT.test(password)) issues.push('MISSING_DIGIT');
  return issues;
}

export function isValidPassword(password: string): boolean {
  return passwordIssues(password).length === 0;
}

// --- Bloqueo de login (HU-04) ------------------------------------------------------------------

export interface LoginLockRules {
  maxAttempts: number;
  lockoutMinutes: number;
}

export const LOGIN_LOCK_RULES: LoginLockRules = {
  maxAttempts: BUSINESS_RULES.LOGIN_MAX_ATTEMPTS,
  lockoutMinutes: BUSINESS_RULES.LOGIN_LOCKOUT_MINUTES,
};

export function isLoginLocked(lockedUntil: Date | null, now: Date): boolean {
  return !!lockedUntil && lockedUntil.getTime() > now.getTime();
}

/**
 * Tras un login fallido (`attempts` ya incluye el actual): si llega al máximo se bloquea y el
 * contador vuelve a 0.
 */
export function evaluateFailedLogin(
  attempts: number,
  now: Date,
  rules: LoginLockRules = LOGIN_LOCK_RULES,
): { attempts: number; lockedUntil: Date | null } {
  if (attempts >= rules.maxAttempts) {
    return { attempts: 0, lockedUntil: new Date(now.getTime() + rules.lockoutMinutes * 60_000) };
  }
  return { attempts, lockedUntil: null };
}

// --- Refresh tokens (rotación con detección de reuso) ------------------------------------------

export interface RefreshTokenState {
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
}

export type RefreshCheck =
  | 'VALID'
  | 'NOT_FOUND'
  | 'EXPIRED'
  /** Revocado por logout/reset: rechazar sin más. */
  | 'REVOKED'
  /** Ya fue rotado y alguien lo vuelve a usar → posible robo: revocar toda la familia. */
  | 'REUSED';

export function checkRefreshToken(token: RefreshTokenState | null, now: Date): RefreshCheck {
  if (!token) return 'NOT_FOUND';
  if (token.revokedAt) return token.replacedById ? 'REUSED' : 'REVOKED';
  if (token.expiresAt.getTime() <= now.getTime()) return 'EXPIRED';
  return 'VALID';
}

export interface RefreshTtlConfig {
  ttlDays: number;
  rememberTtlDays: number;
}

/** "Recordarme" (HU-04) alarga la vida del refresh token. */
export function refreshTokenExpiresAt(
  now: Date,
  rememberMe: boolean,
  config: RefreshTtlConfig,
): Date {
  const days = rememberMe ? config.rememberTtlDays : config.ttlDays;
  return new Date(now.getTime() + days * 86_400_000);
}

// --- Normalización ------------------------------------------------------------------------------

/** Email normalizado: sin espacios y en minúsculas. */
export function normalizeEmail(email: string): string {
  return email.replace(/\s+/g, '').toLowerCase();
}

/** Username normalizado: sin espacios alrededor y en minúsculas. */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/** Nombre: espacios colapsados y recortados. */
export function normalizeFullName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}
