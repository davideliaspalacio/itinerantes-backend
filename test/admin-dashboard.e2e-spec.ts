import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { MAIL_DRIVER } from '../src/infra/mail/mail.types';
import { createParticipant, createStaffUser, type TestUser } from './utils/admin';
import { createTestApp } from './utils/create-test-app';
import { MailCapture } from './utils/mail-capture';

/** Inicio del panel: `GET /admin/dashboard` y `GET /admin/dashboard/trends`. */
describe('Admin – Dashboard (e2e)', () => {
  jest.setTimeout(120_000);

  let app: NestExpressApplication;
  const mail = new MailCapture();

  let superAdmin: TestUser;
  let committee: TestUser;
  let finance: TestUser;
  let participant: TestUser;

  const get = (path: string, u: TestUser) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', `Bearer ${u.token}`);

  beforeAll(async () => {
    app = await createTestApp({
      customize: (builder) => builder.overrideProvider(MAIL_DRIVER).useValue(mail),
    });
    [superAdmin, committee, finance, participant] = await Promise.all([
      createStaffUser(app, mail, ['SUPER_ADMIN']),
      createStaffUser(app, mail, ['REVIEW_COMMITTEE']),
      createStaffUser(app, mail, ['FINANCE']),
      createParticipant(app, mail),
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('SUPER_ADMIN recibe todos los bloques', async () => {
    const res = await get('/admin/dashboard', superAdmin).expect(200);
    const body = res.body;
    expect(body.period).toEqual({ from: expect.any(String), to: expect.any(String) });
    expect(new Date(body.period.to).getTime() - new Date(body.period.from).getTime()).toBe(
      30 * 24 * 60 * 60 * 1000,
    );
    expect(body.people).toMatchObject({
      total: expect.any(Number),
      active: expect.any(Number),
      newInPeriod: expect.any(Number),
    });
    expect(body.people.total).toBe(
      body.people.active + body.people.pendingVerification + body.people.disabled,
    );
    expect(body.training.enrollments).toHaveProperty('pendingPayment');
    expect(body.applications.byStatus.map((s: { status: string }) => s.status)).not.toContain(
      'DRAFT',
    );
    expect(body.payments.currencies.map((c: { currency: string }) => c.currency)).toEqual([
      'MXN',
      'USD',
    ]);
    expect(body.contact).toEqual({ unread: expect.any(Number) });
    for (const task of body.tasks) expect(task.count).toBeGreaterThan(0);
  });

  it('una persona registrada en el periodo suma; el equipo no cuenta como participante', async () => {
    const before = (await get('/admin/dashboard', superAdmin).expect(200)).body.people;
    await createParticipant(app, mail);
    await createStaffUser(app, mail, ['FOLLOW_UP']);
    const after = (await get('/admin/dashboard', superAdmin).expect(200)).body.people;
    expect(after.total).toBe(before.total + 1);
    expect(after.newInPeriod).toBe(before.newInPeriod + 1);
  });

  it('cada rol ve solo lo suyo', async () => {
    const asCommittee = (await get('/admin/dashboard', committee).expect(200)).body;
    expect(asCommittee.applications).not.toBeNull();
    expect(asCommittee.contact).toBeNull();
    expect(asCommittee.tasks.some((t: { key: string }) => t.key === 'CONTACT_UNREAD')).toBe(false);

    const asFinance = (await get('/admin/dashboard', finance).expect(200)).body;
    expect(asFinance.applications).toBeNull();
    expect(asFinance.payments).not.toBeNull();
    expect(asFinance.training).not.toBeNull();

    const trends = (await get('/admin/dashboard/trends?months=3', finance).expect(200)).body;
    expect(trends.months[0].submittedApplications).toBeNull();
    expect(trends.months[0].netMxnCents).toEqual(expect.any(Number));
  });

  it('trends devuelve un elemento por mes, del más antiguo al actual', async () => {
    const res = await get('/admin/dashboard/trends?months=4', superAdmin).expect(200);
    const months: { month: string; newParticipants: number }[] = res.body.months;
    expect(months).toHaveLength(4);
    expect([...months].map((m) => m.month).sort()).toEqual(months.map((m) => m.month));
    expect(months.at(-1)!.month).toMatch(/^\d{4}-\d{2}$/);
    expect(months.at(-1)!.newParticipants).toBeGreaterThanOrEqual(1);

    const byDefault = await get('/admin/dashboard/trends', superAdmin).expect(200);
    expect(byDefault.body.months).toHaveLength(6);
  });

  it('valida parámetros', async () => {
    await get('/admin/dashboard?from=no-es-fecha', superAdmin).expect(400);
    await get(
      '/admin/dashboard?from=2026-10-10T00:00:00.000Z&to=2026-10-01T00:00:00.000Z',
      superAdmin,
    ).expect(400);
    await get('/admin/dashboard/trends?months=0', superAdmin).expect(400);
    await get('/admin/dashboard/trends?months=25', superAdmin).expect(400);
  });

  it('participantes → 403; sin sesión → 401', async () => {
    await get('/admin/dashboard', participant).expect(403);
    await get('/admin/dashboard/trends', participant).expect(403);
    await request(app.getHttpServer()).get('/api/v1/admin/dashboard').expect(401);
  });
});
