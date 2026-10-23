import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { addDaysInZone, cdmxToUtc } from '../src/common/utils/time';
import { MAIL_DRIVER } from '../src/infra/mail/mail.types';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import {
  OFFER_ENROLLMENT_LOOKUP,
  type OfferEnrollmentLookup,
} from '../src/modules/offers/enrollment-lookup';
import type { Prisma } from '../src/generated/prisma/client';
import { createTestApp } from './utils/create-test-app';
import { createVerifiedUser, login } from './utils/identity';
import { MailCapture } from './utils/mail-capture';
import { withScholarshipTypes } from './utils/scholarship-types';

/**
 * Catálogo, ficha y disponibilidad (Fase 02). Usa ofertas propias con fechas RELATIVAS a hoy
 * (prefijo único en el nombre para aislarlas con `q`) y además verifica el seed demo.
 */
describe('Oferta formativa (e2e) — HU-15, HU-16, HU-34', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const mail = new MailCapture();
  /** Lookup controlable para simular inscripciones/cupo (Fase 03 lo implementa de verdad). */
  const lookup: OfferEnrollmentLookup & { enrolled: Set<string>; seats: Map<string, number> } = {
    enrolled: new Set(),
    seats: new Map(),
    activeOfferIdsForUser(_userId, offerIds) {
      return Promise.resolve(new Set(offerIds.filter((id) => this.enrolled.has(id))));
    },
    countSeatsTaken() {
      return Promise.resolve(this.seats);
    },
    enrollmentStatesForUser() {
      return Promise.resolve(new Map());
    },
  };

  const token = `zq${randomUUID().slice(0, 6)}`;
  const slug = (s: string) => `e2e-${token}-${s}`;
  const anchor = new Date();
  const days = (n: number) => addDaysInZone(anchor, n);
  const ids: Record<string, string> = {};

  const base = (key: string, overrides: Partial<Prisma.OfferUncheckedCreateInput>) => ({
    slug: slug(key),
    name: `${token} ${key}`,
    type: 'COURSE' as const,
    modality: 'ONLINE_LIVE' as const,
    origin: 'NAS' as const,
    publicationStatus: 'PUBLISHED' as const,
    summary: `Resumen ${key}`,
    description: `Descripción ${key}`,
    learningOutcomes: ['Aprender algo'],
    enrollmentOpensAt: days(-10),
    enrollmentClosesAt: days(10),
    startsAt: days(12),
    endsAt: days(30),
    priceMxnCents: 180_000,
    priceUsdCents: 10_000,
    whatsappGroupUrl: 'https://chat.whatsapp.com/SECRETO',
    ...overrides,
  });

  beforeAll(async () => {
    app = await createTestApp({
      customize: (b) =>
        b
          .overrideProvider(MAIL_DRIVER)
          .useValue(mail)
          .overrideProvider(OFFER_ENROLLMENT_LOOKUP)
          .useValue(lookup),
    });
    prisma = app.get(PrismaService);

    const teacher = await prisma.teacher.create({
      data: { slug: slug('teacher'), fullName: `Docente ${token}Rodríguez`, bio: 'Bio' },
    });
    const offers: Array<[string, Partial<Prisma.OfferUncheckedCreateInput>]> = [
      [
        'diploma',
        {
          type: 'DIPLOMA',
          startsAt: days(15),
          priceMxnCents: 1_020_000,
          priceUsdCents: 58_500,
          installmentsEnabled: true,
          installmentsMax: 3,
          scholarshipEnabled: true,
          scholarshipTypes: withScholarshipTypes(['AGUA_VIVA', 'SPECIAL']),
          scheduleRule: {
            weekdays: [6, 7],
            startTime: '10:00',
            endTime: '13:00',
            excludedDates: [],
          },
          totalMinutes: 3600,
          publicTopic: 'FIELD_VISITS',
        },
      ],
      ['course', { startsAt: days(5), enrollmentClosesAt: days(4), publicTopic: 'FIELD_VISITS' }],
      [
        'workshop',
        {
          type: 'WORKSHOP',
          modality: 'IN_PERSON',
          venueName: 'Sede',
          venueCity: 'Oaxaca',
          capacity: 10,
          enrollmentOpensAt: days(3),
          startsAt: days(20),
          publicTopic: 'TRAVELING_WATER_LABS',
        },
      ],
      ['closed', { enrollmentOpensAt: days(-30), enrollmentClosesAt: days(-1), startsAt: days(2) }],
      [
        'finished',
        {
          enrollmentOpensAt: days(-60),
          enrollmentClosesAt: days(-40),
          startsAt: days(-30),
          endsAt: days(-2),
        },
      ],
      ['moodle', { origin: 'MOODLE', moodleCourseUrl: 'https://moodle.example.com/x' }],
      [
        'call',
        {
          type: 'OPEN_CALL',
          modality: 'IN_PERSON',
          venueName: 'Ecoaldea',
          isFree: true,
          eligibilityText: 'Mujeres lideresas de Centroamérica y México.',
          eligibleCountryCodes: ['MX', 'GT'],
          requiresTravel: true,
          publicTopic: 'TERRITORIAL_PRACTICES',
        },
      ],
      ['draft', { publicationStatus: 'DRAFT' }],
      ['archived', { publicationStatus: 'ARCHIVED' }],
    ];
    for (const [key, overrides] of offers) {
      const offer = await prisma.offer.create({ data: base(key, overrides) });
      ids[key] = offer.id;
    }
    await prisma.offerTeacher.create({ data: { offerId: ids.diploma, teacherId: teacher.id } });
    await prisma.offerModule.createMany({
      data: [
        { offerId: ids.diploma, position: 1, title: 'Publicado', visibility: 'PUBLISHED' },
        { offerId: ids.diploma, position: 2, title: 'Oculto', visibility: 'HIDDEN' },
        {
          offerId: ids.diploma,
          position: 3,
          title: 'Programado',
          visibility: 'PUBLISHED',
          publishAt: days(5),
        },
      ],
    });
    await prisma.offerSession.create({
      data: {
        offerId: ids.diploma,
        startsAt: cdmxToUtc('2030-01-05', '10:00'),
        endsAt: cdmxToUtc('2030-01-05', '13:00'),
        joinUrl: 'https://zoom.us/j/SECRETO',
        hostUrl: 'https://zoom.us/s/HOST',
        recordingUrl: 'https://youtu.be/SECRETO',
      },
    });
  });

  afterAll(async () => {
    await prisma.offer.deleteMany({ where: { slug: { startsWith: `e2e-${token}` } } });
    await prisma.teacher.deleteMany({ where: { slug: { startsWith: `e2e-${token}` } } });
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  type Item = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const list = async (query: string, headers: Record<string, string> = {}) => {
    const res = await http().get(`/api/v1/offers?q=${token}&${query}`).set(headers).expect(200);
    return res.body as { data: Item[]; meta: Item };
  };
  const keys = (items: Item[]) => items.map((i) => (i.slug as string).replace(`e2e-${token}-`, ''));

  describe('GET /offers (HU-15)', () => {
    it('sin sesión: abiertas y próximas, por inicio más cercano; nunca borradores', async () => {
      const { data, meta } = await list('');
      // Inicio más cercano primero (empate → nombre); la cerrada y la finalizada no salen.
      expect(keys(data)).toEqual(['course', 'call', 'moodle', 'diploma', 'workshop']);
      expect(meta.total).toBe(5);
      expect(data.map((o) => o.availability)).toEqual([
        'ENROLLMENT_OPEN',
        'ENROLLMENT_OPEN',
        'ENROLLMENT_OPEN',
        'ENROLLMENT_OPEN',
        'UPCOMING',
      ]);
    });

    it('estado: cerradas y finalizadas al final; filtro explícito', async () => {
      const all = await list('status=ENROLLMENT_OPEN,UPCOMING,ENROLLMENT_CLOSED,FINISHED');
      expect(keys(all.data).slice(-2)).toEqual(['closed', 'finished']);
      expect(keys(all.data)).not.toContain('draft');
      const finished = await list('status=FINISHED');
      expect(keys(finished.data)).toEqual(['finished']);
      expect(finished.data[0].availability).toBe('FINISHED');
    });

    it('filtros combinados: tipo (multi), modalidad, beca, temática', async () => {
      expect(keys((await list('type=DIPLOMA&type=WORKSHOP')).data).sort()).toEqual([
        'diploma',
        'workshop',
      ]);
      expect(keys((await list('type=DIPLOMA,OPEN_CALL')).data).sort()).toEqual(['call', 'diploma']);
      expect(keys((await list('modality=IN_PERSON')).data).sort()).toEqual(['call', 'workshop']);
      const scholarship = await list('scholarship=true');
      expect(keys(scholarship.data)).toEqual(['diploma']);
      expect(scholarship.data[0].scholarship).toEqual({ minPercent: 10, maxPercent: 80 });
      expect(keys((await list('topic=FIELD_VISITS')).data).sort()).toEqual(['course', 'diploma']);
    });

    it('búsqueda por docente (sin acentos) y validación de 3 caracteres', async () => {
      const res = await http()
        .get(`/api/v1/offers?q=${encodeURIComponent(`${token}rodriguez`)}`)
        .expect(200);
      expect(keys(res.body.data)).toEqual(['diploma']);
      expect(res.body.data[0].teacherNames).toEqual([`Docente ${token}Rodríguez`]);
      const bad = await http().get('/api/v1/offers?q=ab').expect(400);
      expect(bad.body.code).toBe('VALIDATION_ERROR');
      expect(bad.body.details[0]).toMatchObject({ field: 'q', code: 'MIN_LENGTH' });
      await http().get('/api/v1/offers?type=NOPE').expect(400);
      await http().get('/api/v1/offers?status=NOPE').expect(400);
    });

    it('paginación', async () => {
      const page1 = await list('pageSize=2&page=1');
      const page3 = await list('pageSize=2&page=3');
      expect(page1.meta).toEqual({ page: 1, pageSize: 2, total: 5, totalPages: 3 });
      expect(page1.data).toHaveLength(2);
      expect(page3.data).toHaveLength(1);
    });

    it('moneda sin sesión por zona horaria (query o header); Moodle sin precio', async () => {
      const mx = await list('tz=America/Mexico_City&type=DIPLOMA');
      expect(mx.data[0].pricing).toEqual({
        kind: 'PAID',
        currency: 'MXN',
        currencySource: 'TIMEZONE',
        price: { amountCents: 1_020_000, currency: 'MXN' },
        installments: { maxInstallments: 3 },
      });
      const co = await list('type=DIPLOMA', { 'X-Timezone': 'America/Bogota' });
      expect(co.data[0].pricing.price).toEqual({ amountCents: 58_500, currency: 'USD' });
      const none = await list('type=DIPLOMA');
      expect(none.data[0].pricing).toMatchObject({ currency: 'USD', currencySource: 'DEFAULT' });
      const moodle = (await list('')).data.find((o) => o.origin === 'MOODLE')!;
      expect(moodle.pricing).toMatchObject({ kind: 'EXTERNAL_ENROLLMENT', price: null });
      const call = (await list('type=OPEN_CALL')).data[0];
      expect(call).toMatchObject({
        openCallStatus: 'OPEN',
        pricing: { kind: 'FREE', price: null },
      });
    });

    it('horario: regla en CDMX + primera sesión en UTC', async () => {
      const diploma = (await list('type=DIPLOMA')).data[0];
      expect(diploma.schedule).toMatchObject({
        timezone: 'America/Mexico_City',
        weekdays: [6, 7],
        startTime: '10:00',
        endTime: '13:00',
      });
      expect(diploma.schedule.firstSession.startsAt).toMatch(/T16:00:00\.000Z$/);
      expect(diploma.totalHours).toBe(60);
    });

    it('con sesión: moneda del perfil (México) aunque la zona sea de España, y badge Inscrito', async () => {
      const user = await createVerifiedUser(app, mail);
      const { accessToken } = await login(app, user.email, user.password);
      lookup.enrolled.add(ids.diploma);
      try {
        const res = await list('tz=Europe/Madrid&type=DIPLOMA,COURSE', {
          Authorization: `Bearer ${accessToken}`,
        });
        const diploma = res.data.find((o) => o.id === ids.diploma)!;
        expect(diploma.pricing).toMatchObject({ currency: 'MXN', currencySource: 'PROFILE' });
        expect(diploma.enrolled).toBe(true);
        expect(res.data.find((o) => o.id === ids.course)!.enrolled).toBe(false);
      } finally {
        lookup.enrolled.clear();
      }
    });

    it('token inválido o vencido: responde como visitante (sin 401)', async () => {
      const res = await list('tz=Europe/Madrid&type=DIPLOMA', { Authorization: 'Bearer basura' });
      expect(res.data[0]).toMatchObject({
        enrolled: false,
        pricing: { currency: 'USD', currencySource: 'TIMEZONE' },
      });
    });
  });

  describe('GET /offers/{slug} (HU-16)', () => {
    it('ficha completa del diplomado y sin campos privados', async () => {
      const res = await http()
        .get(`/api/v1/offers/${slug('diploma')}?tz=America/Mexico_City`)
        .expect(200);
      const body = res.body as Item;
      expect(body).toMatchObject({
        type: 'DIPLOMA',
        availability: 'ENROLLMENT_OPEN',
        sessionCount: 1,
        capacity: { total: null, soldOut: false },
        viewer: { authenticated: false, enrolled: false },
        eligibility: null,
        teachers: [{ fullName: `Docente ${token}Rodríguez`, bio: 'Bio', cvUrl: null }],
      });
      // Solo módulos publicados (el oculto y el programado a futuro no aparecen).
      expect(body.modules).toEqual([{ number: 1, title: 'Publicado', description: null }]);
      expect(body.scholarshipDetails).toMatchObject({
        minPercent: 10,
        maxPercent: 80,
        windowStatus: 'OPEN',
        scholarshipTypes: [
          {
            scholarshipType: { key: 'AGUA_VIVA', name: 'Agua Viva', requiresInterview: false },
            estimatedScholarship: {
              minAmountCents: 102_000,
              maxAmountCents: 102_000,
              currency: 'MXN',
            },
          },
          {
            scholarshipType: {
              key: 'SPECIAL',
              name: 'Beca especial',
              minPercent: 71,
              maxPercent: 80,
              requiresInterview: true,
            },
            estimatedBalance: { minAmountCents: 204_000, maxAmountCents: 295_800, currency: 'MXN' },
          },
        ],
      });
      expect(
        body.actions.map((a: Item) => [a.type, a.enabled, a.primary, a.requiresLogin]),
      ).toEqual([
        ['ENROLL_AND_PAY', true, true, true],
        ['PAY_IN_INSTALLMENTS', true, false, true],
        ['APPLY_SCHOLARSHIP', true, false, true],
      ]);

      const raw = JSON.stringify(body);
      for (const secret of ['whatsapp', 'SECRETO', 'HOST', 'zoom.us', 'youtu.be']) {
        expect(raw).not.toContain(secret);
      }
      for (const field of [
        'whatsappGroupUrl',
        'joinUrl',
        'hostUrl',
        'recordingUrl',
        'publicationStatus',
        'attendanceWindowHours',
      ]) {
        expect(raw).not.toContain(`"${field}"`);
      }
    });

    it('próximamente: acciones deshabilitadas con fecha; cupo agotado', async () => {
      const upcoming = await http()
        .get(`/api/v1/offers/${slug('workshop')}`)
        .expect(200);
      expect(upcoming.body.availability).toBe('UPCOMING');
      expect(upcoming.body.venue).toMatchObject({ name: 'Sede', city: 'Oaxaca' });
      expect(upcoming.body.actions[0]).toMatchObject({
        type: 'ENROLL_AND_PAY',
        enabled: false,
        reason: 'ENROLLMENT_NOT_OPEN_YET',
      });
      expect(upcoming.body.actions[0].availableFrom).toBe(days(3).toISOString());

      lookup.seats.set(ids.workshop, 10);
      try {
        await prisma.offer.update({
          where: { id: ids.workshop },
          data: { enrollmentOpensAt: days(-1) },
        });
        const soldOut = await http()
          .get(`/api/v1/offers/${slug('workshop')}`)
          .expect(200);
        expect(soldOut.body.capacity).toEqual({ total: 10, soldOut: true });
        expect(soldOut.body.actions[0]).toMatchObject({ enabled: false, reason: 'SOLD_OUT' });
      } finally {
        lookup.seats.clear();
        await prisma.offer.update({
          where: { id: ids.workshop },
          data: { enrollmentOpensAt: days(3) },
        });
      }
    });

    it('convocatoria y Moodle: solo Postular / Activar acceso; inscrito → Ir a mi aula', async () => {
      const call = await http()
        .get(`/api/v1/offers/${slug('call')}`)
        .expect(200);
      expect(call.body.actions.map((a: Item) => a.type)).toEqual(['APPLY_OPEN_CALL']);
      expect(call.body.scholarshipDetails).toBeNull();
      expect(call.body.eligibility).toEqual({
        text: 'Mujeres lideresas de Centroamérica y México.',
        countries: [
          { code: 'MX', name: 'México' },
          { code: 'GT', name: 'Guatemala' },
        ],
        requiresTravel: true,
      });

      const moodle = await http()
        .get(`/api/v1/offers/${slug('moodle')}`)
        .expect(200);
      expect(moodle.body.actions.map((a: Item) => a.type)).toEqual(['ACTIVATE_MOODLE_ACCESS']);
      expect(moodle.body.moodleCourseUrl).toBe('https://moodle.example.com/x');

      const user = await createVerifiedUser(app, mail);
      const { accessToken } = await login(app, user.email, user.password);
      lookup.enrolled.add(ids.course);
      try {
        const course = await http()
          .get(`/api/v1/offers/${slug('course')}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);
        expect(course.body.viewer).toEqual({
          authenticated: true,
          enrolled: true,
          application: null,
        });
        expect(course.body.enrolled).toBe(true);
        expect(course.body.actions).toEqual([
          {
            type: 'GO_TO_CLASSROOM',
            enabled: true,
            primary: true,
            requiresLogin: false,
            reason: null,
            availableFrom: null,
            applicationId: null,
            applicationStatus: null,
          },
        ]);
      } finally {
        lookup.enrolled.clear();
      }
    });

    it('borrador, archivada o inexistente → 404 OFFER_NOT_AVAILABLE', async () => {
      for (const s of [slug('draft'), slug('archived'), 'no-existe-esta-oferta']) {
        const res = await http().get(`/api/v1/offers/${s}`).expect(404);
        expect(res.body.code).toBe('OFFER_NOT_AVAILABLE');
      }
    });

    it('seed: Diplomado en Ecotecnologías del Agua (9 módulos, 20 sesiones, 60 h)', async () => {
      const res = await http()
        .get('/api/v1/offers/diplomado-en-ecotecnologias-del-agua?tz=America/Mexico_City')
        .expect(200);
      expect(res.body).toMatchObject({
        name: 'Diplomado en Ecotecnologías del Agua',
        origin: 'NAS',
        totalHours: 60,
        sessionCount: 20,
        pricing: {
          price: { amountCents: 1_020_000, currency: 'MXN' },
          installments: { maxInstallments: 3 },
        },
        schedule: { weekdays: [6, 7], startTime: '10:00', endTime: '13:00' },
      });
      expect(res.body.modules).toHaveLength(9);
      const usd = await http()
        .get('/api/v1/offers/diplomado-en-ecotecnologias-del-agua?tz=America/Guatemala')
        .expect(200);
      expect(usd.body.pricing.price).toEqual({ amountCents: 58_500, currency: 'USD' });
      await http().get('/api/v1/offers/diplomado-de-ecopedagogias').expect(404);
    });
  });

  describe('GET /offers/availability (HU-34)', () => {
    it('las 10 temáticas en orden, con etiqueta y destino', async () => {
      // Robustez: ofertas e2e de ejecuciones anteriores (eia_test no se resetea) no deben contar.
      await prisma.offer.updateMany({
        where: {
          slug: { startsWith: 'e2e-', not: { contains: token } },
          publicTopic: { not: null },
        },
        data: { publicTopic: null },
      });
      const res = await http().get('/api/v1/offers/availability').expect(200);
      const data = res.body.data as Item[];
      expect(data.map((t) => t.topic)).toEqual([
        'ECOTECH_WATER_DIPLOMA',
        'ECOPEDAGOGIES_DIPLOMA',
        'WATER_APPRENTICES_SCHOOL',
        'WATER_TREATMENT_SYSTEMS_INTRO',
        'CONSTRUCTED_WETLANDS',
        'DRY_TOILETS',
        'WATER_HARVESTING',
        'TRAVELING_WATER_LABS',
        'TERRITORIAL_PRACTICES',
        'FIELD_VISITS',
      ]);
      const byTopic = Object.fromEntries(data.map((t) => [t.topic, t]));
      expect(byTopic.ECOTECH_WATER_DIPLOMA).toMatchObject({
        group: 'SPECIALIZED_TRAINING',
        label: 'Diplomado en Ecotecnologías del Agua',
        link: { kind: 'OFFER', slug: 'diplomado-en-ecotecnologias-del-agua' },
      });
      // Solo hay un borrador → sin fechas.
      expect(byTopic.ECOPEDAGOGIES_DIPLOMA).toMatchObject({
        availability: 'NO_SCHEDULED_DATES',
        link: { kind: 'NONE', slug: null, catalogQuery: null },
      });
      expect(byTopic.WATER_APPRENTICES_SCHOOL.availability).toBe('OPEN_CALL');
      // Nuestras dos ofertas de prueba con FIELD_VISITS → catálogo filtrado.
      expect(byTopic.FIELD_VISITS).toMatchObject({
        availability: 'ENROLLMENT_OPEN',
        offerCount: 2,
        link: {
          kind: 'CATALOG',
          catalogQuery: 'topic=FIELD_VISITS&status=ENROLLMENT_OPEN,UPCOMING,ENROLLMENT_CLOSED',
        },
      });
      expect(byTopic.TRAVELING_WATER_LABS).toMatchObject({
        availability: 'UPCOMING',
        link: { kind: 'OFFER', slug: slug('workshop') },
      });
    });

    it('filtra temáticas y valida el enum', async () => {
      const res = await http()
        .get('/api/v1/offers/availability?topics=DRY_TOILETS,FIELD_VISITS')
        .expect(200);
      expect(res.body.data.map((t: Item) => t.topic)).toEqual(['DRY_TOILETS', 'FIELD_VISITS']);
      await http().get('/api/v1/offers/availability?topics=NOPE').expect(400);
    });
  });
});
