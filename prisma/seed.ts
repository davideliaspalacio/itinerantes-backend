/**
 * Seed de datos demo (idempotente). Uso: `pnpm db:seed` (también corre tras `pnpm db:reset`).
 *
 * Producción (Railway): lo ejecuta `scripts/docker-entrypoint.sh` en cada arranque, después de
 * `prisma migrate deploy`. Siempre siembra catálogos de referencia; los datos demo dependen de:
 * - Usuarios demo: nunca con NODE_ENV=production.
 * - Ofertas demo (Fase 02): SEED_DEMO_DATA=true|false (por defecto true fuera de producción y false en
 *   producción).
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
import { Prisma, PrismaClient, Role, UserStatus } from '../src/generated/prisma/client';
import { buildImportantDates } from '../src/modules/offers/policies/important-dates.policy';
import { cdmxDate, parseScheduleRule } from '../src/modules/offers/policies/schedule-rule';
import { generateSessions } from '../src/modules/offers/policies/session-generation.policy';
import { COUNTRIES } from './data/countries';
import { DEMO_OFFERS, DEMO_TEACHERS } from './data/demo-offers';

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

/** ¿Sembrar datos demo de oferta? SEED_DEMO_DATA explícito, o por defecto solo fuera de producción. */
function demoDataEnabled(): boolean {
  const flag = process.env.SEED_DEMO_DATA?.trim().toLowerCase();
  if (flag === 'true' || flag === '1') return true;
  if (flag === 'false' || flag === '0') return false;
  return process.env.NODE_ENV !== 'production';
}

/**
 * Fase 02: docentes y ofertas demo (diplomado, curso, taller, evento, 2 convocatorias, Moodle,
 * una finalizada y un borrador) con módulos, sesiones generadas (HU-29) y fechas importantes.
 * Idempotente: upsert por slug; sesiones únicas por (oferta, inicio).
 */
async function seedDemoOffers(prisma: PrismaClient): Promise<void> {
  if (!demoDataEnabled()) {
    console.log('  SEED_DEMO_DATA desactivado: se omiten las ofertas demo.');
    return;
  }
  const teacherIds = new Map<string, string>();
  for (const { slug, ...data } of DEMO_TEACHERS) {
    const teacher = await prisma.teacher.upsert({
      where: { slug },
      create: { slug, ...data },
      update: data,
    });
    teacherIds.set(slug, teacher.id);
  }

  let sessionCount = 0;
  for (const demo of DEMO_OFFERS) {
    const { slug, scheduleRule, ...fields } = demo.data;
    const rule = scheduleRule ? parseScheduleRule(scheduleRule) : null;
    const data = { ...fields, scheduleRule: rule ?? Prisma.DbNull };
    const offer = await prisma.offer.upsert({
      where: { slug },
      create: { slug, ...data },
      update: data,
    });

    await prisma.offerTeacher.deleteMany({ where: { offerId: offer.id } });
    await prisma.offerTeacher.createMany({
      data: demo.teacherSlugs.map((teacherSlug, position) => ({
        offerId: offer.id,
        teacherId: teacherIds.get(teacherSlug)!,
        position,
      })),
    });

    const moduleIds: string[] = [];
    for (const [index, module] of demo.modules.entries()) {
      const position = index + 1;
      const existing = await prisma.offerModule.findFirst({
        where: { offerId: offer.id, position },
      });
      const moduleData = { ...module, visibility: 'PUBLISHED' as const, publishAt: null };
      const saved = existing
        ? await prisma.offerModule.update({ where: { id: existing.id }, data: moduleData })
        : await prisma.offerModule.create({ data: { offerId: offer.id, position, ...moduleData } });
      moduleIds.push(saved.id);
    }
    await prisma.offerModule.deleteMany({
      where: { offerId: offer.id, position: { gt: demo.modules.length } },
    });

    if (demo.generateSessions && rule && offer.startsAt && offer.endsAt) {
      const generated = generateSessions({
        rule,
        startDate: cdmxDate(offer.startsAt),
        endDate: cdmxDate(offer.endsAt),
        moduleCount: moduleIds.length || undefined,
      });
      const result = await prisma.offerSession.createMany({
        data: generated.sessions.map((session) => ({
          offerId: offer.id,
          moduleId: session.moduleIndex !== undefined ? moduleIds[session.moduleIndex] : null,
          startsAt: session.startsAt,
          endsAt: session.endsAt,
          category: offer.calendarCategory,
          // PRIVADO: join_url de participante (demo).
          joinUrl:
            offer.modality === 'ONLINE_LIVE' ? 'https://zoom.us/j/0000000000?pwd=demo' : null,
        })),
        skipDuplicates: true,
      });
      sessionCount += result.count;
    }

    await prisma.calendarEvent.deleteMany({
      where: { offerId: offer.id, kind: { not: 'MANUAL' } },
    });
    if (offer.publicationStatus === 'PUBLISHED') {
      await prisma.calendarEvent.createMany({
        data: buildImportantDates(offer).map((date) => ({
          ...date,
          offerId: offer.id,
          category: 'IMPORTANT_DATES' as const,
          allDay: false,
        })),
      });
    }
  }
  console.log(
    `  ${DEMO_TEACHERS.length} docentes, ${DEMO_OFFERS.length} ofertas demo, ${sessionCount} sesiones nuevas.`,
  );
}

const seeders: Array<[name: string, run: Seeder]> = [
  ['Fase 01 — ubicaciones', seedLocations],
  ['Fase 01 — usuarios demo', seedDemoUsers],
  ['Fase 02 — ofertas demo', seedDemoOffers],
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
