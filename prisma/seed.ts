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
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient, Role, UserStatus } from '../src/generated/prisma/client';
import { COUNTRIES } from './data/countries';

type Seeder = (prisma: PrismaClient) => Promise<void>;

interface InegiDataset {
  states: Array<{
    code: string;
    name: string;
    municipalities: Array<{ code: string; name: string }>;
  }>;
}

/** Fase 01: países (LatAm + ES + US), 32 estados y 2,478 municipios de México (INEGI). */
async function seedLocations(prisma: PrismaClient): Promise<void> {
  for (const country of COUNTRIES) {
    const { code, ...data } = country;
    await prisma.country.upsert({ where: { code }, create: country, update: data });
  }

  const dataset = JSON.parse(
    readFileSync(resolve(__dirname, 'data', 'mx-inegi-municipalities.json'), 'utf8'),
  ) as InegiDataset;
  let municipalities = 0;
  for (const state of dataset.states) {
    const division = await prisma.adminDivision.upsert({
      where: { countryCode_code: { countryCode: 'MX', code: state.code } },
      create: { countryCode: 'MX', code: state.code, name: state.name },
      update: { name: state.name },
    });
    const result = await prisma.municipality.createMany({
      data: state.municipalities.map((m) => ({
        divisionId: division.id,
        code: m.code,
        name: m.name,
      })),
      skipDuplicates: true,
    });
    municipalities += result.count;
  }
  console.log(
    `  ${COUNTRIES.length} países, ${dataset.states.length} estados de México, ${municipalities} municipios nuevos.`,
  );
}

/**
 * Fase 01: usuarios demo SOLO fuera de producción. Credenciales en README.md ("Usuarios demo").
 */
const DEMO_USERS = [
  {
    email: 'participante@example.com',
    username: 'participante.demo',
    fullName: 'Participante Demo',
    password: 'Demo12345',
    roles: [Role.PARTICIPANT],
  },
  {
    email: 'admin@example.com',
    username: 'admin.demo',
    fullName: 'Administración Demo',
    password: 'Admin12345',
    roles: [Role.SUPER_ADMIN],
  },
];

async function seedDemoUsers(prisma: PrismaClient): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.log('  NODE_ENV=production: se omiten los usuarios demo.');
    return;
  }
  const cdmx = await prisma.adminDivision.findUniqueOrThrow({
    where: { countryCode_code: { countryCode: 'MX', code: '09' } },
  });
  const coyoacan = await prisma.municipality.findUniqueOrThrow({
    where: { divisionId_code: { divisionId: cdmx.id, code: '003' } },
  });
  for (const demo of DEMO_USERS) {
    const passwordHash = await argon2.hash(demo.password, { type: argon2.argon2id });
    const data = {
      fullName: demo.fullName,
      passwordHash,
      phoneCountryCode: '+52',
      phoneNumber: '5512345678',
      countryCode: 'MX',
      divisionId: cdmx.id,
      divisionName: cdmx.name,
      municipalityId: coyoacan.id,
      municipalityName: coyoacan.name,
      timezone: 'America/Mexico_City',
      status: UserStatus.ACTIVE,
      roles: demo.roles,
      emailVerifiedAt: new Date(),
      failedLoginAttempts: 0,
      loginLockedUntil: null,
    };
    await prisma.user.upsert({
      where: { email: demo.email },
      create: { email: demo.email, username: demo.username, ...data },
      update: data,
    });
  }
  console.log(`  ${DEMO_USERS.length} usuarios demo (ver README).`);
}

const seeders: Array<[name: string, run: Seeder]> = [
  ['Fase 01 — ubicaciones', seedLocations],
  ['Fase 01 — usuarios demo', seedDemoUsers],
];

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL no está definida');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await prisma.$queryRaw`SELECT 1`;
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
