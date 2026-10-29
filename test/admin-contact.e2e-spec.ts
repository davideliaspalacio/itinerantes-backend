import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { MAIL_DRIVER } from '../src/infra/mail/mail.types';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { createParticipant, createStaffUser, type TestUser } from './utils/admin';
import { createTestApp } from './utils/create-test-app';
import { PASSWORD, randomIp, registrationBody } from './utils/identity';
import { MailCapture } from './utils/mail-capture';

/**
 * Bandeja de Contacto del panel (HU-38) y verificación manual del correo de una cuenta (HU-03,
 * soporte para el equipo).
 */
describe('Admin – Contacto y verificación de correo (e2e)', () => {
  jest.setTimeout(120_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  const mail = new MailCapture();
  const token = randomUUID().slice(0, 8);

  let superAdmin: TestUser;
  let coordinator: TestUser;
  let followUp: TestUser;
  let finance: TestUser;
  let participant: TestUser;

  const api = () => request(app.getHttpServer());
  const as = (u: TestUser) => ({ Authorization: `Bearer ${u.token}` });
  const get = (path: string, u: TestUser) => api().get(`/api/v1${path}`).set(as(u));
  const post = (path: string, u: TestUser, body: object = {}) =>
    api().post(`/api/v1${path}`).set(as(u)).send(body);
  const patch = (path: string, u: TestUser, body: object = {}) =>
    api().patch(`/api/v1${path}`).set(as(u)).send(body);

  const sendContact = (body: Record<string, unknown>) =>
    api()
      .post('/api/v1/contact-messages')
      .set('X-Forwarded-For', randomIp())
      .send({
        name: 'Lucía Hernández',
        subject: 'SCHOOL',
        message: `Quisiera información sobre el diplomado ${token}.`,
        privacyAccepted: true,
        origin: 'CONTACT_PAGE',
        ...body,
      })
      .expect(201);

  beforeAll(async () => {
    app = await createTestApp({
      customize: (builder) => builder.overrideProvider(MAIL_DRIVER).useValue(mail),
    });
    prisma = app.get(PrismaService);
    [superAdmin, coordinator, followUp, finance, participant] = await Promise.all([
      createStaffUser(app, mail, ['SUPER_ADMIN']),
      createStaffUser(app, mail, ['ACADEMIC_COORDINATOR']),
      createStaffUser(app, mail, ['FOLLOW_UP']),
      createStaffUser(app, mail, ['FINANCE']),
      createParticipant(app, mail),
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Bandeja de Contacto', () => {
    let schoolId: string;
    let designId: string;

    beforeAll(async () => {
      schoolId = (await sendContact({ email: `escuela-${token}@example.com` })).body.id;
      designId = (
        await sendContact({
          email: `diseno-${token}@example.com`,
          name: `Cooperativa ${token}`,
          subject: 'DESIGN_CONSULTING',
          projectType: 'COLLECTIVE',
          projectLocation: 'Oaxaca',
          service: 'NOT_SURE',
          organization: 'Agua Viva',
          phone: { countryCode: '+52', number: '5512345678' },
          origin: 'LANDING',
        })
      ).body.id;
    });

    it('lista con búsqueda, filtros y etiquetas en español', async () => {
      const res = await get(`/admin/contact-messages?q=${token}`, coordinator).expect(200);
      expect(res.body.meta.total).toBe(2);
      expect(res.body.data[0].id).toBe(designId); // más reciente primero
      expect(res.body.data[0]).toMatchObject({
        subject: 'DESIGN_CONSULTING',
        subjectLabel: 'Diseño y asesoría',
        origin: 'LANDING',
        originLabel: 'Landing',
        status: 'NEW',
        statusLabel: 'Nuevo',
        phone: { countryCode: '+52', number: '5512345678' },
        projectType: 'COLLECTIVE',
        handledBy: null,
      });
      expect(res.body.data[0]).not.toHaveProperty('ipHash');

      const filtered = await get(
        `/admin/contact-messages?q=${token}&subject=SCHOOL&sort=CREATED_ASC`,
        followUp,
      ).expect(200);
      expect(filtered.body.data.map((m: { id: string }) => m.id)).toEqual([schoolId]);

      await get('/admin/contact-messages?status=NOPE', coordinator).expect(400);
    });

    it('detalle y 404 con id inexistente o mal formado', async () => {
      const res = await get(`/admin/contact-messages/${schoolId}`, coordinator).expect(200);
      expect(res.body).toMatchObject({ id: schoolId, email: `escuela-${token}@example.com` });
      await get(`/admin/contact-messages/${randomUUID()}`, coordinator).expect(404);
      await get('/admin/contact-messages/no-es-uuid', coordinator).expect(404);
    });

    it('cambiar estado y nota guarda quién lo hizo y queda en auditoría', async () => {
      const res = await patch(`/admin/contact-messages/${schoolId}`, followUp, {
        status: 'IN_PROGRESS',
        internalNote: '  Se le envió el temario.  ',
      }).expect(200);
      expect(res.body).toMatchObject({
        status: 'IN_PROGRESS',
        statusLabel: 'En atención',
        internalNote: 'Se le envió el temario.',
        handledBy: { id: followUp.id, email: followUp.email },
        handledAt: expect.any(String),
      });

      const cleared = await patch(`/admin/contact-messages/${schoolId}`, coordinator, {
        internalNote: null,
      }).expect(200);
      expect(cleared.body).toMatchObject({ status: 'IN_PROGRESS', internalNote: null });

      const logs = await prisma.adminAuditLog.findMany({
        where: { entityType: 'ContactMessage', entityId: schoolId },
        orderBy: { createdAt: 'asc' },
      });
      expect(logs.map((l) => l.action)).toEqual(['contact.update', 'contact.update']);
      expect(logs[0].summary).toContain('«En atención»');
    });

    it('PATCH vacío o con datos inválidos → 400', async () => {
      await patch(`/admin/contact-messages/${designId}`, coordinator, {}).expect(400);
      await patch(`/admin/contact-messages/${designId}`, coordinator, {
        status: 'DONE',
      }).expect(400);
      await patch(`/admin/contact-messages/${designId}`, coordinator, {
        internalNote: 'x'.repeat(2001),
      }).expect(400);
    });

    it('summary devuelve el contador de nuevos y todos los estados', async () => {
      const res = await get('/admin/contact-messages/summary', superAdmin).expect(200);
      expect(res.body.unread).toBeGreaterThanOrEqual(1);
      expect(res.body.byStatus.map((s: { status: string }) => s.status)).toEqual([
        'NEW',
        'IN_PROGRESS',
        'ANSWERED',
        'ARCHIVED',
      ]);
    });

    it('permisos: FINANCE y participantes → 403; sin sesión → 401', async () => {
      await get('/admin/contact-messages', finance).expect(403);
      await get('/admin/contact-messages', participant).expect(403);
      await patch(`/admin/contact-messages/${schoolId}`, finance, { status: 'ANSWERED' }).expect(
        403,
      );
      await api().get('/api/v1/admin/contact-messages').expect(401);
    });
  });

  describe('Verificación manual del correo', () => {
    const registerUnverified = async () => {
      const body = await registrationBody(app);
      await api()
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', randomIp())
        .send(body)
        .expect(201);
      const user = await prisma.user.update({
        where: { email: body.email as string },
        data: { roles: ['PARTICIPANT', 'FINANCE'] },
      });
      return user;
    };

    it('deja la cuenta ACTIVE, invalida el OTP, permite login y queda en auditoría', async () => {
      const user = await registerUnverified();
      const pendingOtp = mail.lastOtp(user.email);
      await api()
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', randomIp())
        .send({ email: user.email, password: PASSWORD })
        .expect(403);

      const res = await post(`/admin/users/${user.id}/verify-email`, superAdmin, {
        reason: 'No le llega el código',
      }).expect(200);
      expect(res.body).toMatchObject({
        id: user.id,
        status: 'ACTIVE',
        emailVerifiedAt: expect.any(String),
      });

      await api()
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', randomIp())
        .send({ email: user.email, password: PASSWORD })
        .expect(200);

      // El código que había quedado pendiente ya no sirve.
      const otpRes = await api()
        .post('/api/v1/auth/verify-email')
        .set('X-Forwarded-For', randomIp())
        .send({ email: user.email, code: pendingOtp })
        .expect(409);
      expect(otpRes.body.code).toBe('AUTH_ALREADY_VERIFIED');

      const log = await prisma.adminAuditLog.findFirstOrThrow({
        where: { entityId: user.id, action: 'user.verify-email' },
      });
      expect(log.summary).toContain('No le llega el código');

      const again = await post(`/admin/users/${user.id}/verify-email`, superAdmin).expect(409);
      expect(again.body.code).toBe('AUTH_ALREADY_VERIFIED');
    });

    it('una cuenta DISABLED sigue deshabilitada', async () => {
      const user = await registerUnverified();
      await prisma.user.update({ where: { id: user.id }, data: { status: 'DISABLED' } });
      const res = await post(`/admin/users/${user.id}/verify-email`, superAdmin).expect(200);
      expect(res.body).toMatchObject({ status: 'DISABLED', emailVerifiedAt: expect.any(String) });
    });

    it('solo users.manage; id inexistente → 404', async () => {
      const user = await registerUnverified();
      await post(`/admin/users/${user.id}/verify-email`, coordinator).expect(403);
      await post(`/admin/users/${randomUUID()}/verify-email`, superAdmin).expect(404);
    });

    it('POST /auth/verify-email con startSession inicia sesión; sin él no', async () => {
      const plain = await registrationBody(app);
      const withSession = await registrationBody(app);
      for (const body of [plain, withSession]) {
        await api()
          .post('/api/v1/auth/register')
          .set('X-Forwarded-For', randomIp())
          .send(body)
          .expect(201);
      }

      const noSession = await api()
        .post('/api/v1/auth/verify-email')
        .set('X-Forwarded-For', randomIp())
        .send({ email: plain.email, code: mail.lastOtp(plain.email as string) })
        .expect(200);
      expect(noSession.body).toEqual({ verified: true, email: plain.email });

      const res = await api()
        .post('/api/v1/auth/verify-email')
        .set('X-Forwarded-For', randomIp())
        .send({
          email: withSession.email,
          code: mail.lastOtp(withSession.email as string),
          startSession: true,
          rememberMe: true,
        })
        .expect(200);
      expect(res.body).toMatchObject({
        verified: true,
        session: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          tokenType: 'Bearer',
          user: { email: withSession.email },
        },
      });
      await api()
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${res.body.session.accessToken}`)
        .expect(200);
    });

    it('el listado de cuentas expone emailVerifiedAt', async () => {
      const res = await get(
        `/admin/users?q=${encodeURIComponent(finance.email)}`,
        superAdmin,
      ).expect(200);
      expect(res.body.data[0].emailVerifiedAt).toEqual(expect.any(String));
    });
  });
});
