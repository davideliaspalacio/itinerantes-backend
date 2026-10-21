/**
 * CLI: crea (o promueve) un SUPER_ADMIN aunque ya exista otro. Fase 06, docs/DEPLOY.md.
 *
 *   pnpm admin:create --email admin@escuela.org --name "Laura Pérez"     # pide la contraseña en ADMIN_PASSWORD
 *   ADMIN_PASSWORD='…' pnpm admin:create --email admin@escuela.org
 *   # Producción (imagen compilada, p. ej. `railway run` o la shell del servicio):
 *   ADMIN_PASSWORD='…' node dist/seed/prisma/create-admin.js --email admin@escuela.org
 *
 * La contraseña NUNCA va como argumento (quedaría en el historial de la shell): se lee de
 * ADMIN_PASSWORD (o BOOTSTRAP_ADMIN_PASSWORD). Si el correo ya existe, solo se le agrega el rol (no
 * se cambia su contraseña).
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { bootstrapMessage, bootstrapSuperAdmin } from './bootstrap-admin';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const email = arg('email') ?? process.env.BOOTSTRAP_ADMIN_EMAIL;
  if (!email) {
    throw new Error(
      'Uso: pnpm admin:create --email <correo> [--name "<nombre>"] (ADMIN_PASSWORD en el entorno)',
    );
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL no está definida');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const result = await bootstrapSuperAdmin(
      prisma,
      {
        email,
        password: process.env.ADMIN_PASSWORD ?? process.env.BOOTSTRAP_ADMIN_PASSWORD,
        fullName: arg('name') ?? process.env.BOOTSTRAP_ADMIN_NAME,
      },
      { force: true },
    );
    console.log(bootstrapMessage(result, email));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    'No se pudo crear el administrador:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
