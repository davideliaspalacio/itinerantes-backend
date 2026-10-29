import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { addDaysInZone, addHours, addMinutes } from '../src/common/utils/time';
import type { Prisma } from '../src/generated/prisma/client';
import { MAIL_DRIVER } from '../src/infra/mail/mail.types';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { StorageService } from '../src/infra/storage/storage.service';
import { PortalJobsService } from '../src/modules/live-sessions/portal-jobs.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { createTestApp } from './utils/create-test-app';
import { FakeStorage } from './utils/fake-storage';
import { createVerifiedUser, login } from './utils/identity';
import { MailCapture } from './utils/mail-capture';

/**
 * Portal del participante (Fase 03): HU-06, 07, 08, 09, 10, 12, 13, 17, 18 + inscripción gratuita.
 * Ofertas propias con fechas RELATIVAS a ahora (prefijo único) y usuarios nuevos por ejecución.
 */
describe('Portal del participante (e2e) — Fase 03', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const mail = new MailCapture();
  const storage = new FakeStorage();

  const token = `pt${randomUUID().slice(0, 6)}`;
  const slug = (s: string) => `e2e-${token}-${s}`;
  const now = new Date();
  const days = (n: number) => addDaysInZone(now, n);
  const hours = (n: number) => addHours(now, n);
  const ids: Record<string, string> = {};
  const sessions: Record<string, string> = {};
  const resources: Record<string, string> = {};
  const library: Record<string, string> = {};

  let alice: { token: string; id: string; email: string };
  let bob: { token: string; id: string; email: string };
  let carol: { token: string; id: string; email: string };

  const api = () => request(app.getHttpServer());
  const get = (path: string, user: { token: string }) =>
    api().get(`/api/v1${path}`).set('Authorization', `Bearer ${user.token}`);
  const post = (path: string, user: { token: string }, body: object = {}) =>
    api().post(`/api/v1${path}`).set('Authorization', `Bearer ${user.token}`).send(body);
  const put = (path: string, user: { token: string }, body: object = {}) =>
    api().put(`/api/v1${path}`).set('Authorization', `Bearer ${user.token}`).send(body);

  const offerData = (
    key: string,
    overrides: Partial<Prisma.OfferUncheckedCreateInput> = {},
  ): Prisma.OfferUncheckedCreateInput => ({
    slug: slug(key),
    name: `${token} ${key}`,
    type: 'COURSE',
    modality: 'ONLINE_LIVE',
    origin: 'NAS',
    publicationStatus: 'PUBLISHED',
    summary: `Resumen ${key}`,
    description: `Descripción ${key}`,
    learningOutcomes: [],
    enrollmentOpensAt: days(-10),
    enrollmentClosesAt: days(10),
    startsAt: days(-5),
    endsAt: days(20),
    priceMxnCents: 100_000,
    priceUsdCents: 6_000,
    ...overrides,
  });

  const newUser = async () => {
    const { email, password } = await createVerifiedUser(app, mail);
    const body = await login(app, email, password);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return { token: body.accessToken, id: user.id, email };
  };

  beforeAll(async () => {
    app = await createTestApp({
      customize: (b) =>
        b
          .overrideProvider(MAIL_DRIVER)
          .useValue(mail)
          .overrideProvider(StorageService)
          .useValue(storage),
    });
    prisma = app.get(PrismaService);
    [alice, bob, carol] = [await newUser(), await newUser(), await newUser()];

    const teacher = await prisma.teacher.create({
      data: { slug: slug('teacher'), fullName: `Docente ${token}` },
    });
    const create = async (key: string, overrides: Partial<Prisma.OfferUncheckedCreateInput>) => {
      ids[key] = (await prisma.offer.create({ data: offerData(key, overrides) })).id;
    };
    await create('course', {
      whatsappGroupUrl: 'https://chat.whatsapp.com/E2EGrupo',
      whatsappVisibleFrom: days(-1),
      attendanceWindowHours: 24,
    });
    await create('diploma', {
      type: 'DIPLOMA',
      finalProjectSubmissionEnabled: true,
      finalProjectDueAt: days(30),
      finalProjectGuidelines: 'Lineamientos',
      whatsappGroupUrl: 'https://chat.whatsapp.com/E2EDiploma',
      whatsappVisibleFrom: days(5),
      startsAt: days(3),
    });
    await create('workshop', {
      type: 'WORKSHOP',
      modality: 'IN_PERSON',
      venueName: 'Sede E2E',
      venueCity: 'Oaxaca',
    });
    await create('free', { type: 'EVENT', isFree: true, capacity: 1, startsAt: days(3) });
    await create('paid', { startsAt: days(3) });
    await create('call', { type: 'OPEN_CALL', isFree: true, startsAt: days(3) });
    await create('upcoming', { isFree: true, enrollmentOpensAt: days(2), startsAt: days(9) });
    await create('draft', { publicationStatus: 'DRAFT' });
    await create('other', {});
    await prisma.offerTeacher.create({ data: { offerId: ids.course, teacherId: teacher.id } });

    // Módulos del curso: publicado, oculto y programado a futuro.
    const m1 = await prisma.offerModule.create({
      data: { offerId: ids.course, position: 1, title: 'Módulo visible', visibility: 'PUBLISHED' },
    });
    const m2 = await prisma.offerModule.create({
      data: { offerId: ids.course, position: 2, title: 'Módulo oculto', visibility: 'HIDDEN' },
    });
    await prisma.offerModule.create({
      data: {
        offerId: ids.course,
        position: 3,
        title: 'Módulo programado',
        visibility: 'PUBLISHED',
        publishAt: days(3),
      },
    });
    const resource = async (
      key: string,
      data: Omit<Prisma.ModuleResourceUncheckedCreateInput, 'moduleId'>,
      moduleId = m1.id,
    ) => {
      resources[key] = (await prisma.moduleResource.create({ data: { moduleId, ...data } })).id;
    };
    await resource('file', {
      type: 'PRESENTATION',
      title: 'Presentación',
      fileKey: `offers/${ids.course}/presentacion.pdf`,
      fileName: 'presentacion.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1000,
      visibility: 'PUBLISHED',
    });
    await resource('link', {
      type: 'PRE_READING',
      title: 'Lectura',
      url: 'https://example.com/lectura',
      visibility: 'PUBLISHED',
    });
    await resource('activity', {
      type: 'ACTIVITY',
      title: 'Actividad con fecha',
      url: 'https://example.com/actividad',
      activityDueAt: days(2),
      visibility: 'PUBLISHED',
    });
    await resource('hidden', {
      type: 'PRE_READING',
      title: 'Lectura oculta',
      url: 'https://example.com/oculta',
      visibility: 'HIDDEN',
    });
    await resource('scheduled', {
      type: 'PRE_READING',
      title: 'Lectura programada',
      url: 'https://example.com/programada',
      visibility: 'PUBLISHED',
      publishAt: days(2),
    });
    await resource(
      'inHiddenModule',
      {
        type: 'PRE_READING',
        title: 'En módulo oculto',
        url: 'https://x.test',
        visibility: 'PUBLISHED',
      },
      m2.id,
    );

    // Sesiones del curso (relativas a ahora).
    const session = async (
      key: string,
      offerId: string,
      startsAt: Date,
      endsAt: Date,
      extra: Partial<Prisma.OfferSessionUncheckedCreateInput> = {},
    ) => {
      sessions[key] = (
        await prisma.offerSession.create({
          data: {
            offerId,
            moduleId: offerId === ids.course ? m1.id : null,
            startsAt,
            endsAt,
            joinUrl: 'https://zoom.us/j/999?pwd=participante',
            hostUrl: 'https://zoom.us/s/999?zak=ANFITRION-SECRETO',
            ...extra,
          },
        })
      ).id;
    };
    await session('open', ids.course, hours(-5), hours(-2)); // ventana abierta
    await session('closed', ids.course, hours(-33), hours(-30)); // ventana (24 h) vencida
    await session('override', ids.course, hours(-34), hours(-31), { attendanceWindowHours: 48 });
    await session('cancelled', ids.course, hours(-4), hours(-1), {
      status: 'CANCELLED',
      changeReason: 'Docente enferma',
    });
    await session('soon', ids.course, addMinutes(now, 5), addMinutes(now, 185)); // acceso abierto
    await session('later', ids.course, days(2), addHours(days(2), 3));
    await session('cancelledFuture', ids.course, days(3), addHours(days(3), 3), {
      status: 'CANCELLED',
    });
    await session('noLink', ids.course, days(4), addHours(days(4), 3), { joinUrl: null });
    await session('recorded', ids.course, hours(-80), hours(-77), {
      recordingUrl: 'https://youtu.be/grabacion',
    });
    await session('workshop', ids.workshop, hours(-6), hours(-3), { joinUrl: null, hostUrl: null });
    await session('other', ids.other, days(1), addHours(days(1), 3));

    // Inscripciones directas (las de pago llegan en Fase 05).
    for (const [userId, offerId] of [
      [alice.id, ids.course],
      [alice.id, ids.diploma],
      [alice.id, ids.workshop],
    ]) {
      await prisma.enrollment.create({
        data: { userId, offerId, status: 'ACTIVE', source: 'MANUAL', activatedAt: now },
      });
    }

    // Calendario: general, solo inscritos del curso y solo inscritos de otra oferta.
    const event = (title: string, data: Partial<Prisma.CalendarEventUncheckedCreateInput>) =>
      prisma.calendarEvent.create({
        data: {
          title: `${token} ${title}`,
          category: 'EVENTS',
          startsAt: days(1),
          endsAt: addHours(days(1), 1),
          ...data,
        },
      });
    await event('general', { audience: 'ALL_REGISTERED', joinUrl: 'https://zoom.us/j/web' });
    await event('solo-curso', { audience: 'OFFER_ENROLLED', offerId: ids.course });
    await event('solo-otra', { audience: 'OFFER_ENROLLED', offerId: ids.other });
    await event('fecha-borrador', {
      audience: 'ALL_REGISTERED',
      offerId: ids.draft,
      kind: 'ENROLLMENT_CLOSES',
      category: 'IMPORTANT_DATES',
    });

    // Biblioteca.
    const lib = async (key: string, data: Partial<Prisma.LibraryResourceUncheckedCreateInput>) => {
      library[key] = (
        await prisma.libraryResource.create({
          data: {
            slug: slug(`lib-${key}`),
            title: `${token} ${key}`,
            type: 'PDF',
            keywords: [`${token}kw`],
            visibility: 'PUBLISHED',
            ...data,
          },
        })
      ).id;
    };
    await lib('public', { fileKey: 'library/guia.pdf', fileName: 'guia.pdf', type: 'PDF' });
    await lib('video', {
      type: 'VIDEO',
      url: 'https://youtu.be/video',
      title: `${token} Humedales vídeo`,
    });
    await lib('course', {
      audience: 'OFFER_ENROLLED',
      offerId: ids.course,
      url: 'https://x.test/c',
    });
    await lib('otherOffer', {
      audience: 'OFFER_ENROLLED',
      offerId: ids.other,
      url: 'https://x.test/o',
    });
    await lib('hidden', { visibility: 'HIDDEN', url: 'https://x.test/h' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('todas las rutas del portal exigen sesión (401)', async () => {
    for (const path of ['/me/dashboard', '/me/enrollments', '/me/calendar', '/library']) {
      const res = await api().get(`/api/v1${path}`).expect(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    }
  });

  describe('HU-07 Mi formación', () => {
    it('lista mis inscripciones con progreso, próxima sesión y filtros', async () => {
      const res = await get('/me/enrollments?pageSize=100', alice).expect(200);
      const course = res.body.data.find(
        (c: { offer: { id: string } }) => c.offer.id === ids.course,
      );
      expect(course).toMatchObject({
        status: 'ACTIVE',
        phase: 'ACTIVE',
        origin: 'NAS',
        canContinue: true,
        scheduleStatus: 'HAS_NEXT_SESSION',
        progress: { attendedSessions: 0, percent: 0 },
      });
      // 9 sesiones del curso, 2 canceladas → 7 programadas.
      expect(course.progress.scheduledSessions).toBe(7);
      expect(course.nextSession.id).toBe(sessions.soon);

      const diplomas = await get('/me/enrollments?type=DIPLOMA', alice).expect(200);
      expect(diplomas.body.data.map((c: { offer: { id: string } }) => c.offer.id)).toEqual([
        ids.diploma,
      ]);
      const completed = await get('/me/enrollments?phase=COMPLETED', alice).expect(200);
      expect(completed.body.data).toEqual([]);
      await get('/me/enrollments?phase=OTRO', alice).expect(400);
    });

    it('sin inscripciones: lista vacía', async () => {
      const res = await get('/me/enrollments', carol).expect(200);
      expect(res.body).toEqual({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      });
    });

    it('la ficha y el catálogo usan las inscripciones reales (GO_TO_CLASSROOM)', async () => {
      const detail = await get(`/offers/${slug('course')}`, alice).expect(200);
      expect(detail.body.viewer).toEqual({
        authenticated: true,
        enrolled: true,
        application: null,
      });
      expect(detail.body.actions.map((a: { type: string }) => a.type)).toEqual(['GO_TO_CLASSROOM']);
      const anonymous = await api()
        .get(`/api/v1/offers/${slug('course')}`)
        .expect(200);
      expect(anonymous.body.viewer.enrolled).toBe(false);
    });
  });

  describe('HU-17 Aula', () => {
    it('inscrito: encabezado, progreso, WhatsApp, próxima sesión y módulos publicados', async () => {
      const res = await get(`/me/classrooms/${ids.course}`, alice).expect(200);
      expect(res.body.enrollment).toMatchObject({ status: 'ACTIVE', phase: 'ACTIVE' });
      expect(res.body.offer).toMatchObject({ id: ids.course, slug: slug('course') });
      expect(res.body.offer.teachers).toEqual([{ fullName: `Docente ${token}`, photoUrl: null }]);
      expect(res.body.welcome.whatsapp).toEqual({
        available: true,
        url: 'https://chat.whatsapp.com/E2EGrupo',
        availableFrom: null,
      });
      expect(res.body.nextSession.id).toBe(sessions.soon);
      expect(res.body.modules.map((m: { title: string }) => m.title)).toEqual(['Módulo visible']);
      expect(res.body.modules[0].resourceCounts).toEqual({
        presentation: 1,
        preReadings: 1,
        activities: 1,
        recordings: 1,
      });
      expect(res.body.finalProject).toBeNull(); // curso: sin proyecto final
      expect(JSON.stringify(res.body)).not.toContain('ANFITRION-SECRETO');
    });

    it('diplomado: WhatsApp aún no visible y bloque de proyecto final', async () => {
      const res = await get(`/me/classrooms/${ids.diploma}`, alice).expect(200);
      expect(res.body.welcome.whatsapp).toMatchObject({ available: false, url: null });
      expect(res.body.welcome.whatsapp.availableFrom).not.toBeNull();
      expect(res.body.welcome.preStart).toBe(true);
      expect(res.body.finalProject).toMatchObject({ submissionState: 'OPEN', submission: null });
    });

    it('no inscrito: 403 ENROLLMENT_REQUIRED con la ficha, sin exponer enlaces', async () => {
      const res = await get(`/me/classrooms/${ids.course}`, bob).expect(403);
      expect(res.body.code).toBe('ENROLLMENT_REQUIRED');
      expect(res.body.meta).toEqual({ offerSlug: slug('course'), enrollmentStatus: null });
      expect(JSON.stringify(res.body)).not.toContain('whatsapp');
      for (const path of ['materials', 'sessions', `resources/${resources.file}/access`]) {
        expect((await get(`/me/classrooms/${ids.course}/${path}`, bob).expect(403)).body.code).toBe(
          'ENROLLMENT_REQUIRED',
        );
      }
    });

    it('borrador, inexistente o id inválido: 404', async () => {
      await get(`/me/classrooms/${ids.draft}`, bob).expect(404);
      await get(`/me/classrooms/${randomUUID()}`, alice).expect(404);
      await get('/me/classrooms/no-es-uuid', alice).expect(404);
    });

    it('suspendida: 403 ENROLLMENT_SUSPENDED', async () => {
      const enrollment = await prisma.enrollment.create({
        data: { userId: carol.id, offerId: ids.other, status: 'SUSPENDED', source: 'MANUAL' },
      });
      const res = await get(`/me/classrooms/${ids.other}`, carol).expect(403);
      expect(res.body.code).toBe('ENROLLMENT_SUSPENDED');
      await prisma.enrollment.delete({ where: { id: enrollment.id } });
    });
  });

  describe('HU-08 Materiales', () => {
    it('cuatro grupos en orden; ocultos y programados no aparecen', async () => {
      const res = await get(`/me/classrooms/${ids.course}/materials`, alice).expect(200);
      expect(res.body.modules).toHaveLength(1);
      const [module] = res.body.modules;
      expect(module.presentation).toMatchObject({
        kind: 'FILE',
        url: null,
        fileName: 'presentacion.pdf',
      });
      expect(module.preReadings.map((r: { title: string }) => r.title)).toEqual(['Lectura']);
      expect(module.preReadings[0]).toMatchObject({
        kind: 'EXTERNAL_LINK',
        url: 'https://example.com/lectura',
      });
      expect(module.activities[0].activityDueAt).not.toBeNull();
      const recordings = Object.fromEntries(
        module.recordings.map((r: { sessionId: string; state: string }) => [r.sessionId, r.state]),
      );
      expect(recordings[sessions.recorded]).toBe('AVAILABLE');
      expect(recordings[sessions.open]).toBe('PENDING');
      expect(recordings[sessions.later]).toBe('AFTER_SESSION');
      expect(recordings[sessions.cancelled]).toBeUndefined();
    });

    it('archivo → URL firmada temporal; recurso oculto/programado/de módulo oculto → 404', async () => {
      const res = await get(
        `/me/classrooms/${ids.course}/resources/${resources.file}/access`,
        alice,
      ).expect(200);
      expect(res.body).toMatchObject({ kind: 'FILE', fileName: 'presentacion.pdf' });
      expect(res.body.url).toContain('X-Amz-Signature');
      expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());

      const link = await get(
        `/me/classrooms/${ids.course}/resources/${resources.link}/access`,
        alice,
      ).expect(200);
      expect(link.body).toEqual({
        kind: 'EXTERNAL_LINK',
        url: 'https://example.com/lectura',
        expiresAt: null,
        fileName: null,
      });
      for (const key of ['hidden', 'scheduled', 'inHiddenModule']) {
        await get(`/me/classrooms/${ids.course}/resources/${resources[key]}/access`, alice).expect(
          404,
        );
      }
      // Recurso de otra oferta pedido por la ruta de esta oferta.
      await get(`/me/classrooms/${ids.diploma}/resources/${resources.file}/access`, alice).expect(
        404,
      );
    });
  });

  describe('HU-12 Sesiones en vivo', () => {
    it('próximas: join_url solo dentro de la ventana, nunca el de anfitrión', async () => {
      const res = await get('/me/sessions?scope=UPCOMING&pageSize=100', alice).expect(200);
      const byId = Object.fromEntries(res.body.data.map((s: { id: string }) => [s.id, s]));
      expect(byId[sessions.soon].join).toMatchObject({
        state: 'OPEN',
        url: 'https://zoom.us/j/999?pwd=participante',
      });
      expect(byId[sessions.soon].platform).toBe('ZOOM');
      expect(byId[sessions.later].join).toMatchObject({ state: 'NOT_YET', url: null });
      expect(byId[sessions.cancelledFuture]).toMatchObject({
        status: 'CANCELLED',
        join: { state: 'CANCELLED', url: null },
      });
      expect(byId[sessions.noLink].join.state).toBe('LINK_PENDING');
      expect(byId[sessions.other]).toBeUndefined(); // oferta sin inscripción
      expect(byId[sessions.workshop]).toBeUndefined(); // presencial: no aparece aquí
      expect(JSON.stringify(res.body)).not.toContain('ANFITRION-SECRETO');
      // Orden: de la más cercana a la más lejana.
      const starts = res.body.data.map((s: { startsAt: string }) => s.startsAt);
      expect([...starts].sort()).toEqual(starts);
    });

    it('historial: de la más reciente a la más antigua, con grabación y asistencia', async () => {
      const res = await get(
        `/me/sessions?scope=PAST&offerId=${ids.course}&pageSize=100`,
        alice,
      ).expect(200);
      const list = res.body.data as Array<{ id: string; startsAt: string }>;
      expect(list.map((s) => s.startsAt)).toEqual(
        [...list.map((s) => s.startsAt)].sort().reverse(),
      );
      const recorded = list.find((s) => s.id === sessions.recorded) as unknown as {
        recording: { state: string; url: string };
        attendance: { status: string };
      };
      expect(recorded.recording).toEqual({ state: 'AVAILABLE', url: 'https://youtu.be/grabacion' });
      expect(recorded.attendance.status).toBe('NOT_REGISTERED');
    });

    it('sesión de una oferta sin inscripción: 403; inexistente: 404', async () => {
      expect((await get(`/me/sessions/${sessions.other}`, alice).expect(403)).body.code).toBe(
        'ENROLLMENT_REQUIRED',
      );
      await get(`/me/sessions/${randomUUID()}`, alice).expect(404);
      expect((await get(`/me/sessions?offerId=${ids.other}`, alice).expect(403)).body.code).toBe(
        'ENROLLMENT_REQUIRED',
      );
    });
  });

  describe('HU-18 Asistencia', () => {
    const attend = (sessionKey: string, user = alice, body: object = { attended: true }) =>
      post(`/me/sessions/${sessions[sessionKey]}/attendance`, user, body);

    it('valida la confirmación y el comentario', async () => {
      const missing = await attend('open', alice, {}).expect(400);
      expect(missing.body.details[0].field).toBe('attended');
      await attend('open', alice, { attended: false }).expect(400);
      await attend('open', alice, { attended: true, comment: 'x'.repeat(501) }).expect(400);
    });

    it('dentro de la ventana: Registrada y progreso recalculado; no se duplica', async () => {
      const res = await attend('open', alice, {
        attended: true,
        comment: '  Me llevo mucho.  ',
      }).expect(201);
      expect(res.body.session.attendance).toMatchObject({
        status: 'REGISTERED',
        source: 'PARTICIPANT',
        comment: 'Me llevo mucho.',
        canRegister: false,
      });
      expect(res.body.progress).toEqual({ attendedSessions: 1, scheduledSessions: 7, percent: 14 });

      const again = await attend('open').expect(409);
      expect(again.body.code).toBe('ATTENDANCE_ALREADY_REGISTERED');
      expect(again.body.meta.registeredAt).not.toBeNull();
      expect(
        await prisma.sessionAttendance.count({
          where: { sessionId: sessions.open, userId: alice.id },
        }),
      ).toBe(1);
    });

    it('ventana vencida, aún no abierta o sesión cancelada → error con motivo', async () => {
      const closed = await attend('closed').expect(422);
      expect(closed.body.code).toBe('ATTENDANCE_WINDOW_CLOSED');
      expect(closed.body.meta.closesAt).toBeDefined();
      const notYet = await attend('later').expect(422);
      expect(notYet.body.code).toBe('ATTENDANCE_NOT_OPEN_YET');
      expect((await attend('cancelled').expect(422)).body.code).toBe('SESSION_CANCELLED');
    });

    it('la ventana de la sesión sobrescribe la de la oferta (48 h)', async () => {
      const res = await attend('override').expect(201);
      expect(res.body.session.attendance.windowHours).toBe(48);
    });

    it('taller presencial: mismo formulario; marcada por el equipo → Registrada', async () => {
      await prisma.sessionAttendance.create({
        data: {
          sessionId: sessions.workshop,
          userId: alice.id,
          enrollmentId: (
            await prisma.enrollment.findFirstOrThrow({
              where: { userId: alice.id, offerId: ids.workshop },
            })
          ).id,
          source: 'MANUAL',
          manualReason: 'Pase de lista en sitio',
        },
      });
      const detail = await get(`/me/sessions/${sessions.workshop}`, alice).expect(200);
      expect(detail.body.attendance).toMatchObject({ status: 'REGISTERED', source: 'MANUAL' });
      expect(detail.body.venue).toMatchObject({ name: 'Sede E2E' });
      expect(detail.body.join.state).toBe('IN_PERSON');
      expect((await attend('workshop').expect(409)).body.code).toBe(
        'ATTENDANCE_ALREADY_REGISTERED',
      );
    });

    it('no inscrito: 403 y no se registra', async () => {
      expect((await attend('open', bob).expect(403)).body.code).toBe('ENROLLMENT_REQUIRED');
      expect(await prisma.sessionAttendance.count({ where: { userId: bob.id } })).toBe(0);
    });
  });

  describe('Inscripción gratuita (ENROLL_FREE)', () => {
    it('inscribe, notifica por portal y correo, y ocupa el cupo', async () => {
      const res = await post('/me/enrollments', bob, { offerId: ids.free }).expect(201);
      expect(res.body).toMatchObject({
        status: 'ACTIVE',
        origin: 'NAS',
        canContinue: true,
        offer: { id: ids.free },
      });
      const notifications = await get('/me/notifications', bob).expect(200);
      expect(notifications.body.data[0]).toMatchObject({
        type: 'ENROLLMENT_CONFIRMED',
        category: 'TRAINING',
        action: { label: 'Ir a mi aula', path: `/aula/${ids.free}` },
      });
      const email = mail.last(bob.email);
      expect(email?.subject).toContain('Inscripción confirmada');
      expect(email?.text).toContain(`/aula/${ids.free}`);

      const again = await post('/me/enrollments', bob, { offerId: ids.free }).expect(409);
      expect(again.body).toMatchObject({
        code: 'ENROLLMENT_ALREADY_EXISTS',
        meta: { enrollmentStatus: 'ACTIVE' },
      });
      const soldOut = await post('/me/enrollments', carol, { offerId: ids.free }).expect(409);
      expect(soldOut.body.code).toBe('OFFER_SOLD_OUT');
      const detail = await get(`/offers/${slug('free')}`, carol).expect(200);
      expect(detail.body.capacity).toEqual({ total: 1, soldOut: true });
      expect(detail.body.actions[0]).toMatchObject({ type: 'ENROLL_FREE', reason: 'SOLD_OUT' });
    });

    it('rechaza ofertas de pago, convocatorias, fuera de ventana y no publicadas', async () => {
      const paid = await post('/me/enrollments', carol, { offerId: ids.paid }).expect(422);
      expect(paid.body).toMatchObject({
        code: 'ENROLLMENT_NOT_FREE',
        meta: { requiredAction: 'ENROLL_AND_PAY' },
      });
      const call = await post('/me/enrollments', carol, { offerId: ids.call }).expect(422);
      expect(call.body.meta.requiredAction).toBe('APPLY_OPEN_CALL');
      const upcoming = await post('/me/enrollments', carol, { offerId: ids.upcoming }).expect(422);
      expect(upcoming.body.code).toBe('ENROLLMENT_CLOSED');
      expect(upcoming.body.meta.reason).toBe('ENROLLMENT_NOT_OPEN_YET');
      expect(upcoming.body.meta.availableFrom).not.toBeNull();
      expect(
        (await post('/me/enrollments', carol, { offerId: ids.draft }).expect(404)).body.code,
      ).toBe('OFFER_NOT_AVAILABLE');
      await post('/me/enrollments', carol, { offerId: 'nope' }).expect(400);
    });
  });

  describe('HU-10 Calendario', () => {
    const range = `from=${days(-5).toISOString()}&to=${days(10).toISOString()}`;

    it('sesiones propias, eventos de mi audiencia, actividades y canceladas visibles', async () => {
      const res = await get(`/me/calendar?${range}`, alice).expect(200);
      const items = res.body.data as Array<Record<string, unknown> & { id: string; title: string }>;
      const ids_ = new Set(items.map((i) => i.id));
      expect(ids_.has(sessions.soon)).toBe(true);
      expect(ids_.has(sessions.workshop)).toBe(true); // Territorio/presencial: solo inscritos
      expect(ids_.has(sessions.other)).toBe(false);
      const titles = items.map((i) => i.title);
      expect(titles).toContain(`${token} general`);
      expect(titles).toContain(`${token} solo-curso`);
      expect(titles).not.toContain(`${token} solo-otra`);
      expect(titles).not.toContain(`${token} fecha-borrador`);
      const activity = items.find((i) => i.id === resources.activity);
      expect(activity).toMatchObject({
        source: 'ACTIVITY',
        kind: 'ACTIVITY_DUE',
        category: 'IMPORTANT_DATES',
      });
      const cancelled = items.find((i) => i.id === sessions.cancelledFuture);
      expect(cancelled).toMatchObject({
        status: 'CANCELLED',
        join: { state: 'CANCELLED', url: null },
      });
      const starts = items.map((i) => i.startsAt as string);
      expect([...starts].sort()).toEqual(starts);
      expect(JSON.stringify(res.body)).not.toContain('ANFITRION-SECRETO');
    });

    it('filtro de categorías y audiencia de otra persona', async () => {
      const res = await get(`/me/calendar?${range}&categories=EVENTS`, alice).expect(200);
      expect(res.body.data.every((i: { category: string }) => i.category === 'EVENTS')).toBe(true);
      const bobView = await get(`/me/calendar?${range}`, bob).expect(200);
      const bobIds = bobView.body.data.map((i: { id: string }) => i.id);
      expect(bobIds).not.toContain(sessions.soon);
      expect(bobView.body.data.map((i: { title: string }) => i.title)).toContain(
        `${token} general`,
      );
    });

    it('rango inválido → 400 VALIDATION_ERROR', async () => {
      const tooLarge = await get(
        `/me/calendar?from=${days(0).toISOString()}&to=${days(90).toISOString()}`,
        alice,
      ).expect(400);
      expect(tooLarge.body.details[0]).toMatchObject({ field: 'to', code: 'RANGE_TOO_LARGE' });
      await get(
        `/me/calendar?from=${days(5).toISOString()}&to=${days(1).toISOString()}`,
        alice,
      ).expect(400);
      await get('/me/calendar?from=ayer', alice).expect(400);
    });
  });

  describe('HU-09 Biblioteca', () => {
    const q = `q=${token}`;

    it('públicos para todos; exclusivos solo para inscritos; ocultos nunca', async () => {
      const aliceView = await get(`/library?${q}&pageSize=100`, alice).expect(200);
      const aliceIds = aliceView.body.data.map((r: { id: string }) => r.id).sort();
      expect(aliceIds).toEqual([library.public, library.video, library.course].sort());
      const bobView = await get(`/library?${q}&pageSize=100`, bob).expect(200);
      expect(bobView.body.data.map((r: { id: string }) => r.id).sort()).toEqual(
        [library.public, library.video].sort(),
      );
    });

    it('filtro por tipo y búsqueda sin acentos', async () => {
      const videos = await get(`/library?${q}&type=VIDEO`, alice).expect(200);
      expect(videos.body.data.map((r: { id: string }) => r.id)).toEqual([library.video]);
      const search = await get(
        `/library?q=${encodeURIComponent(`${token} humedales video`)}`,
        alice,
      ).expect(200);
      expect(search.body.data.map((r: { id: string }) => r.id)).toEqual([library.video]);
      const empty = await get(`/library?q=${token}zzz`, alice).expect(200);
      expect(empty.body.data).toEqual([]);
    });

    it('abrir: archivo firmado, externo directo; ajeno u oculto → 404', async () => {
      const file = await get(`/library/${library.public}/access`, bob).expect(200);
      expect(file.body).toMatchObject({ kind: 'FILE', fileName: 'guia.pdf' });
      expect(file.body.url).toContain('X-Amz-Signature');
      const external = await get(`/library/${library.video}/access`, bob).expect(200);
      expect(external.body).toMatchObject({ kind: 'EXTERNAL_LINK', url: 'https://youtu.be/video' });
      await get(`/library/${library.course}/access`, bob).expect(404);
      await get(`/library/${library.hidden}/access`, alice).expect(404);
    });
  });

  describe('HU-13 Notificaciones', () => {
    it('job: registro de asistencia abierto (idempotente) y grupo de WhatsApp', async () => {
      const jobs = app.get(PortalJobsService);
      await jobs.notifyAttendanceOpen(new Date());
      await jobs.notifyAttendanceOpen(new Date());
      const notifications = await prisma.notification.findMany({
        where: { userId: alice.id, type: 'ATTENDANCE_OPEN' },
      });
      // `open` ya tenía asistencia de alice; `workshop` fue marcada por el equipo → sin aviso.
      // `closed` y `override` terminaron hace > 24 h: override (48 h) sí avisa si no hay registro.
      const sessionIds = notifications.map((n) => (n.data as { sessionId: string }).sessionId);
      expect(sessionIds).not.toContain(sessions.open);
      expect(sessionIds).not.toContain(sessions.closed);
      expect(sessionIds).not.toContain(sessions.cancelled);
      expect(new Set(sessionIds).size).toBe(sessionIds.length);
      expect(
        await prisma.offerSession.count({
          where: { id: { in: [sessions.open, sessions.workshop] }, attendanceNotifiedAt: null },
        }),
      ).toBe(0);

      await jobs.notifyWhatsappAvailable(new Date());
      await jobs.notifyWhatsappAvailable(new Date());
      const whatsapp = await prisma.notification.findMany({
        where: { userId: alice.id, type: 'WHATSAPP_GROUP_AVAILABLE' },
      });
      expect(whatsapp.map((n) => (n.data as { offerId: string }).offerId)).toEqual([ids.course]);
    });

    it('aviso de asistencia con enlace directo al registro', async () => {
      await prisma.offerSession.update({
        where: { id: sessions.closed },
        data: { attendanceNotifiedAt: null, endsAt: hours(-1), startsAt: hours(-3.5) },
      });
      await app.get(PortalJobsService).notifyAttendanceOpen(new Date());
      const res = await get('/me/notifications?category=TRAINING&pageSize=100', alice).expect(200);
      const notice = res.body.data.find(
        (n: { type: string; data: { sessionId?: string } }) =>
          n.type === 'ATTENDANCE_OPEN' && n.data.sessionId === sessions.closed,
      );
      expect(notice.action).toEqual({
        label: 'Registrar asistencia',
        path: `/asistencia/${sessions.closed}`,
      });
      expect(notice.body).toContain('cierra en 24 h');
      expect(mail.to(alice.email).some((m) => m.subject === 'Registra tu asistencia')).toBe(true);
    });

    it('prioridad alta fijada primero, contador, marcar leída y todas', async () => {
      const notifications = app.get(NotificationsService);
      await notifications.notify({
        userIds: [carol.id],
        type: 'GENERAL',
        title: 'Normal',
        body: 'Aviso normal',
        email: false,
      });
      await notifications.notify({
        userIds: [carol.id],
        type: 'INSTALLMENT_FAILED',
        title: 'Cobro fallido',
        body: 'Actualiza tu tarjeta',
        dedupeKey: 'e2e-failed',
      });
      const dup = await notifications.notify({
        userIds: [carol.id],
        type: 'INSTALLMENT_FAILED',
        title: 'Cobro fallido',
        body: 'dup',
        dedupeKey: 'e2e-failed',
      });
      expect(dup).toHaveLength(0);
      await notifications.notify({
        userIds: [carol.id],
        type: 'GENERAL',
        title: 'Más reciente',
        body: 'Último aviso',
        email: false,
      });

      const list = await get('/me/notifications', carol).expect(200);
      expect(list.body.data[0]).toMatchObject({
        type: 'INSTALLMENT_FAILED',
        pinned: true,
        priority: 'HIGH',
      });
      expect(list.body.data[1].title).toBe('Más reciente');
      expect((await get('/me/notifications/unread-count', carol).expect(200)).body).toEqual({
        unread: 3,
        pinned: 1,
      });

      const id = list.body.data[1].id;
      const read = await post(`/me/notifications/${id}/read`, carol).expect(200);
      expect(read.body.read).toBe(true);
      await post(`/me/notifications/${id}/read`, alice).expect(404); // ajena
      await post('/me/notifications/no-es-uuid/read', carol).expect(404);
      expect((await get('/me/notifications?unread=true', carol).expect(200)).body.meta.total).toBe(
        2,
      );

      expect((await post('/me/notifications/read-all', carol).expect(200)).body).toEqual({
        updated: 2,
      });
      expect((await get('/me/notifications/unread-count', carol).expect(200)).body).toEqual({
        unread: 0,
        pinned: 1,
      });
      expect(await notifications.resolve(carol.id, { types: ['INSTALLMENT_FAILED'] })).toBe(1);
      expect((await get('/me/notifications/unread-count', carol).expect(200)).body.pinned).toBe(0);
    });
  });

  describe('HU-17 Proyecto final', () => {
    const base = () => `/me/classrooms/${ids.diploma}/final-project`;

    it('pide URL, sube, confirma, reemplaza y descarga', async () => {
      const invalid = await post(`${base()}/upload-url`, alice, {
        fileName: 'foto.png',
        contentType: 'image/png',
        sizeBytes: 100,
      }).expect(422);
      expect(invalid.body.code).toBe('FINAL_PROJECT_INVALID_FILE');
      await post(`${base()}/upload-url`, alice, {
        fileName: 'grande.pdf',
        contentType: 'application/pdf',
        sizeBytes: 21 * 1024 * 1024,
      }).expect(422);

      const upload = await post(`${base()}/upload-url`, alice, {
        fileName: 'Proyecto Final.pdf',
        contentType: 'application/pdf',
        sizeBytes: 2048,
      }).expect(200);
      expect(upload.body).toMatchObject({
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
      });
      expect(upload.body.key).toMatch(new RegExp(`^final-projects/${ids.diploma}/${alice.id}/`));

      const missing = await put(base(), alice, { key: upload.body.key }).expect(422);
      expect(missing.body.code).toBe('FINAL_PROJECT_UPLOAD_NOT_FOUND');
      storage.put(upload.body.key, 'application/pdf', 2048);
      const confirmed = await put(base(), alice, {
        key: upload.body.key,
        fileName: 'Proyecto Final.pdf',
      }).expect(200);
      expect(confirmed.body.submission).toMatchObject({
        fileName: 'Proyecto Final.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
      });

      const second = await post(`${base()}/upload-url`, alice, {
        fileName: 'v2.zip',
        contentType: 'application/zip',
        sizeBytes: 4096,
      }).expect(200);
      storage.put(second.body.key, 'application/zip', 4096);
      await put(base(), alice, { key: second.body.key }).expect(200);
      expect(storage.deleted).toContain(upload.body.key);

      const download = await get(`${base()}/download`, alice).expect(200);
      expect(download.body).toMatchObject({ kind: 'FILE' });
      expect(download.body.url).toContain(second.body.key);
    });

    it('rechaza keys ajenas, cursos sin proyecto y no inscritos', async () => {
      const foreign = `final-projects/${ids.diploma}/${bob.id}/x.pdf`;
      storage.put(foreign, 'application/pdf', 10);
      expect((await put(base(), alice, { key: foreign }).expect(422)).body.code).toBe(
        'FINAL_PROJECT_UPLOAD_NOT_FOUND',
      );
      const course = await post(`/me/classrooms/${ids.course}/final-project/upload-url`, alice, {
        fileName: 'a.pdf',
        contentType: 'application/pdf',
        sizeBytes: 10,
      }).expect(422);
      expect(course.body.code).toBe('FINAL_PROJECT_NOT_AVAILABLE');
      await post(`${base()}/upload-url`, bob, {
        fileName: 'a.pdf',
        contentType: 'application/pdf',
        sizeBytes: 10,
      }).expect(403);
    });

    it('después de la fecha límite: solo lectura', async () => {
      await prisma.offer.update({
        where: { id: ids.diploma },
        data: { finalProjectDueAt: days(-1) },
      });
      const res = await post(`${base()}/upload-url`, alice, {
        fileName: 'tarde.pdf',
        contentType: 'application/pdf',
        sizeBytes: 10,
      }).expect(422);
      expect(res.body.code).toBe('FINAL_PROJECT_DEADLINE_PASSED');
      const classroom = await get(`/me/classrooms/${ids.diploma}`, alice).expect(200);
      expect(classroom.body.finalProject.submissionState).toBe('CLOSED');
      expect(classroom.body.finalProject.submission).not.toBeNull();
    });
  });

  describe('HU-06 Dashboard', () => {
    it('bloques con datos reales y sin fallos', async () => {
      const res = await get('/me/dashboard', alice).expect(200);
      expect(res.body.failedBlocks).toEqual([]);
      expect(res.body.formations.total).toBeGreaterThanOrEqual(3);
      expect(res.body.formations.items.length).toBeLessThanOrEqual(3);
      expect(res.body.nextActivity).toMatchObject({ source: 'SESSION', id: sessions.soon });
      expect(res.body.nextActivity.join.state).toBe('OPEN');
      expect(Array.isArray(res.body.upcomingEvents)).toBe(true);
      expect(Array.isArray(res.body.recommendedResources)).toBe(true);
      expect(res.body.notifications.unread).toBeGreaterThan(0);
    });

    it('sin formación: bloques vacíos (mensaje orientador en la UI)', async () => {
      const fresh = await newUser();
      const res = await get('/me/dashboard', fresh).expect(200);
      expect(res.body).toMatchObject({ formations: { items: [], total: 0 }, failedBlocks: [] });
      // Sin inscripciones solo puede haber eventos generales (nunca sesiones de clase).
      expect(res.body.nextActivity?.source ?? null).not.toBe('SESSION');
    });
  });
});
