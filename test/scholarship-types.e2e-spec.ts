import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { addDaysInZone } from '../src/common/utils/time';
import type { Prisma } from '../src/generated/prisma/client';
import { MAIL_DRIVER } from '../src/infra/mail/mail.types';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { createParticipant, createStaffUser, type TestUser } from './utils/admin';
import { createTestApp } from './utils/create-test-app';
import { MailCapture } from './utils/mail-capture';
import { scholarshipTypeIds, withScholarshipTypes } from './utils/scholarship-types';

/**
 * Becas parametrizables: catálogo público, CRUD del panel (SUPER_ADMIN), uso (409 al borrar),
 * desactivación, rango propio por oferta y % asignado dentro del rango efectivo.
 */
describe('Tipos de beca parametrizables (e2e)', () => {
  // Muchas llamadas HTTP por prueba: margen amplio en máquinas cargadas.
  jest.setTimeout(120_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  const mail = new MailCapture();
  const token = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  const KEY = (name: string) => `E2E_${token}_${name}`;
  const now = new Date();
  const days = (n: number) => addDaysInZone(now, n);

  let superAdmin: TestUser;
  let coordinator: TestUser;
  let participant: TestUser;
  let otherParticipant: TestUser;
  let third: TestUser;
  let fourth: TestUser;
  let T: Record<string, string>;

  const api = () => request(app.getHttpServer());
  const as = (u: TestUser) => ({ Authorization: `Bearer ${u.token}` });
  const get = (path: string, u: TestUser) => api().get(`/api/v1${path}`).set(as(u));
  const post = (path: string, u: TestUser, body: object = {}) =>
    api().post(`/api/v1${path}`).set(as(u)).send(body);
  const patch = (path: string, u: TestUser, body: object = {}) =>
    api().patch(`/api/v1${path}`).set(as(u)).send(body);
  const del = (path: string, u: TestUser) => api().delete(`/api/v1${path}`).set(as(u));

  const offerData = (
    key: string,
    overrides: Partial<Prisma.OfferUncheckedCreateInput> = {},
  ): Prisma.OfferUncheckedCreateInput => ({
    slug: `e2e-st-${token.toLowerCase()}-${key}`,
    name: `${token} becas ${key}`,
    type: 'DIPLOMA',
    modality: 'ONLINE_LIVE',
    origin: 'NAS',
    publicationStatus: 'PUBLISHED',
    publishedAt: days(-1),
    summary: `Resumen ${key}`,
    description: `Descripción ${key}`,
    learningOutcomes: [],
    enrollmentOpensAt: days(-10),
    enrollmentClosesAt: days(20),
    startsAt: days(30),
    endsAt: days(90),
    priceMxnCents: 1_000_000,
    priceUsdCents: 50_000,
    scholarshipEnabled: true,
    scholarshipOpensAt: days(-5),
    scholarshipClosesAt: days(10),
    ...overrides,
  });

  /** Postulación de beca "En revisión" (como la deja el portal) con el tipo solicitado. */
  const inReview = async (user: TestUser, offerId: string, scholarshipTypeId: string) => {
    const profile = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const created = await prisma.application.create({
      data: {
        userId: user.id,
        offerId,
        kind: 'SCHOLARSHIP',
        status: 'IN_REVIEW',
        applicantName: profile.fullName,
        applicantEmail: profile.email,
        phoneCountryCode: profile.phoneCountryCode,
        phoneNumber: profile.phoneNumber,
        countryCode: profile.countryCode,
        divisionName: profile.divisionName,
        municipalityName: profile.municipalityName,
        requestedScholarshipTypeId: scholarshipTypeId,
        intentLetter: 'Carta '.repeat(200),
        currency: 'MXN',
        originalAmountCents: 1_000_000,
        submittedAt: days(-3),
        reviewStartedAt: days(-2),
        termsAcceptedAt: days(-3),
      },
    });
    return created.id;
  };
  const approve = (applicationId: string, scholarshipTypeId: string) =>
    post(`/admin/applications/${applicationId}/approve`, superAdmin, {
      assignedScholarshipTypeId: scholarshipTypeId,
      emailPreviewConfirmed: true,
    });

  beforeAll(async () => {
    app = await createTestApp({ customize: (b) => b.overrideProvider(MAIL_DRIVER).useValue(mail) });
    prisma = app.get(PrismaService);
    T = await scholarshipTypeIds(prisma);
    superAdmin = await createStaffUser(app, mail, ['SUPER_ADMIN']);
    coordinator = await createStaffUser(app, mail, ['ACADEMIC_COORDINATOR']);
    participant = await createParticipant(app, mail);
    otherParticipant = await createParticipant(app, mail);
    third = await createParticipant(app, mail);
    fourth = await createParticipant(app, mail);
  }, 180_000);

  afterAll(async () => {
    await app.close();
  });

  it('GET /scholarship-types es público: activos, ordenados y con caché corta', async () => {
    const res = await api().get('/api/v1/scholarship-types').expect(200);
    expect(res.headers['cache-control']).toContain('max-age=300');
    const keys = res.body.data.map((t: { key: string }) => t.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'AGUA_VIVA',
        'RIOS_VIVOS',
        'AGUAS_LIBRES',
        'CENOTES_VIVOS',
        'SPECIAL',
      ]),
    );
    expect(keys.indexOf('AGUA_VIVA')).toBeLessThan(keys.indexOf('SPECIAL'));
    expect(res.body.data.find((t: { key: string }) => t.key === 'SPECIAL')).toEqual({
      id: T.SPECIAL,
      key: 'SPECIAL',
      name: 'Beca especial',
      description: null,
      minPercent: 71,
      maxPercent: 80,
      requiresInterview: true,
      sortOrder: 5,
      availableRecipients: null,
      isFull: false,
    });
  });

  describe('Permisos', () => {
    it('sin sesión 401; participante 403; coordinación lee pero no escribe', async () => {
      await api().get('/api/v1/admin/scholarship-types').expect(401);
      await get('/admin/scholarship-types', participant).expect(403);
      const list = await get('/admin/scholarship-types', coordinator).expect(200);
      expect(list.body.data.length).toBeGreaterThanOrEqual(5);
      const denied = await post('/admin/scholarship-types', coordinator, {
        key: KEY('X'),
        name: 'X',
        minPercent: 10,
        maxPercent: 10,
      }).expect(403);
      expect(denied.body.meta.missingPermissions).toEqual(['scholarship_types.write']);
      await patch(`/admin/scholarship-types/${T.AGUA_VIVA}`, coordinator, { name: 'X' }).expect(
        403,
      );
      await del(`/admin/scholarship-types/${T.AGUA_VIVA}`, coordinator).expect(403);
    });
  });

  describe('CRUD (SUPER_ADMIN)', () => {
    let typeId: string;

    it('crea con validaciones de clave y rango', async () => {
      await post('/admin/scholarship-types', superAdmin, {
        key: 'minusculas',
        name: 'Mal',
        minPercent: 10,
        maxPercent: 10,
      }).expect(400);
      await post('/admin/scholarship-types', superAdmin, {
        key: KEY('RANGO'),
        name: 'Rango',
        minPercent: 0,
        maxPercent: 10,
      }).expect(400);
      const inverted = await post('/admin/scholarship-types', superAdmin, {
        key: KEY('RANGO'),
        name: 'Rango',
        minPercent: 40,
        maxPercent: 30,
      }).expect(422);
      expect(inverted.body).toMatchObject({
        code: 'SCHOLARSHIP_TYPE_INVALID_RANGE',
        details: [{ field: 'maxPercent', code: 'INVALID' }],
      });

      const res = await post('/admin/scholarship-types', superAdmin, {
        key: KEY('MANANTIALES'),
        name: 'Manantiales',
        description: 'Beca de prueba',
        minPercent: 30,
        maxPercent: 40,
      }).expect(201);
      typeId = res.body.id;
      expect(res.body).toMatchObject({
        key: KEY('MANANTIALES'),
        name: 'Manantiales',
        minPercent: 30,
        maxPercent: 40,
        requiresInterview: false,
        active: true,
        usage: { offers: 0, applications: 0, evaluations: 0 },
      });
      expect(res.body.sortOrder).toBeGreaterThan(5);

      const dup = await post('/admin/scholarship-types', superAdmin, {
        key: KEY('MANANTIALES'),
        name: 'Otra',
        minPercent: 5,
        maxPercent: 5,
      }).expect(409);
      expect(dup.body.code).toBe('SCHOLARSHIP_TYPE_KEY_TAKEN');
    });

    it('edita (la clave no es editable) y valida el rango contra lo guardado', async () => {
      await patch(`/admin/scholarship-types/${typeId}`, superAdmin, { key: 'OTRA' }).expect(400);
      await patch(`/admin/scholarship-types/${typeId}`, superAdmin, { minPercent: 50 }).expect(422);
      const res = await patch(`/admin/scholarship-types/${typeId}`, superAdmin, {
        name: 'Manantiales vivos',
        maxPercent: 45,
        requiresInterview: true,
      }).expect(200);
      expect(res.body).toMatchObject({
        key: KEY('MANANTIALES'),
        name: 'Manantiales vivos',
        minPercent: 30,
        maxPercent: 45,
        requiresInterview: true,
      });
      await patch(`/admin/scholarship-types/${randomUUID()}`, superAdmin, { name: 'X' }).expect(
        404,
      );
      await patch('/admin/scholarship-types/no-uuid', superAdmin, { name: 'X' }).expect(404);
    });

    it('borra si no se usa; auditoría create/update/delete', async () => {
      await del(`/admin/scholarship-types/${typeId}`, superAdmin).expect(204);
      await del(`/admin/scholarship-types/${typeId}`, superAdmin).expect(404);
      const logs = await prisma.adminAuditLog.findMany({
        where: { entityId: typeId },
        orderBy: { createdAt: 'asc' },
      });
      expect(logs.map((l) => l.action)).toEqual([
        'scholarship_type.create',
        'scholarship_type.update',
        'scholarship_type.delete',
      ]);
      expect(logs[1].actorId).toBe(superAdmin.id);
    });
  });

  describe('Uso en ofertas y postulaciones', () => {
    let typeId: string;
    let offerId: string;
    let offerSlug: string;
    let applicationId: string;

    beforeAll(async () => {
      const type = await post('/admin/scholarship-types', superAdmin, {
        key: KEY('LAGOS'),
        name: 'Lagos',
        minPercent: 30,
        maxPercent: 40,
      }).expect(201);
      typeId = type.body.id;
      const offer = await prisma.offer.create({
        data: offerData('uso', {
          scholarshipTypes: {
            create: [
              { scholarshipTypeId: typeId, minPercent: 32, maxPercent: 36 },
              { scholarshipTypeId: T.AGUAS_LIBRES },
            ],
          },
        }),
      });
      offerId = offer.id;
      offerSlug = offer.slug;
      const profile = await prisma.user.findUniqueOrThrow({ where: { id: participant.id } });
      const application = await prisma.application.create({
        data: {
          userId: participant.id,
          offerId,
          kind: 'SCHOLARSHIP',
          status: 'IN_REVIEW',
          applicantName: profile.fullName,
          applicantEmail: profile.email,
          phoneCountryCode: profile.phoneCountryCode,
          phoneNumber: profile.phoneNumber,
          countryCode: profile.countryCode,
          divisionName: profile.divisionName,
          municipalityName: profile.municipalityName,
          requestedScholarshipTypeId: typeId,
          intentLetter: 'Carta '.repeat(200),
          currency: 'MXN',
          originalAmountCents: 1_000_000,
          submittedAt: days(-3),
          reviewStartedAt: days(-2),
          termsAcceptedAt: days(-3),
        },
      });
      applicationId = application.id;
    });

    it('la ficha usa el rango propio de la oferta (override) y estima montos', async () => {
      const res = await api().get(`/api/v1/offers/${offerSlug}?tz=America/Mexico_City`).expect(200);
      expect(res.body.scholarship).toEqual({ minPercent: 32, maxPercent: 50 });
      const lagos = res.body.scholarshipDetails.scholarshipTypes.find(
        (t: { scholarshipTypeId: string }) => t.scholarshipTypeId === typeId,
      );
      expect(lagos).toMatchObject({
        scholarshipType: { key: KEY('LAGOS'), minPercent: 32, maxPercent: 36 },
        estimatedScholarship: { minAmountCents: 320_000, maxAmountCents: 360_000, currency: 'MXN' },
      });
      // El tipo conserva su rango propio fuera de la oferta.
      const admin = await get('/admin/scholarship-types', superAdmin).expect(200);
      expect(admin.body.data.find((t: { id: string }) => t.id === typeId)).toMatchObject({
        minPercent: 30,
        maxPercent: 40,
        usage: { offers: 1, applications: 1 },
      });
    });

    it('borrar un tipo en uso → 409 SCHOLARSHIP_TYPE_IN_USE', async () => {
      const res = await del(`/admin/scholarship-types/${typeId}`, superAdmin).expect(409);
      expect(res.body).toMatchObject({
        code: 'SCHOLARSHIP_TYPE_IN_USE',
        meta: { usage: { offers: 1, applications: 1, evaluations: 0 } },
      });
    });

    it('aprobación: % fuera del rango efectivo → 400; dentro → guarda % y nombre', async () => {
      const outside = await post(`/admin/applications/${applicationId}/approve`, superAdmin, {
        assignedScholarshipTypeId: typeId,
        assignedPercent: 40, // dentro del tipo (30–40) pero fuera de la oferta (32–36)
        emailPreviewConfirmed: true,
      }).expect(400);
      expect(outside.body.details[0]).toMatchObject({ field: 'assignedPercent', code: 'INVALID' });
      await post(`/admin/applications/${applicationId}/approve`, superAdmin, {
        assignedScholarshipTypeId: T.SPECIAL, // no habilitado en esta oferta
        assignedPercent: 75,
        emailPreviewConfirmed: true,
      })
        .expect(400)
        .expect((r) => expect(r.body.details[0].code).toBe('SCHOLARSHIP_TYPE_NOT_ENABLED'));
      const ok = await post(`/admin/applications/${applicationId}/approve`, superAdmin, {
        assignedScholarshipTypeId: typeId,
        assignedPercent: 34,
        emailPreviewConfirmed: true,
      }).expect(200);
      expect(ok.body).toMatchObject({
        status: 'APPROVED_PENDING_PAYMENT',
        assignedScholarshipTypeId: typeId,
        assignedScholarshipType: { name: 'Lagos', minPercent: 32, maxPercent: 36 },
        assignedPercent: 34,
      });
      expect(ok.body.decision.balance).toEqual({ amountCents: 660_000, currency: 'MXN' });
    });

    it('renombrar el tipo no altera el histórico (snapshot del nombre asignado)', async () => {
      await patch(`/admin/scholarship-types/${typeId}`, superAdmin, { name: 'Lagos 2027' }).expect(
        200,
      );
      const mine = await get(`/me/applications/${applicationId}`, participant).expect(200);
      expect(mine.body.scholarshipResult).toMatchObject({
        assignedScholarshipType: { name: 'Lagos', key: KEY('LAGOS') },
        requestedScholarshipType: { name: 'Lagos 2027' },
        assignedPercent: 34,
      });
    });

    it('desactivado: deja de ofrecerse en la ficha, en postulaciones y en ofertas nuevas', async () => {
      await patch(`/admin/scholarship-types/${typeId}`, superAdmin, { active: false }).expect(200);

      const publicList = await api().get('/api/v1/scholarship-types').expect(200);
      expect(publicList.body.data.map((t: { id: string }) => t.id)).not.toContain(typeId);

      const detail = await api().get(`/api/v1/offers/${offerSlug}`).expect(200);
      expect(
        detail.body.scholarshipDetails.scholarshipTypes.map(
          (t: { scholarshipTypeId: string }) => t.scholarshipTypeId,
        ),
      ).toEqual([T.AGUAS_LIBRES]);

      // Lo ya asignado se conserva.
      const mine = await get(`/me/applications/${applicationId}`, participant).expect(200);
      expect(mine.body.scholarshipResult.assignedScholarshipTypeId).toBe(typeId);

      // Postulación nueva: el tipo desactivado no se puede solicitar.
      const draft = await post('/me/applications', otherParticipant, {
        offerId,
        requestedScholarshipTypeId: typeId,
      }).expect(400);
      expect(draft.body.details[0]).toMatchObject({
        field: 'requestedScholarshipTypeId',
        code: 'SCHOLARSHIP_TYPE_NOT_ENABLED',
      });

      // Oferta nueva: no se puede agregar (422 por campo)...
      const created = await post('/admin/offers', coordinator, {
        type: 'DIPLOMA',
        modality: 'ONLINE_LIVE',
        name: `${token} becas nueva`,
      }).expect(201);
      const rejected = await patch(
        `/admin/offers/${created.body.id}/steps/origin-pricing`,
        coordinator,
        { scholarshipTypes: [{ scholarshipTypeId: T.AGUA_VIVA }, { scholarshipTypeId: typeId }] },
      ).expect(422);
      expect(rejected.body).toMatchObject({
        code: 'SCHOLARSHIP_TYPE_NOT_AVAILABLE',
        details: [
          { field: 'scholarshipTypes.1.scholarshipTypeId', code: 'SCHOLARSHIP_TYPE_INACTIVE' },
        ],
      });
      // ...pero la oferta que ya lo tenía puede conservarlo al guardar el paso.
      const kept = await patch(`/admin/offers/${offerId}/steps/origin-pricing`, coordinator, {
        scholarshipTypes: [
          { scholarshipTypeId: T.AGUAS_LIBRES },
          { scholarshipTypeId: typeId, minPercent: 32, maxPercent: 36 },
        ],
      }).expect(200);
      expect(
        kept.body.originPricing.scholarshipTypes.find(
          (t: { scholarshipTypeId: string }) => t.scholarshipTypeId === typeId,
        ),
      ).toMatchObject({ active: false, minPercent: 32, maxPercent: 36 });
    });
  });

  it('una oferta sin tipos activos no ofrece beca', async () => {
    const type = await post('/admin/scholarship-types', superAdmin, {
      key: KEY('SOLO'),
      name: 'Solo',
      minPercent: 20,
      maxPercent: 20,
      active: false,
    }).expect(201);
    const offer = await prisma.offer.create({
      data: offerData('solo', {
        scholarshipTypes: { create: [{ scholarshipTypeId: type.body.id }] },
      }),
    });
    const res = await api().get(`/api/v1/offers/${offer.slug}`).expect(200);
    expect(res.body.scholarship).toBeNull();
    expect(res.body.scholarshipDetails).toBeNull();
    const withActive = await prisma.offer.create({
      data: offerData('activo', { scholarshipTypes: withScholarshipTypes(['RIOS_VIVOS']) }),
    });
    const ok = await api().get(`/api/v1/offers/${withActive.slug}`).expect(200);
    expect(ok.body.scholarship).toEqual({ minPercent: 25, maxPercent: 25 });
  });

  describe('Cupo máximo por tipo de beca', () => {
    let typeId: string;
    let offerA: { id: string; slug: string };
    let offerB: { id: string; slug: string };
    const apps: Record<string, string> = {};

    beforeAll(async () => {
      const created = await post('/admin/scholarship-types', superAdmin, {
        key: KEY('CUPO'),
        name: 'Cupo',
        minPercent: 20,
        maxPercent: 20,
        maxRecipients: 3,
      }).expect(201);
      typeId = created.body.id;
      expect(created.body).toMatchObject({
        maxRecipients: 3,
        usedRecipients: 0,
        availableRecipients: 3,
        isFull: false,
      });
      offerA = await prisma.offer.create({
        data: offerData('cupo-a', {
          scholarshipTypes: {
            create: [{ scholarshipTypeId: typeId }, { scholarshipTypeId: T.AGUAS_LIBRES }],
          },
        }),
      });
      offerB = await prisma.offer.create({
        data: offerData('cupo-b', {
          scholarshipTypes: { create: [{ scholarshipTypeId: typeId, maxRecipients: 1 }] },
        }),
      });
      apps.a1 = await inReview(participant, offerA.id, typeId);
      apps.a2 = await inReview(otherParticipant, offerA.id, typeId);
      apps.a3 = await inReview(third, offerA.id, typeId);
      apps.b1 = await inReview(participant, offerB.id, typeId);
      apps.b2 = await inReview(otherParticipant, offerB.id, typeId);
    });

    it('validación: maxRecipients entero ≥ 1 o null', async () => {
      await post('/admin/scholarship-types', superAdmin, {
        key: KEY('CUPO_CERO'),
        name: 'Cero',
        minPercent: 5,
        maxPercent: 5,
        maxRecipients: 0,
      }).expect(400);
      await patch(`/admin/offers/${offerB.id}/steps/origin-pricing`, superAdmin, {
        scholarshipTypes: [{ scholarshipTypeId: typeId, maxRecipients: 0 }],
      }).expect(400);
    });

    it('concurrencia: 2 aprobaciones con 1 cupo en la oferta → solo una pasa (409 OFFER)', async () => {
      const results = await Promise.all([approve(apps.b1, typeId), approve(apps.b2, typeId)]);
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([200, 409]);
      const rejected = results.find((r) => r.status === 409)!;
      expect(rejected.body).toMatchObject({
        code: 'SCHOLARSHIP_TYPE_FULL',
        meta: { scholarshipTypeId: typeId, maxRecipients: 1, used: 1, scope: 'OFFER' },
      });
      // La rechazada sigue en revisión (la transacción se revirtió).
      const loser = results[0].status === 409 ? apps.b1 : apps.b2;
      const row = await prisma.application.findUniqueOrThrow({ where: { id: loser } });
      expect(row).toMatchObject({ status: 'IN_REVIEW', assignedScholarshipTypeId: null });
      const enrollment = await prisma.enrollment.findFirst({ where: { applicationId: loser } });
      expect(enrollment).toBeNull();
    });

    it('cupo global: aprobar hasta llenar → 409 TYPE; vista previa bloqueada', async () => {
      await approve(apps.a1, typeId).expect(200);
      await approve(apps.a2, typeId).expect(200);
      const preview = await get(
        `/admin/applications/${apps.a3}/decision-preview?decision=APPROVE&assignedScholarshipTypeId=${typeId}`,
        superAdmin,
      ).expect(200);
      expect(preview.body.blockedReason).toBe('SCHOLARSHIP_TYPE_FULL');
      const full = await approve(apps.a3, typeId).expect(409);
      expect(full.body).toMatchObject({
        code: 'SCHOLARSHIP_TYPE_FULL',
        meta: { scholarshipTypeId: typeId, maxRecipients: 3, used: 3, scope: 'TYPE' },
      });
      const detail = await get(`/admin/applications/${apps.a3}`, superAdmin).expect(200);
      expect(
        detail.body.decision.scholarshipTypes.find(
          (t: { scholarshipTypeId: string }) => t.scholarshipTypeId === typeId,
        ).quota,
      ).toMatchObject({
        typeMaxRecipients: 3,
        typeUsedRecipients: 3,
        offerMaxRecipients: null,
        offerUsedRecipients: 2,
        availableRecipients: 0,
        isFull: true,
      });
      const admin = await get('/admin/scholarship-types', superAdmin).expect(200);
      expect(admin.body.data.find((t: { id: string }) => t.id === typeId)).toMatchObject({
        maxRecipients: 3,
        usedRecipients: 3,
        availableRecipients: 0,
        isFull: true,
      });
      const pricing = await get(`/admin/offers/${offerB.id}`, superAdmin).expect(200);
      expect(pricing.body.originPricing.scholarshipTypes[0]).toMatchObject({
        maxRecipients: 1,
        quota: { offerMaxRecipients: 1, offerUsedRecipients: 1, isFull: true },
      });
    });

    it('público: el tipo lleno sigue visible como agotado y no se puede solicitar (422)', async () => {
      const list = await api().get('/api/v1/scholarship-types').expect(200);
      expect(list.body.data.find((t: { id: string }) => t.id === typeId)).toMatchObject({
        availableRecipients: 0,
        isFull: true,
      });
      const detail = await api().get(`/api/v1/offers/${offerA.slug}`).expect(200);
      const types = detail.body.scholarshipDetails.scholarshipTypes as Array<{
        scholarshipTypeId: string;
        isFull: boolean;
        availableRecipients: number | null;
      }>;
      expect(types.find((t) => t.scholarshipTypeId === typeId)).toMatchObject({
        isFull: true,
        availableRecipients: 0,
      });
      expect(types.find((t) => t.scholarshipTypeId === T.AGUAS_LIBRES)).toMatchObject({
        isFull: false,
        availableRecipients: null,
      });
      const res = await post('/me/applications', fourth, {
        offerId: offerA.id,
        requestedScholarshipTypeId: typeId,
      }).expect(422);
      expect(res.body).toMatchObject({
        code: 'BUSINESS_RULE_VIOLATION',
        details: [{ field: 'requestedScholarshipTypeId', code: 'SCHOLARSHIP_TYPE_FULL' }],
      });
      // Otro tipo con cupo sí.
      await post('/me/applications', fourth, {
        offerId: offerA.id,
        requestedScholarshipTypeId: T.AGUAS_LIBRES,
      }).expect(201);
    });

    it('vencida libera el cupo; reactivarla sin cupo → 409', async () => {
      await prisma.application.update({
        where: { id: apps.a1 },
        data: { status: 'EXPIRED', expiredAt: now },
      });
      await approve(apps.a3, typeId).expect(200);
      const reactivate = await post(`/admin/applications/${apps.a1}/extend-deadline`, superAdmin, {
        responseDueAt: days(5).toISOString(),
        reason: 'Prueba de cupo',
      }).expect(409);
      expect(reactivate.body).toMatchObject({
        code: 'SCHOLARSHIP_TYPE_FULL',
        meta: { scope: 'TYPE' },
      });
      const row = await prisma.application.findUniqueOrThrow({ where: { id: apps.a1 } });
      expect(row.status).toBe('EXPIRED');
    });

    it('bajar el cupo por debajo de lo usado: permitido, no quita becas', async () => {
      const res = await patch(`/admin/scholarship-types/${typeId}`, superAdmin, {
        maxRecipients: 1,
      }).expect(200);
      expect(res.body).toMatchObject({
        maxRecipients: 1,
        usedRecipients: 3,
        availableRecipients: 0,
        isFull: true,
      });
      expect(
        await prisma.application.count({
          where: { assignedScholarshipTypeId: typeId, status: 'APPROVED_PENDING_PAYMENT' },
        }),
      ).toBe(3);
      const log = await prisma.adminAuditLog.findFirst({
        where: { entityId: typeId, action: 'scholarship_type.update' },
        orderBy: { createdAt: 'desc' },
      });
      expect(JSON.stringify(log?.changes)).toContain('maxRecipients');
      // Ilimitado otra vez.
      const unlimited = await patch(`/admin/scholarship-types/${typeId}`, superAdmin, {
        maxRecipients: null,
      }).expect(200);
      expect(unlimited.body).toMatchObject({ availableRecipients: null, isFull: false });
    });
  });
});
