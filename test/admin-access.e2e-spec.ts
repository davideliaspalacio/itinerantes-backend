import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { MAIL_DRIVER } from '../src/infra/mail/mail.types';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { createParticipant, createStaffUser, type TestUser } from './utils/admin';
import { createTestApp } from './utils/create-test-app';
import { randomIp } from './utils/identity';
import { MailCapture } from './utils/mail-capture';

/**
 * Panel administrativo (Fase 06) — acceso: permisos por rol (`PermissionsGuard` con roles leídos de
 * la BD), `GET /admin/me`, catálogo de roles, gestión de roles/estado del equipo y auditoría.
 */
describe('Admin – acceso, equipo y auditoría (e2e) — Fase 06', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const mail = new MailCapture();

  let superAdmin: TestUser;
  let coordinator: TestUser;
  let finance: TestUser;
  let participant: TestUser;
  let target: TestUser;

  const api = () => request(app.getHttpServer());
  const as = (u: TestUser) => ({ Authorization: `Bearer ${u.token}` });

  beforeAll(async () => {
    app = await createTestApp({
      customize: (b) => b.overrideProvider(MAIL_DRIVER).useValue(mail),
    });
    prisma = app.get(PrismaService);
    superAdmin = await createStaffUser(app, mail, ['SUPER_ADMIN']);
    coordinator = await createStaffUser(app, mail, ['ACADEMIC_COORDINATOR']);
    finance = await createStaffUser(app, mail, ['FINANCE']);
    participant = await createParticipant(app, mail);
    target = await createParticipant(app, mail);
  }, 180_000);

  afterAll(async () => {
    await app.close();
  });

  describe('GET /admin/me', () => {
    it('sin token → 401; participante → 403 FORBIDDEN con meta.missingPermissions', async () => {
      await api().get('/api/v1/admin/me').expect(401);
      const res = await api().get('/api/v1/admin/me').set(as(participant)).expect(403);
      expect(res.body).toMatchObject({
        code: 'FORBIDDEN',
        meta: { missingPermissions: ['admin.access'] },
      });
    });

    it('coordinación: roles y permisos efectivos (sin pagos.manage ni users.manage)', async () => {
      const res = await api().get('/api/v1/admin/me').set(as(coordinator)).expect(200);
      expect(res.body.user.email).toBe(coordinator.email);
      expect(res.body.roles).toEqual(['PARTICIPANT', 'ACADEMIC_COORDINATOR']);
      expect(res.body.permissions).toEqual(
        expect.arrayContaining(['admin.access', 'offers.write', 'applications.decide']),
      );
      expect(res.body.permissions).not.toContain('payments.manage');
      expect(res.body.permissions).not.toContain('users.manage');
    });

    it('SUPER_ADMIN tiene todos los permisos', async () => {
      const res = await api().get('/api/v1/admin/me').set(as(superAdmin)).expect(200);
      expect(res.body.permissions).toEqual(
        expect.arrayContaining(['users.manage', 'audit.read', 'payments.manage']),
      );
    });

    it('GET /admin/roles: matriz con textos', async () => {
      const res = await api().get('/api/v1/admin/roles').set(as(finance)).expect(200);
      const financeRole = res.body.data.find((r: { role: string }) => r.role === 'FINANCE');
      expect(financeRole).toMatchObject({ label: 'Administración y finanzas' });
      expect(financeRole.permissions).toContain('payments.manage');
    });
  });

  describe('Gestión de roles del equipo', () => {
    it('solo users.manage: coordinación y finanzas → 403', async () => {
      await api().get('/api/v1/admin/users').set(as(coordinator)).expect(403);
      await api()
        .put(`/api/v1/admin/users/${target.id}/roles`)
        .set(as(finance))
        .send({ roles: ['FINANCE'] })
        .expect(403);
    });

    it('lista y busca cuentas (staffOnly)', async () => {
      const res = await api()
        .get(`/api/v1/admin/users?q=${encodeURIComponent(finance.email)}&staffOnly=true`)
        .set(as(superAdmin))
        .expect(200);
      expect(res.body.meta.total).toBe(1);
      expect(res.body.data[0]).toMatchObject({
        email: finance.email,
        roles: ['PARTICIPANT', 'FINANCE'],
      });
    });

    it('asignar rol aplica DE INMEDIATO (el token previo ya entra al panel) y queda auditado', async () => {
      await api().get('/api/v1/admin/me').set(as(target)).expect(403);
      const res = await api()
        .put(`/api/v1/admin/users/${target.id}/roles`)
        .set(as(superAdmin))
        .send({ roles: ['FOLLOW_UP'] })
        .expect(200);
      expect(res.body.roles).toEqual(['PARTICIPANT', 'FOLLOW_UP']);
      const me = await api().get('/api/v1/admin/me').set(as(target)).expect(200);
      expect(me.body.permissions).toContain('followup.manage');

      const log = await prisma.adminAuditLog.findFirst({
        where: { action: 'user.update-roles', entityId: target.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(log).toMatchObject({ actorId: superAdmin.id, actorEmail: superAdmin.email });
      expect(log?.changes).toMatchObject({
        before: { roles: ['PARTICIPANT'] },
        after: { roles: ['PARTICIPANT', 'FOLLOW_UP'] },
      });
    });

    it('rol inválido → 400 VALIDATION_ERROR', async () => {
      const res = await api()
        .put(`/api/v1/admin/users/${target.id}/roles`)
        .set(as(superAdmin))
        .send({ roles: ['ROOT'] })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('nadie se quita su propio SUPER_ADMIN ni se deshabilita', async () => {
      const res = await api()
        .put(`/api/v1/admin/users/${superAdmin.id}/roles`)
        .set(as(superAdmin))
        .send({ roles: ['FINANCE'] })
        .expect(409);
      expect(res.body.code).toBe('ADMIN_SELF_ACTION');
      await api()
        .post(`/api/v1/admin/users/${superAdmin.id}/disable`)
        .set(as(superAdmin))
        .send({})
        .expect(409);
    });

    it('deshabilitar: pierde el panel al instante, no puede iniciar sesión; habilitar lo revierte', async () => {
      const res = await api()
        .post(`/api/v1/admin/users/${target.id}/disable`)
        .set(as(superAdmin))
        .send({ reason: 'Dejó de colaborar' })
        .expect(200);
      expect(res.body.status).toBe('DISABLED');
      await api().get('/api/v1/admin/me').set(as(target)).expect(403);
      const login = await api()
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', randomIp())
        .send({ email: target.email, password: 'Agua2026segura' })
        .expect(403);
      expect(login.body.code).toBe('AUTH_ACCOUNT_DISABLED');
      const tokens = await prisma.refreshToken.count({
        where: { userId: target.id, revokedAt: null },
      });
      expect(tokens).toBe(0);

      await api()
        .post(`/api/v1/admin/users/${target.id}/enable`)
        .set(as(superAdmin))
        .send({})
        .expect(200);
      await api().get('/api/v1/admin/me').set(as(target)).expect(200);
      const actions = await prisma.adminAuditLog.findMany({
        where: { entityId: target.id, action: { in: ['user.disable', 'user.enable'] } },
      });
      expect(actions.map((a) => a.action).sort()).toEqual(['user.disable', 'user.enable']);
    });

    it('id no UUID o inexistente → 404', async () => {
      await api()
        .put('/api/v1/admin/users/abc/roles')
        .set(as(superAdmin))
        .send({ roles: [] })
        .expect(404);
      await api()
        .post('/api/v1/admin/users/00000000-0000-4000-8000-000000000000/enable')
        .set(as(superAdmin))
        .send({})
        .expect(404);
    });
  });

  describe('GET /admin/audit-logs', () => {
    it('solo audit.read (SUPER_ADMIN): coordinación → 403', async () => {
      await api().get('/api/v1/admin/audit-logs').set(as(coordinator)).expect(403);
    });

    it('filtra por entidad y por prefijo de acción, más reciente primero', async () => {
      const res = await api()
        .get(`/api/v1/admin/audit-logs?entityType=User&entityId=${target.id}&action=user.`)
        .set(as(superAdmin))
        .expect(200);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(3);
      expect(res.body.data[0]).toMatchObject({
        action: 'user.enable',
        entityType: 'User',
        actor: { id: superAdmin.id, email: superAdmin.email },
      });
      expect(typeof res.body.data[0].summary).toBe('string');
    });
  });
});
