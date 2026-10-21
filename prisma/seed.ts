/**
 * Seed de datos demo (idempotente). Uso: `pnpm db:seed` (también corre tras `pnpm db:reset`).
 *
 * Producción (Railway): lo ejecuta `scripts/docker-entrypoint.sh` en cada arranque, después de
 * `prisma migrate deploy`. Siempre siembra catálogos de referencia; los datos demo dependen de:
 * - Usuarios demo: nunca con NODE_ENV=production.
 * - Ofertas demo (Fase 02) y contenido demo del portal (Fase 03: biblioteca, recursos de módulo, eventos):
 *   SEED_DEMO_DATA=true|false (por defecto true fuera de producción y false en producción).
 * - Inscripciones, asistencias y notificaciones demo (Fase 03): solo para el usuario demo, que nunca
 *   existe con NODE_ENV=production.
 * - Postulaciones demo (Fase 04): solo para el usuario demo y nunca con NODE_ENV=production; se crean
 *   solo si no existen (no pisan lo que se haga desde el portal).
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
import { DEMO_APPLICATIONS } from './data/demo-applications';
import { DEMO_OFFERS, DEMO_TEACHERS } from './data/demo-offers';
import {
  DEMO_CALENDAR_EVENTS,
  DEMO_ENROLLMENTS,
  DEMO_LIBRARY,
  DEMO_MODULE_RESOURCES,
} from './data/demo-portal';

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

/**
 * Fase 03: contenido demo del portal (biblioteca, recursos de módulo, eventos manuales, grabaciones
 * de la oferta finalizada) con SEED_DEMO_DATA, e inscripciones/asistencias/notificaciones del usuario
 * demo (nunca en producción). Idempotente: claves estables (slug, título, userId+offerId, dedupeKey).
 */
async function seedDemoPortal(prisma: PrismaClient): Promise<void> {
  if (!demoDataEnabled()) {
    console.log('  SEED_DEMO_DATA desactivado: se omite el contenido demo del portal.');
    return;
  }
  const offers = await prisma.offer.findMany({ select: { id: true, slug: true } });
  const offerIdBySlug = new Map(offers.map((o) => [o.slug, o.id]));

  const libraryIds = new Map<string, string>();
  for (const { slug, offerSlug, ...data } of DEMO_LIBRARY) {
    const offerId = offerSlug ? (offerIdBySlug.get(offerSlug) ?? null) : null;
    const fields = { ...data, offerId, visibility: 'PUBLISHED' as const, publishAt: null };
    const saved = await prisma.libraryResource.upsert({
      where: { slug },
      create: { slug, ...fields },
      update: fields,
    });
    libraryIds.set(slug, saved.id);
  }

  let resources = 0;
  for (const group of DEMO_MODULE_RESOURCES) {
    const offerId = offerIdBySlug.get(group.offerSlug);
    if (!offerId) continue;
    const module = await prisma.offerModule.findFirst({
      where: { offerId, position: group.modulePosition },
    });
    if (!module) continue;
    for (const { libraryResourceSlug, ...resource } of group.resources) {
      const data = {
        ...resource,
        libraryResourceId: libraryResourceSlug
          ? (libraryIds.get(libraryResourceSlug) ?? null)
          : null,
        visibility: 'PUBLISHED' as const,
        publishAt: null,
      };
      const existing = await prisma.moduleResource.findFirst({
        where: { moduleId: module.id, title: resource.title },
      });
      if (existing) await prisma.moduleResource.update({ where: { id: existing.id }, data });
      else {
        await prisma.moduleResource.create({ data: { moduleId: module.id, ...data } });
        resources++;
      }
    }
  }

  for (const { offerSlug, ...event } of DEMO_CALENDAR_EVENTS) {
    const data = {
      ...event,
      kind: 'MANUAL' as const,
      offerId: offerSlug ? (offerIdBySlug.get(offerSlug) ?? null) : null,
    };
    const existing = await prisma.calendarEvent.findFirst({
      where: { kind: 'MANUAL', title: event.title },
    });
    if (existing) await prisma.calendarEvent.update({ where: { id: existing.id }, data });
    else await prisma.calendarEvent.create({ data });
  }

  // Grabaciones demo de la oferta finalizada (HU-08 / HU-12: "Ver grabación").
  const finishedId = offerIdBySlug.get('curso-introduccion-sistemas-de-tratamiento-2026');
  if (finishedId) {
    await prisma.offerSession.updateMany({
      where: { offerId: finishedId, recordingUrl: null },
      data: {
        recordingUrl: 'https://example.com/grabaciones/curso-tratamiento',
        recordingPublishedAt: new Date(),
      },
    });
  }
  console.log(
    `  ${DEMO_LIBRARY.length} recursos de biblioteca, ${resources} recursos de módulo nuevos, ${DEMO_CALENDAR_EVENTS.length} eventos manuales.`,
  );

  if (process.env.NODE_ENV === 'production') {
    console.log('  NODE_ENV=production: se omiten inscripciones y notificaciones demo.');
    return;
  }
  const participant = await prisma.user.findUnique({
    where: { email: 'participante@example.com' },
  });
  if (!participant) return;

  for (const demo of DEMO_ENROLLMENTS) {
    const offerId = offerIdBySlug.get(demo.offerSlug);
    if (!offerId) continue;
    const enrollment = await prisma.enrollment.upsert({
      where: { userId_offerId: { userId: participant.id, offerId } },
      create: {
        userId: participant.id,
        offerId,
        status: 'ACTIVE',
        origin: demo.origin,
        source: demo.source,
        activatedAt: new Date(),
      },
      update: { status: 'ACTIVE', origin: demo.origin, source: demo.source },
    });
    if (demo.attendedSessionIndexes?.length) {
      const sessions = await prisma.offerSession.findMany({
        where: { offerId },
        orderBy: { startsAt: 'asc' },
        select: { id: true, endsAt: true },
      });
      await prisma.sessionAttendance.createMany({
        data: demo.attendedSessionIndexes
          .filter((i) => sessions[i])
          .map((i) => ({
            sessionId: sessions[i].id,
            userId: participant.id,
            enrollmentId: enrollment.id,
            source: 'PARTICIPANT' as const,
            comment: 'Me llevo ideas para aplicar en mi comunidad.',
            registeredAt: sessions[i].endsAt,
          })),
        skipDuplicates: true,
      });
    }
  }

  const diplomaId = offerIdBySlug.get('diplomado-en-ecotecnologias-del-agua');
  await prisma.notification.createMany({
    data: [
      {
        userId: participant.id,
        type: 'GENERAL' as const,
        category: 'GENERAL' as const,
        title: 'Te damos la bienvenida al portal',
        body: 'Aquí encontrarás tu formación, calendario, biblioteca y avisos.',
        actionLabel: 'Ir a mi dashboard',
        actionPath: '/portal',
        dedupeKey: 'demo:welcome',
        emailStatus: 'NOT_REQUESTED' as const,
      },
      ...(diplomaId
        ? [
            {
              userId: participant.id,
              type: 'ENROLLMENT_CONFIRMED' as const,
              category: 'TRAINING' as const,
              title: 'Inscripción confirmada: Diplomado en Ecotecnologías del Agua',
              body: 'Ya estás inscrito. Primera sesión: 7/11/2026 10:00 hora CDMX.',
              actionLabel: 'Ir a mi aula',
              actionPath: `/portal/aula/${diplomaId}`,
              data: { offerId: diplomaId },
              dedupeKey: 'demo:enrollment-diploma',
              emailStatus: 'NOT_REQUESTED' as const,
            },
          ]
        : []),
    ],
    skipDuplicates: true,
  });
  console.log(`  ${DEMO_ENROLLMENTS.length} inscripciones demo de participante@example.com.`);
}

/**
 * Fase 04: postulaciones demo de `participante@example.com` (beca aprobada pendiente de pago,
 * convocatoria con entrevista agendada y un borrador). Nunca en producción. Idempotente: se crean
 * solo si no existe la postulación de esa persona en esa oferta (única por persona y oferta).
 */
async function seedDemoApplications(prisma: PrismaClient): Promise<void> {
  if (process.env.NODE_ENV === 'production' || !demoDataEnabled()) {
    console.log('  Se omiten las postulaciones demo (producción o SEED_DEMO_DATA desactivado).');
    return;
  }
  const participant = await prisma.user.findUnique({
    where: { email: 'participante@example.com' },
  });
  if (!participant) return;

  let created = 0;
  for (const demo of DEMO_APPLICATIONS) {
    const offer = await prisma.offer.findUnique({ where: { slug: demo.offerSlug } });
    if (!offer) continue;
    const existing = await prisma.application.findUnique({
      where: { userId_offerId: { userId: participant.id, offerId: offer.id } },
    });
    if (existing) continue;
    const application = await prisma.application.create({
      data: {
        ...demo.data,
        userId: participant.id,
        offerId: offer.id,
        applicantName: participant.fullName,
        applicantEmail: participant.email,
        phoneCountryCode: participant.phoneCountryCode,
        phoneNumber: participant.phoneNumber,
        countryCode: participant.countryCode,
        divisionName: participant.divisionName,
        municipalityName: participant.municipalityName,
        statusEvents: {
          create: demo.history.map((event, index) => ({
            fromStatus: index > 0 ? demo.history[index - 1].status : null,
            toStatus: event.status,
            actorType: event.actor,
            actorId: event.actor === 'PARTICIPANT' ? participant.id : null,
            createdAt: event.at,
          })),
        },
        ...(demo.interview ? { interviews: { create: [demo.interview] } } : {}),
      },
    });
    created++;
    if (demo.enrollment) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_offerId: { userId: participant.id, offerId: offer.id } },
      });
      if (!enrollment) {
        await prisma.enrollment.create({
          data: {
            userId: participant.id,
            offerId: offer.id,
            applicationId: application.id,
            origin: 'NAS',
            ...demo.enrollment,
          },
        });
      }
    }
  }
  console.log(`  ${created} postulaciones demo nuevas de participante@example.com.`);
}

const seeders: Array<[name: string, run: Seeder]> = [
  ['Fase 01 — ubicaciones', seedLocations],
  ['Fase 01 — usuarios demo', seedDemoUsers],
  ['Fase 02 — ofertas demo', seedDemoOffers],
  ['Fase 03 — portal demo', seedDemoPortal],
  ['Fase 04 — postulaciones demo', seedDemoApplications],
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
