import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { isMeetingUrl, isZoomUrl } from '../src/common/utils/urls';
import { MEETING_GATEWAY } from '../src/infra/meetings/meeting-gateway';
import { MAIL_DRIVER } from '../src/infra/mail/mail.types';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { createParticipant, createStaffUser, type TestUser } from './utils/admin';
import { createTestApp } from './utils/create-test-app';
import { FakeMeetingGateway } from './utils/fake-meeting-gateway';
import { MailCapture } from './utils/mail-capture';

/**
 * Reuniones generadas desde el panel (Zoom / Google Meet) con un gateway falso: proveedores
 * habilitados, alta, enlace de anfitrión nuevo, cancelación, permisos, validación y auditoría.
 */
describe('Reuniones generadas (e2e)', () => {
  jest.setTimeout(120_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  const mail = new MailCapture();
  const gateway = new FakeMeetingGateway();

  let coordinator: TestUser;
  let committee: TestUser;
  let finance: TestUser;
  let participant: TestUser;

  const api = () => request(app.getHttpServer());
  const as = (u: TestUser) => ({ Authorization: `Bearer ${u.token}` });
  const get = (path: string, u: TestUser) => api().get(`/api/v1${path}`).set(as(u));
  const post = (path: string, u: TestUser, body: object = {}) =>
    api().post(`/api/v1${path}`).set(as(u)).send(body);
  const del = (path: string, u: TestUser) => api().delete(`/api/v1${path}`).set(as(u));

  const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
  const valid = (overrides: object = {}) => ({
    provider: 'ZOOM',
    topic: 'Diplomado Gestión del Agua — Sesión 3',
    startAt: inDays(7),
    durationMinutes: 90,
    ...overrides,
  });

  beforeAll(async () => {
    app = await createTestApp({
      customize: (b) =>
        b
          .overrideProvider(MAIL_DRIVER)
          .useValue(mail)
          .overrideProvider(MEETING_GATEWAY)
          .useValue(gateway),
    });
    prisma = app.get(PrismaService);
    coordinator = await createStaffUser(app, mail, ['ACADEMIC_COORDINATOR']);
    committee = await createStaffUser(app, mail, ['REVIEW_COMMITTEE']);
    finance = await createStaffUser(app, mail, ['FINANCE']);
    participant = await createParticipant(app, mail);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    gateway.enabled = ['ZOOM', 'GOOGLE_MEET'];
    gateway.nextError = null;
  });

  describe('permisos', () => {
    it('sin token 401; participante y FINANCE 403 con meta.missingPermissions', async () => {
      await api().get('/api/v1/admin/meetings/providers').expect(401);
      await get('/admin/meetings/providers', participant).expect(403);
      const res = await post('/admin/meetings', finance, valid()).expect(403);
      expect(res.body).toMatchObject({
        code: 'FORBIDDEN',
        meta: { missingPermissions: ['meetings.create'] },
      });
      await del('/admin/meetings/ZOOM/123', finance).expect(403);
    });

    it('coordinación y comité tienen meetings.create (GET /admin/me)', async () => {
      for (const user of [coordinator, committee]) {
        const me = await get('/admin/me', user).expect(200);
        expect(me.body.permissions).toContain('meetings.create');
      }
      const me = await get('/admin/me', finance).expect(200);
      expect(me.body.permissions).not.toContain('meetings.create');
    });
  });

  describe('GET /admin/meetings/providers', () => {
    it('lista ambos con enabled y usableForInterviews', async () => {
      const res = await get('/admin/meetings/providers', committee).expect(200);
      expect(res.body).toEqual({
        data: [
          { provider: 'ZOOM', label: 'Zoom', enabled: true, usableForInterviews: true },
          {
            provider: 'GOOGLE_MEET',
            label: 'Google Meet',
            enabled: true,
            usableForInterviews: false,
          },
        ],
      });
    });

    it('refleja los proveedores sin credenciales', async () => {
      gateway.enabled = ['ZOOM'];
      const res = await get('/admin/meetings/providers', coordinator).expect(200);
      expect(res.body.data.map((p: { enabled: boolean }) => p.enabled)).toEqual([true, false]);
    });
  });

  describe('POST /admin/meetings', () => {
    it('Zoom: 201 con enlaces válidos para sesión (HU-29) y entrevista (HU-31) + auditoría', async () => {
      const body = valid({ timezone: 'America/Bogota' });
      const res = await post('/admin/meetings', coordinator, body).expect(201);
      expect(res.body).toEqual({
        provider: 'ZOOM',
        externalId: expect.stringMatching(/^\d+$/),
        joinUrl: expect.any(String),
        hostUrl: expect.any(String),
        password: expect.any(String),
        startAt: new Date(body.startAt).toISOString(),
        durationMinutes: 90,
      });
      expect(isZoomUrl(res.body.joinUrl)).toBe(true);
      expect(isZoomUrl(res.body.hostUrl)).toBe(true);
      const stored = gateway.meetings.get(`ZOOM:${res.body.externalId}`);
      expect(stored).toMatchObject({ topic: body.topic, timezone: 'America/Bogota' });

      const audit = await prisma.adminAuditLog.findFirst({
        where: { action: 'meeting.create', entityId: `ZOOM:${res.body.externalId}` },
      });
      expect(audit).toMatchObject({ actorId: coordinator.id, entityType: 'Meeting' });
      expect(JSON.stringify(audit?.changes)).not.toContain('zak=');
    });

    it('Google Meet: hostUrl = joinUrl, sin contraseña, zona por defecto CDMX', async () => {
      const res = await post(
        '/admin/meetings',
        committee,
        valid({ provider: 'GOOGLE_MEET' }),
      ).expect(201);
      expect(isMeetingUrl(res.body.joinUrl)).toBe(true);
      expect(res.body.hostUrl).toBe(res.body.joinUrl);
      expect(res.body.password).toBeNull();
      expect(gateway.meetings.get(`GOOGLE_MEET:${res.body.externalId}`)?.timezone).toBe(
        'America/Mexico_City',
      );
    });

    it('400 VALIDATION_ERROR por campo', async () => {
      const res = await post('/admin/meetings', coordinator, {
        provider: 'TEAMS',
        topic: 'ab',
        startAt: 'mañana',
        durationMinutes: 5,
        timezone: 'Marte/Olympus',
      }).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      const fields = (res.body.details as Array<{ field: string }>).map((d) => d.field);
      expect(fields).toEqual(
        expect.arrayContaining(['provider', 'topic', 'startAt', 'durationMinutes', 'timezone']),
      );

      const tooLong = await post('/admin/meetings', coordinator, valid({ durationMinutes: 481 }));
      expect(tooLong.status).toBe(400);

      const past = await post(
        '/admin/meetings',
        coordinator,
        valid({ startAt: inDays(-1) }),
      ).expect(400);
      expect(past.body.details).toEqual([
        expect.objectContaining({ field: 'startAt', code: 'MUST_BE_FUTURE' }),
      ]);
    });

    it('503 MEETING_PROVIDER_NOT_CONFIGURED y 502 MEETING_PROVIDER_ERROR', async () => {
      gateway.enabled = ['ZOOM'];
      const off = await post(
        '/admin/meetings',
        coordinator,
        valid({ provider: 'GOOGLE_MEET' }),
      ).expect(503);
      expect(off.body).toMatchObject({
        code: 'MEETING_PROVIDER_NOT_CONFIGURED',
        meta: { provider: 'GOOGLE_MEET' },
      });

      gateway.nextError = 'MEETING_PROVIDER_ERROR';
      const failed = await post('/admin/meetings', coordinator, valid()).expect(502);
      expect(failed.body.code).toBe('MEETING_PROVIDER_ERROR');
    });
  });

  describe('host-url y cancelación', () => {
    it('GET host-url devuelve un start_url nuevo; DELETE 204 + auditoría; luego host-url 404', async () => {
      const created = await post('/admin/meetings', coordinator, valid()).expect(201);
      const { externalId, hostUrl } = created.body as { externalId: string; hostUrl: string };

      const fresh = await get(`/admin/meetings/ZOOM/${externalId}/host-url`, committee).expect(200);
      expect(fresh.body).toEqual({ provider: 'ZOOM', externalId, hostUrl: expect.any(String) });
      expect(fresh.body.hostUrl).not.toBe(hostUrl);
      expect(isZoomUrl(fresh.body.hostUrl)).toBe(true);

      await del(`/admin/meetings/ZOOM/${externalId}`, coordinator).expect(204);
      expect(gateway.cancelled).toContain(`ZOOM:${externalId}`);
      const audit = await prisma.adminAuditLog.findFirst({
        where: { action: 'meeting.cancel', entityId: `ZOOM:${externalId}` },
      });
      expect(audit).toMatchObject({ actorId: coordinator.id, entityType: 'Meeting' });

      const gone = await get(`/admin/meetings/ZOOM/${externalId}/host-url`, coordinator).expect(
        404,
      );
      expect(gone.body.code).toBe('NOT_FOUND');
    });

    it('proveedor o id de ruta inválidos → 404', async () => {
      await del('/admin/meetings/TEAMS/123', coordinator).expect(404);
      await get('/admin/meetings/ZOOM/a.b/host-url', coordinator).expect(404);
    });
  });
});
