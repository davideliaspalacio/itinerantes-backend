import { randomInt } from 'node:crypto';
import { sha256Hex } from '../../../common/utils/crypto';
import { BUSINESS_RULES } from '../../../config/business-rules';

/**
 * Códigos de acceso Moodle (HU-25): XXXX-XXXX, un solo uso, vigentes hasta el fin de la cohorte.
 * Solo se guarda el hash (como los OTP). Reglas PURAS (salvo la generación aleatoria).
 */

const ALPHABET = BUSINESS_RULES.MOODLE_ACCESS_CODE_ALPHABET;
const GROUP = BUSINESS_RULES.MOODLE_ACCESS_CODE_GROUP_LENGTH;
const CODE_PATTERN = new RegExp(`^[${ALPHABET}]{${GROUP}}-[${ALPHABET}]{${GROUP}}$`);

/** "  ab12-cd34 " → "AB12-CD34"; "AB12CD34" → "AB12-CD34". null si no tiene el formato. */
export function normalizeAccessCode(input: string): string | null {
  const compact = input.toUpperCase().replace(/[\s-]/g, '');
  if (compact.length !== GROUP * 2) return null;
  const code = `${compact.slice(0, GROUP)}-${compact.slice(GROUP)}`;
  return CODE_PATTERN.test(code) ? code : null;
}

export function hashAccessCode(normalizedCode: string): string {
  return sha256Hex(`moodle-access:${normalizedCode}`);
}

/** Últimos 4 caracteres (el equipo identifica el código sin verlo completo). */
export function accessCodeHint(normalizedCode: string): string {
  return normalizedCode.slice(-4);
}

export function generateAccessCode(): string {
  const pick = () =>
    Array.from({ length: GROUP }, () => ALPHABET[randomInt(0, ALPHABET.length)]).join('');
  return `${pick()}-${pick()}`;
}

export type AccessCodeDecision =
  | { ok: true }
  | { ok: false; code: 'MOODLE_CODE_INVALID' | 'MOODLE_CODE_USED' | 'MOODLE_CODE_EXPIRED' };

export function decideAccessCode(
  record: { usedAt: Date | null; expiresAt: Date | null; offerOrigin: string } | null,
  now: Date,
): AccessCodeDecision {
  if (!record || record.offerOrigin !== 'MOODLE') return { ok: false, code: 'MOODLE_CODE_INVALID' };
  if (record.usedAt) return { ok: false, code: 'MOODLE_CODE_USED' };
  if (record.expiresAt && record.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, code: 'MOODLE_CODE_EXPIRED' };
  }
  return { ok: true };
}
