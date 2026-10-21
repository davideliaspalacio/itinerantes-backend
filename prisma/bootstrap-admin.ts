/**
 * Primer SUPER_ADMIN (Fase 06). Lo usan:
 * - el seed (`seedBootstrapAdmin`), en cada arranque, con BOOTSTRAP_ADMIN_EMAIL / _PASSWORD / _NAME:
 *   solo actúa si NO hay ningún SUPER_ADMIN activo (idempotente y seguro de dejar configurado);
 * - el CLI `pnpm admin:create` (prisma/create-admin.ts), que crea o promueve aunque ya exista otro.
 *
 * Nunca cambia la contraseña de una cuenta existente: si el correo ya está registrado, solo le agrega
 * el rol SUPER_ADMIN (y la activa si estaba pendiente de verificar).
 */
import { randomInt } from 'node:crypto';
import * as argon2 from 'argon2';
import type { PrismaClient } from '../src/generated/prisma/client';
import { normalizeEmail } from '../src/modules/auth/auth.policy';
import {
  bootstrapAdminIssues,
  type BootstrapAdminInput,
  normalizeRoles,
  usernameFromEmail,
} from '../src/modules/users/admin/policies/staff-access.policy';

export type BootstrapAdminResult =
  'NOT_CONFIGURED' | 'SKIPPED_ADMIN_EXISTS' | 'ALREADY_SUPER_ADMIN' | 'PROMOTED' | 'CREATED';

export interface BootstrapOptions {
  /** CLI: crea/promueve aunque ya exista otro SUPER_ADMIN activo. */
  force: boolean;
}

export async function bootstrapSuperAdmin(
  prisma: PrismaClient,
  input: BootstrapAdminInput,
  options: BootstrapOptions,
): Promise<BootstrapAdminResult> {
  if (!input.email?.trim()) return 'NOT_CONFIGURED';
  const formatIssues = bootstrapAdminIssues(input, { requirePassword: false });
  if (formatIssues.length > 0) throw new Error(formatIssues.join(' '));
  const email = normalizeEmail(input.email);

  if (!options.force) {
    const admins = await prisma.user.count({
      where: { status: 'ACTIVE', roles: { has: 'SUPER_ADMIN' } },
    });
    if (admins > 0) return 'SKIPPED_ADMIN_EXISTS';
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.roles.includes('SUPER_ADMIN') && existing.status === 'ACTIVE') {
      return 'ALREADY_SUPER_ADMIN';
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        roles: normalizeRoles([...existing.roles, 'SUPER_ADMIN']),
        status: 'ACTIVE',
        emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
      },
    });
    return 'PROMOTED';
  }

  const issues = bootstrapAdminIssues(input, { requirePassword: true });
  if (issues.length > 0) throw new Error(issues.join(' '));
  let username = usernameFromEmail(email);
  for (let attempt = 0; await prisma.user.findUnique({ where: { username } }); attempt++) {
    if (attempt > 20) throw new Error('No se pudo generar un username único.');
    username = usernameFromEmail(email, String(randomInt(10, 10_000)));
  }
  await prisma.user.create({
    data: {
      email,
      username,
      fullName: input.fullName?.trim() || 'Administración',
      passwordHash: await argon2.hash(input.password!, { type: argon2.argon2id }),
      // Datos de perfil mínimos (el admin los completa en su perfil, HU-14).
      phoneCountryCode: '+52',
      phoneNumber: '',
      countryCode: 'MX',
      divisionName: '',
      municipalityName: '',
      timezone: 'America/Mexico_City',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: normalizeRoles(['SUPER_ADMIN']),
    },
  });
  return 'CREATED';
}

const MESSAGES: Record<BootstrapAdminResult, string> = {
  NOT_CONFIGURED: 'BOOTSTRAP_ADMIN_EMAIL vacío: no se crea ningún administrador.',
  SKIPPED_ADMIN_EXISTS: 'Ya existe un SUPER_ADMIN activo: BOOTSTRAP_ADMIN_* se ignora.',
  ALREADY_SUPER_ADMIN: 'La cuenta ya es SUPER_ADMIN activa.',
  PROMOTED: 'Cuenta existente promovida a SUPER_ADMIN (su contraseña no cambió).',
  CREATED: 'SUPER_ADMIN creado.',
};

export function bootstrapMessage(result: BootstrapAdminResult, email?: string | null): string {
  return `${MESSAGES[result]}${email && result !== 'NOT_CONFIGURED' ? ` (${normalizeEmail(email)})` : ''}`;
}
