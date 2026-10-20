/**
 * Seed de datos demo (idempotente). Uso: `pnpm db:seed` (también corre tras `pnpm db:reset`).
 *
 * Reglas para las fases:
 * - Usa SIEMPRE `upsert` (o `createMany({ skipDuplicates: true })`) con claves estables (email, slug),
 *   para poder correrlo N veces sin duplicar.
 * - Agrega una función `seedXxx(prisma)` por fase y llámala desde `main()` en orden de dependencias.
 * - Datos previstos (ARCHITECTURE.md): usuario demo, admin demo, ofertas de ejemplo
 *   ("Diplomado en Ecotecnologías del Agua", ...). Nunca contraseñas reales.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

type Seeder = (prisma: PrismaClient) => Promise<void>;

/** Fase 00: sin modelos todavía. Las fases agregan aquí sus seeders (seedIdentity, seedOffers, ...). */
const seeders: Array<[name: string, run: Seeder]> = [];

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL no está definida');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await prisma.$queryRaw`SELECT 1`;
    if (seeders.length === 0) {
      console.log('Seed: no hay seeders registrados todavía (Fase 00).');
    }
    for (const [name, run] of seeders) {
      console.log(`Seed: ${name}...`);
      await run(prisma);
    }
    console.log('Seed completado.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Seed falló:', error);
  process.exit(1);
});
