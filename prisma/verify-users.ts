/**
 * CLI: marca como verificado el correo de cuentas que no pueden recibir el código OTP (p. ej. las
 * cuentas del equipo creadas antes de tener buzón). Equivale a `POST /admin/users/:id/verify-email`
 * para cuando todavía nadie puede entrar al panel.
 *
 *   pnpm users:verify --email admin1@escuela.org --email finanzas1@escuela.org
 *   pnpm users:verify --domain escuela.org --staff-only          # todo el equipo de ese dominio
 *   pnpm users:verify --domain escuela.org --staff-only --dry-run # solo muestra a quién afectaría
 *   # Producción (imagen compilada, p. ej. `railway run` o la shell del servicio):
 *   node dist/seed/prisma/verify-users.js --domain escuela.org --staff-only
 *
 * PENDING_VERIFICATION → ACTIVE (DISABLED se respeta), invalida los OTP pendientes y deja registro
 * en la auditoría (`user.verify-email`, actor "cli").
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma, type Role } from '../src/generated/prisma/client';

function args(name: string): string[] {
  const values: string[] = [];
  process.argv.forEach((value, index) => {
    const next = process.argv[index + 1];
    if (value === `--${name}` && next) values.push(next);
  });
  return values;
}

const flag = (name: string): boolean => process.argv.includes(`--${name}`);

async function main(): Promise<void> {
  const emails = args('email').map((e) => e.trim().toLowerCase());
  const domain = args('domain')[0]?.trim().toLowerCase().replace(/^@/, '');
  const staffOnly = flag('staff-only');
  const dryRun = flag('dry-run');
  if (emails.length === 0 && !domain) {
    throw new Error(
      'Uso: pnpm users:verify --email <correo> [--email <correo>...] | --domain <dominio> [--staff-only] [--dry-run]',
    );
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL no está definida');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const where: Prisma.UserWhereInput = {
      emailVerifiedAt: null,
      OR: [
        ...(emails.length ? [{ email: { in: emails } }] : []),
        ...(domain ? [{ email: { endsWith: `@${domain}` } }] : []),
      ],
      ...(staffOnly ? { roles: { hasSome: STAFF_ROLES } } : {}),
    };
    const users = await prisma.user.findMany({
      where,
      select: { id: true, email: true, status: true, roles: true },
      orderBy: { email: 'asc' },
    });

    if (users.length === 0) {
      console.log('No hay cuentas sin verificar que coincidan.');
      return;
    }
    for (const u of users) {
      console.log(`${dryRun ? '[dry-run] ' : ''}${u.email} (${u.status}; ${u.roles.join(', ')})`);
    }
    if (dryRun) {
      console.log(`${users.length} cuenta(s) se verificarían. Quita --dry-run para aplicarlo.`);
      return;
    }

    const now = new Date();
    for (const u of users) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: u.id },
          data: { emailVerifiedAt: now, status: u.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE' },
        }),
        prisma.otpCode.updateMany({
          where: { userId: u.id, purpose: 'EMAIL_VERIFICATION', consumedAt: null },
          data: { consumedAt: now },
        }),
        prisma.adminAuditLog.create({
          data: {
            actorId: null,
            actorEmail: 'cli',
            action: 'user.verify-email',
            entityType: 'User',
            entityId: u.id,
            summary: `Verificó manualmente el correo de ${u.email} (CLI).`,
          },
        }),
      ]);
    }
    console.log(`${users.length} cuenta(s) verificadas.`);
    const notFound = emails.filter((e) => !users.some((u) => u.email === e));
    if (notFound.length) {
      console.log(`Sin cambios (no existen o ya estaban verificadas): ${notFound.join(', ')}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

const STAFF_ROLES: Role[] = [
  'SUPER_ADMIN',
  'ACADEMIC_COORDINATOR',
  'REVIEW_COMMITTEE',
  'REVIEW_DECIDER',
  'FOLLOW_UP',
  'FINANCE',
];

main().catch((error: unknown) => {
  console.error(
    'No se pudieron verificar las cuentas:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
