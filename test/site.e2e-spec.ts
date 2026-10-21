import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { MAIL_DRIVER } from '../src/infra/mail/mail.types';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { DEFAULT_SITE_METRICS } from '../src/modules/site/site-metrics.defaults';
import { createParticipant, createStaffUser, type TestUser } from './utils/admin';
import { createTestApp } from './utils/create-test-app';
import { MailCapture } from './utils/mail-capture';

/** Cifras de impacto de la landing (HU-01): lectura pública y edición SUPER_ADMIN. */
describe('Sitio – cifras de la landing (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const mail = new MailCapture();
  let superAdmin: TestUser;
  let coordinator: TestUser;
  let participant: TestUser;

  const api = () => request(app.getHttpServer());
  const as = (u: TestUser) => ({ Authorization: `Bearer ${u.token}` });

  beforeAll(async () => {
    app = await createTestApp({ customize: (b) => b.overrideProvider(MAIL_DRIVER).useValue(mail) });
    prisma = app.get(PrismaService);
    await prisma.siteMetric.deleteMany();
    await prisma.siteMetric.createMany({ data: DEFAULT_SITE_METRICS.map((m) => ({ ...m })) });
    superAdmin = await createStaffUser(app, mail, ['SUPER_ADMIN']);
    coordinator = await createStaffUser(app, mail, ['ACADEMIC_COORDINATOR']);
    participant = await createParticipant(app, mail);
  }, 180_000);

  afterAll(async () => {
    await app.close();
  });

  it('GET /site/metrics es público, ordenado y con display formateado', async () => {
    const res = await api().get('/api/v1/site/metrics').expect(200);
    expect(res.headers['cache-control']).toContain('max-age=300');
    expect(res.body.data.map((m: { key: string }) => m.key)).toEqual([
      'WATER_LITERS_REVITALIZED',
      'PEOPLE_TRAINED',
      'TERRITORIES_ACCOMPANIED',
      'YOUTH_TRAINED',
    ]);
    expect(res.body.data[0]).toMatchObject({ value: 3_000_000, display: '+3,000,000 L' });
    expect(res.body.data[1]).toMatchObject({ value: 1800, display: '1,800+' });
  });

  it('editar requiere site.write: participante y coordinación → 403', async () => {
    await api().patch('/api/v1/admin/site/metrics/PEOPLE_TRAINED').send({ value: 1 }).expect(401);
    await api()
      .patch('/api/v1/admin/site/metrics/PEOPLE_TRAINED')
      .set(as(participant))
      .send({ value: 1 })
      .expect(403);
    await api()
      .patch('/api/v1/admin/site/metrics/PEOPLE_TRAINED')
      .set(as(coordinator))
      .send({ value: 1 })
      .expect(403);
  });

  it('SUPER_ADMIN edita, oculta y queda auditado; la clave inexistente da 404', async () => {
    const res = await api()
      .patch('/api/v1/admin/site/metrics/PEOPLE_TRAINED')
      .set(as(superAdmin))
      .send({ value: 1950 })
      .expect(200);
    expect(res.body).toMatchObject({ value: 1950, display: '1,950+', visible: true });

    await api()
      .patch('/api/v1/admin/site/metrics/YOUTH_TRAINED')
      .set(as(superAdmin))
      .send({ visible: false })
      .expect(200);
    const pub = await api().get('/api/v1/site/metrics').expect(200);
    expect(pub.body.data.map((m: { key: string }) => m.key)).not.toContain('YOUTH_TRAINED');

    const all = await api().get('/api/v1/admin/site/metrics').set(as(superAdmin)).expect(200);
    expect(all.body).toHaveLength(4);

    await api()
      .patch('/api/v1/admin/site/metrics/NOPE')
      .set(as(superAdmin))
      .send({ value: 1 })
      .expect(404);
    await api()
      .patch('/api/v1/admin/site/metrics/PEOPLE_TRAINED')
      .set(as(superAdmin))
      .send({ value: -5 })
      .expect(400);

    const log = await prisma.adminAuditLog.findFirst({
      where: { action: 'site_metric.update', entityId: 'PEOPLE_TRAINED' },
    });
    expect(log).not.toBeNull();
  });
});
