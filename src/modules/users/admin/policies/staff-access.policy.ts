import { isEmail } from 'class-validator';
import { BUSINESS_RULES } from '../../../../config/business-rules';
import type { Role } from '../../../../generated/prisma/client';
import { normalizeEmail, passwordIssues } from '../../../auth/auth.policy';

/**
 * Reglas puras de la gestión de cuentas del equipo (Fase 06) y del primer SUPER_ADMIN.
 */

/** PARTICIPANT siempre se conserva (todo el equipo también puede usar el portal); sin duplicados. */
export function normalizeRoles(roles: readonly Role[]): Role[] {
  return ['PARTICIPANT', ...new Set(roles.filter((r) => r !== 'PARTICIPANT'))];
}

export type StaffAccessIssue = 'ADMIN_SELF_ACTION' | 'ADMIN_LAST_SUPER_ADMIN';

export interface StaffChangeInput {
  actorId: string;
  targetId: string;
  /** Roles y estado actuales de la cuenta afectada. */
  currentRoles: readonly Role[];
  currentlyActive: boolean;
  /** Roles y estado después del cambio. */
  nextRoles: readonly Role[];
  nextActive: boolean;
  /** SUPER_ADMIN activos en total (incluida la cuenta afectada si lo es). */
  activeSuperAdmins: number;
}

/**
 * ¿Se permite cambiar roles/estado de una cuenta?
 * - Nadie se quita a sí mismo SUPER_ADMIN ni deshabilita su propia cuenta (evita bloquearse).
 * - Siempre debe quedar al menos un SUPER_ADMIN activo.
 */
export function staffChangeIssue(input: StaffChangeInput): StaffAccessIssue | null {
  const wasSuper = input.currentRoles.includes('SUPER_ADMIN') && input.currentlyActive;
  const staysSuper = input.nextRoles.includes('SUPER_ADMIN') && input.nextActive;
  const self = input.actorId === input.targetId;
  if (self && (!input.nextActive || (input.currentRoles.includes('SUPER_ADMIN') && !staysSuper))) {
    return 'ADMIN_SELF_ACTION';
  }
  if (wasSuper && !staysSuper && input.activeSuperAdmins <= 1) return 'ADMIN_LAST_SUPER_ADMIN';
  return null;
}

// -------------------------------------------------------------------------------------------------
// Primer SUPER_ADMIN (BOOTSTRAP_ADMIN_* / pnpm admin:create)
// -------------------------------------------------------------------------------------------------

export interface BootstrapAdminInput {
  email?: string | null;
  password?: string | null;
  fullName?: string | null;
}

/**
 * Valida los datos del primer administrador. `requirePassword`: la contraseña es obligatoria cuando
 * hay que CREAR la cuenta (para promover una cuenta existente no se usa ni se cambia).
 * Contraseña: mínimo BOOTSTRAP_ADMIN_PASSWORD_MIN_LENGTH, con letra y número.
 */
export function bootstrapAdminIssues(
  input: BootstrapAdminInput,
  options: { requirePassword: boolean },
): string[] {
  const issues: string[] = [];
  const email = input.email ? normalizeEmail(input.email) : '';
  if (!email || !isEmail(email)) issues.push('BOOTSTRAP_ADMIN_EMAIL debe ser un correo válido.');
  if (options.requirePassword) {
    const password = input.password ?? '';
    if (password.length < BUSINESS_RULES.BOOTSTRAP_ADMIN_PASSWORD_MIN_LENGTH) {
      issues.push(
        `BOOTSTRAP_ADMIN_PASSWORD debe tener al menos ${BUSINESS_RULES.BOOTSTRAP_ADMIN_PASSWORD_MIN_LENGTH} caracteres.`,
      );
    }
    const other = passwordIssues(password).filter((i) => i !== 'TOO_SHORT');
    if (other.includes('MISSING_LETTER') || other.includes('MISSING_DIGIT')) {
      issues.push('BOOTSTRAP_ADMIN_PASSWORD debe incluir al menos una letra y un número.');
    }
    if (other.includes('TOO_LONG')) issues.push('BOOTSTRAP_ADMIN_PASSWORD es demasiado larga.');
  }
  return issues;
}

/** Username válido derivado del correo (`laura.coord` → `laura.coord`), con sufijo para hacerlo único. */
export function usernameFromEmail(email: string, suffix = ''): string {
  const base = normalizeEmail(email)
    .split('@')[0]
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, BUSINESS_RULES.USERNAME_MAX_LENGTH - suffix.length);
  const padded = base.length >= BUSINESS_RULES.USERNAME_MIN_LENGTH ? base : `admin${base}`;
  return `${padded}${suffix}`.slice(0, BUSINESS_RULES.USERNAME_MAX_LENGTH);
}
