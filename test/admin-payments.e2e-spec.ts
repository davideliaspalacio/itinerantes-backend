import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { addDaysInZone } from '../src/common/utils/time';
import type { Prisma } from '../src/generated/prisma/client';
import { MAIL_DRIVER } from '../src/infra/mail/mail.types';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { StorageService } from '../src/infra/storage/storage.service';
import { PAYMENT_GATEWAY } from '../src/infra/stripe/payment-gateway';
import { createStaffUser, createParticipant, type TestUser } from './utils/admin';
import { createTestApp } from './utils/create-test-app';
import { FakePaymentGateway } from './utils/fake-payment-gateway';
import { FakeStorage } from './utils/fake-storage';
import { MailCapture } from './utils/mail-capture';
import { scholarshipTypeIds, withScholarshipTypes } from './utils/scholarship-types';

/**
 * Panel de pagos (Fase 06, HU-33): permisos (todo el staff consulta; solo finanzas actúa),
 * transferencias (validar / rechazar), reembolsos (Stripe y registro manual, webhook), planes de
 * cuotas (reintentar, mora, suspender / restablecer manual, cancelar) y auditoría.
 */
describe('Admin – Pagos (e2e) — Fase 06', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  /** key → id de los tipos de beca. */
  let T: Record<string, string>;
  const mail = new MailCapture();
  const storage = new FakeStorage();
  const gateway = new FakePaymentGateway();

  const token = `ap${randomUUID().slice(0, 6)}`;
  const now = new Date();
  const days = (n: number) => addDaysInZone(now, n);
  const today = now.toISOString().slice(0, 10);
  const ids: Record<string, string> = {};

  let finance: TestUser;
  let coord: TestUser;
  let ana: TestUser;
  let beto: TestUser;
  let carla: TestUser;

  const api = () => request(app.getHttpServer());
  const get = (path: string, u: TestUser) =>
    api().get(`/api/v1${path}`).set('Authorization', `Bearer ${u.token}`);
  const post = (path: string, u: TestUser, body: object = {}) =>
    api().post(`/api/v1${path}`).set('Authorization', `Bearer ${u.token}`).send(body);
  const webhook = (event: Record<string, unknown>) => {
    const { body, signature } = gateway.sign(event);
    return api()
      .post('/api/v1/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', signature)
      .send(body);
  };
  const audits = (entityId: string) =>
    prisma.adminAuditLog.findMany({ where: { entityId }, orderBy: { createdAt: 'asc' } });

  const offerData = (key: string): Prisma.OfferUncheckedCreateInput => ({
    slug: `e2e-${token}-${key}`,
    name: `${token} ${key}`,
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
    endsAt: days(200),
    priceMxnCents: 1_020_000,
    priceUsdCents: 58_500,
    scholarshipEnabled: true,
    scholarshipTypes: withScholarshipTypes(['AGUAS_LIBRES']),
  });

  /** Postulación aprobada con comprobante "Pendiente de validación" (como lo deja la Fase 05). */
  const pendingTransfer = async (user: TestUser, offerId: string): Promise<string> => {
    const profile = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const application = await prisma.application.create({
      data: {
        userId: user.id,
        offerId,
        kind: 'SCHOLARSHIP',
        status: 'APPROVED_PENDING_PAYMENT',
        applicantName: profile.fullName,
        applicantEmail: profile.email,
        phoneCountryCode: profile.phoneCountryCode,
        phoneNumber: profile.phoneNumber,
        countryCode: profile.countryCode,
        divisionName: profile.divisionName,
        municipalityName: profile.municipalityName,
        requestedScholarshipTypeId: T.AGUAS_LIBRES,
        assignedScholarshipTypeId: T.AGUAS_LIBRES,
        assignedScholarshipTypeName: 'Aguas Libres',
        assignedPercent: 50,
        currency: 'MXN',
        originalAmountCents: 1_020_000,
        balanceCents: 510_000,
        responseDueAt: days(5),
        submittedAt: days(-10),
        decidedAt: days(-1),
        pendingTransferSince: days(-1),
        paymentStartedAt: days(-1),
      },
    });
    const enrollment = await prisma.enrollment.create({
      data: {
        userId: user.id,
        offerId,
        applicationId: application.id,
        status: 'PENDING_PAYMENT',
        source: 'SCHOLARSHIP',
      },
    });
    const key = `payments/transfers/${application.id}/comprobante.pdf`;
    storage.put(key, 'application/pdf', 120_000);
    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        offerId,
        applicationId: application.id,
        enrollmentId: enrollment.id,
        concept: 'BALANCE',
        method: 'BANK_TRANSFER',
        status: 'PENDING_VALIDATION',
        amountCents: 510_000,
        currency: 'MXN',
        transferReference: `EIA BEC-${application.number}`,
        declaredAmountCents: 510_000,
        declaredPaidOn: new Date(`${today}T00:00:00.000Z`),
        trackingKey: 'MBAN0100261109',
        proofFileKey: key,
        proofFileName: 'comprobante.pdf',
        proofMimeType: 'application/pdf',
        proofSizeBytes: 120_000,
        submittedAt: days(-1),
      },
    });
    ids[`app-${user.id}`] = application.id;
    return payment.id;
  };

  beforeAll(async () => {
    app = await createTestApp({
      customize: (b) =>
        b
          .overrideProvider(MAIL_DRIVER)
          .useValue(mail)
          .overrideProvider(StorageService)
          .useValue(storage)
          .overrideProvider(PAYMENT_GATEWAY)
          .useValue(gateway),
    });
    prisma = app.get(PrismaService);
    T = await scholarshipTypeIds(prisma);
    finance = await createStaffUser(app, mail, ['FINANCE']);
    coord = await createStaffUser(app, mail, ['ACADEMIC_COORDINATOR']);
    ana = await createParticipant(app, mail);
    beto = await createParticipant(app, mail);
    carla = await createParticipant(app, mail);

    for (const key of ['transfer', 'card', 'plan']) {
      ids[key] = (await prisma.offer.create({ data: offerData(key) })).id;
    }
    ids.transferOk = await pendingTransfer(ana, ids.transfer);
    ids.transferKo = await pendingTransfer(beto, ids.transfer);

    // Pago con tarjeta ya cobrado (HU-22).
    const cardEnrollment = await prisma.enrollment.create({
      data: { userId: ana.id, offerId: ids.card, status: 'ACTIVE', source: 'PAYMENT' },
    });
    ids.cardPi = `pi_e2e_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    ids.card_payment = (
      await prisma.payment.create({
        data: {
          userId: ana.id,
          offerId: ids.card,
          enrollmentId: cardEnrollment.id,
          concept: 'FULL_PRICE',
          method: 'CARD',
          status: 'PAID',
          amountCents: 1_020_000,
          currency: 'MXN',
          stripePaymentIntentId: ids.cardPi,
          stripeChargeId: `ch_${ids.cardPi.slice(3)}`,
          paidAt: days(-2),
        },
      })
    ).id;

    // Plan de cuotas con una cuota fallida hace 20 días (Cobro fallido).
    const planEnrollment = await prisma.enrollment.create({
      data: { userId: carla.id, offerId: ids.plan, status: 'ACTIVE', source: 'INSTALLMENTS' },
    });
    ids.planEnrollment = planEnrollment.id;
    const plan = await prisma.installmentPlan.create({
      data: {
        userId: carla.id,
        offerId: ids.plan,
        enrollmentId: planEnrollment.id,
        concept: 'FULL_PRICE',
        status: 'PAST_DUE',
        currency: 'MXN',
        totalCents: 1_020_000,
        installmentCount: 3,
        stripeCustomerId: 'cus_fake_e2e',
        stripePaymentMethodId: 'pm_fake_e2e',
        cardBrand: 'visa',
        cardLast4: '4242',
        autoDebitAuthorizedAt: days(-60),
        activatedAt: days(-60),
        failedSince: days(-20),
        installments: {
          create: [
            {
              sequence: 1,
              amountCents: 340_000,
              dueAt: days(-60),
              status: 'PAID',
              attempts: 1,
              paidAt: days(-60),
            },
            {
              sequence: 2,
              amountCents: 340_000,
              dueAt: days(-20),
              status: 'FAILED',
              attempts: 3,
              failedAt: days(-20),
            },
            { sequence: 3, amountCents: 340_000, dueAt: days(10), status: 'SCHEDULED' },
          ],
        },
      },
    });
    ids.plan_id = plan.id;
  }, 180_000);

  afterAll(async () => {
    await app.close();
  });

  describe('permisos', () => {
    it('un participante no entra a Pagos (403)', async () => {
      await get('/admin/payments', ana).expect(403);
      await get('/admin/payment-plans', ana).expect(403);
    });

    it('un rol sin finanzas solo consulta: GET 200, acciones 403 con meta.missingPermissions', async () => {
      await get('/admin/payments', coord).expect(200);
      await get(`/admin/payments/${ids.transferOk}`, coord)
        .expect(200)
        .expect((r) => expect(r.body.actions).toEqual({ canRefund: false, canReview: false }));
      const res = await post(`/admin/transfers/${ids.transferOk}/validate`, coord, {
        receivedAmountCents: 510_000,
        receivedOn: today,
      }).expect(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(res.body.meta.missingPermissions).toEqual(['payments.manage']);
      await post(`/admin/payments/${ids.card_payment}/refund`, coord, {
        amountCents: 1,
        reason: 'prueba',
      }).expect(403);
      await post(`/admin/payment-plans/${ids.plan_id}/cancel`, coord, { reason: 'prueba' }).expect(
        403,
      );
    });

    it('ids mal formados o inexistentes → 404', async () => {
      await get('/admin/payments/no-uuid', finance).expect(404);
      await get(`/admin/payment-plans/${randomUUID()}`, finance).expect(404);
    });
  });

  describe('listado, filtros y resumen', () => {
    it('lista con payer, IDs de Stripe y búsqueda por folio', async () => {
      const payment = await prisma.payment.findUniqueOrThrow({ where: { id: ids.card_payment } });
      const res = await get(`/admin/payments?q=PAG-${payment.number}`, finance).expect(200);
      expect(res.body.meta.total).toBe(1);
      expect(res.body.data[0]).toMatchObject({
        id: ids.card_payment,
        conceptLabel: 'Pago completo',
        status: 'PAID',
        amount: { amountCents: 1_020_000, currency: 'MXN' },
        stripe: { paymentIntentId: ids.cardPi },
        payer: { id: ana.id, email: ana.email },
      });
      const byOffer = await get(
        `/admin/payments?offerId=${ids.transfer}&method=BANK_TRANSFER`,
        finance,
      ).expect(200);
      expect(byOffer.body.meta.total).toBe(2);
    });

    it('transferencias por conciliar con contador y comprobante firmado', async () => {
      const res = await get(`/admin/transfers?offerId=${ids.transfer}`, finance).expect(200);
      expect(res.body.meta.total).toBe(2);
      expect(res.body.data[0].transfer).toMatchObject({
        expectedAmount: { amountCents: 510_000, currency: 'MXN' },
        declaredAmount: { amountCents: 510_000, currency: 'MXN' },
        trackingKey: 'MBAN0100261109',
      });
      const proof = await get(`/admin/payments/${ids.transferOk}/proof`, coord).expect(200);
      expect(proof.body.url).toContain('payments/transfers/');
      await get(`/admin/payments/${ids.card_payment}/proof`, finance).expect(404);
    });

    it('resumen separado por moneda', async () => {
      const res = await get(`/admin/payments/summary?offerId=${ids.transfer}`, coord).expect(200);
      expect(res.body.currencies.map((c: { currency: string }) => c.currency)).toEqual([
        'MXN',
        'USD',
      ]);
      expect(res.body.pendingTransfers.count).toBe(2);
      expect(res.body.pendingTransfers.amount).toEqual({ amountCents: 1_020_000, currency: 'MXN' });
    });
  });

  describe('HU-33: transferencias', () => {
    it('monto menor al esperado → 422 con la diferencia; solo se puede rechazar', async () => {
      const res = await post(`/admin/transfers/${ids.transferOk}/validate`, finance, {
        receivedAmountCents: 500_000,
        receivedOn: today,
      }).expect(422);
      expect(res.body.code).toBe('PAYMENT_TRANSFER_AMOUNT_MISMATCH');
      expect(res.body.meta).toMatchObject({ differenceCents: 10_000, expectedCents: 510_000 });
    });

    it('validar: Validada, inscripción activa, postulación Inscrita, aviso y auditoría', async () => {
      const res = await post(`/admin/transfers/${ids.transferOk}/validate`, finance, {
        receivedAmountCents: 510_000,
        receivedOn: today,
      }).expect(200);
      expect(res.body.status).toBe('VALIDATED');
      expect(res.body.transfer.receivedAmount).toEqual({ amountCents: 510_000, currency: 'MXN' });
      expect(res.body.transfer.reviewedBy.id).toBe(finance.id);
      const application = await prisma.application.findUniqueOrThrow({
        where: { id: ids[`app-${ana.id}`] },
        include: { enrollment: true },
      });
      expect(application.status).toBe('ENROLLED');
      expect(application.enrollment?.status).toBe('ACTIVE');
      const notes = await prisma.notification.findMany({
        where: { userId: ana.id, type: 'TRANSFER_VALIDATED' },
      });
      expect(notes).toHaveLength(1);
      const log = await audits(ids.transferOk);
      expect(log.map((l) => l.action)).toEqual(['transfer.validate']);
      expect(log[0].actorId).toBe(finance.id);
      // Ya resuelta → 409.
      await post(`/admin/transfers/${ids.transferOk}/validate`, finance, {
        receivedAmountCents: 510_000,
        receivedOn: today,
      }).expect(409);
    });

    it('rechazar: OTHER exige nota; con motivo queda Rechazada y la persona puede reenviar', async () => {
      const bad = await post(`/admin/transfers/${ids.transferKo}/reject`, finance, {
        reason: 'OTHER',
      }).expect(400);
      expect(bad.body.details[0]).toMatchObject({ field: 'note', code: 'REQUIRED' });
      const res = await post(`/admin/transfers/${ids.transferKo}/reject`, finance, {
        reason: 'ILLEGIBLE',
      }).expect(200);
      expect(res.body.status).toBe('REJECTED');
      expect(res.body.transfer.rejectionReason).toBe('ILLEGIBLE');
      const application = await prisma.application.findUniqueOrThrow({
        where: { id: ids[`app-${beto.id}`] },
      });
      expect(application.pendingTransferSince).toBeNull();
      expect(application.transferRejectedAt).not.toBeNull();
      expect((await audits(ids.transferKo)).map((l) => l.action)).toEqual(['transfer.reject']);
    });
  });

  describe('HU-33: reembolsos', () => {
    it('monto mayor a lo pagado → 422 con lo reembolsable', async () => {
      const res = await post(`/admin/payments/${ids.card_payment}/refund`, finance, {
        amountCents: 2_000_000,
        reason: 'Error de captura',
      }).expect(422);
      expect(res.body.code).toBe('PAYMENT_REFUND_INVALID');
      expect(res.body.meta.refundableCents).toBe(1_020_000);
      await post(`/admin/payments/${ids.card_payment}/refund`, finance, {
        amountCents: 100,
      }).expect(400);
    });

    it('sin llaves de Stripe → 503', async () => {
      gateway.configured = false;
      try {
        await post(`/admin/payments/${ids.card_payment}/refund`, finance, {
          amountCents: 100,
          reason: 'Prueba',
        }).expect(503);
      } finally {
        gateway.configured = true;
      }
    });

    it('tarjeta parcial vía Stripe (confirmado) y luego en proceso hasta el webhook', async () => {
      const partial = await post(`/admin/payments/${ids.card_payment}/refund`, finance, {
        amountCents: 20_000,
        reason: 'Descuento acordado',
      }).expect(201);
      expect(partial.body.status).toBe('PAID');
      expect(partial.body.refunded).toEqual({ amountCents: 20_000, currency: 'MXN' });
      expect(partial.body.refunds[0]).toMatchObject({ status: 'SUCCEEDED', method: 'CARD' });
      expect(gateway.refundCalls.at(-1)).toMatchObject({
        paymentIntentId: ids.cardPi,
        amountCents: 20_000,
      });

      gateway.nextRefunds.push('pending');
      const pending = await post(`/admin/payments/${ids.card_payment}/refund`, finance, {
        amountCents: 1_000_000,
        reason: 'Baja antes del inicio',
      }).expect(201);
      expect(pending.body.status).toBe('PAID');
      expect(pending.body.refundable.amountCents).toBe(0);
      expect(pending.body.refunds[0].status).toBe('PENDING');
      await post(`/admin/payments/${ids.card_payment}/refund`, finance, {
        amountCents: 1,
        reason: 'Otro',
      }).expect(422);

      await webhook(gateway.chargeRefundedEvent(ids.cardPi, 1_020_000, 1_020_000)).expect(200);
      const after = await get(`/admin/payments/${ids.card_payment}`, finance).expect(200);
      expect(after.body.status).toBe('REFUNDED');
      expect(after.body.refunds.map((r: { status: string }) => r.status)).toEqual([
        'SUCCEEDED',
        'SUCCEEDED',
      ]);
      const list = await get(`/admin/refunds?offerId=${ids.card}`, coord).expect(200);
      expect(list.body.meta.total).toBe(2);
      expect(
        (await audits(ids.card_payment)).filter((l) => l.action === 'payment.refund'),
      ).toHaveLength(2);
    });

    it('transferencia validada: se registra el reembolso hecho fuera', async () => {
      const res = await post(`/admin/payments/${ids.transferOk}/refund`, finance, {
        amountCents: 100_000,
        reason: 'Devolución por transferencia bancaria',
      }).expect(201);
      expect(res.body.status).toBe('VALIDATED');
      expect(res.body.refunds[0]).toMatchObject({ status: 'SUCCEEDED', method: 'BANK_TRANSFER' });
      expect(res.body.refunded.amountCents).toBe(100_000);
    });
  });

  describe('HU-33: planes de cuotas', () => {
    const path = (action = '') => `/admin/payment-plans/${ids.plan_id}${action}`;
    const enrollment = () =>
      prisma.enrollment.findUniqueOrThrow({ where: { id: ids.planEnrollment } });

    it('listado con estado, días desde el fallo y acciones', async () => {
      const res = await get(`/admin/payment-plans?offerId=${ids.plan}`, coord).expect(200);
      expect(res.body.data[0]).toMatchObject({
        id: ids.plan_id,
        status: 'PAST_DUE',
        paidCount: 1,
        installmentCount: 3,
        payer: { id: carla.id },
        availableActions: ['RETRY', 'MARK_DELINQUENT', 'CANCEL'],
      });
      expect(res.body.data[0].daysSinceFailure).toBeGreaterThanOrEqual(19);
    });

    it('reintento rechazado → 422 (auditado); suspender en Cobro fallido → 409', async () => {
      gateway.nextCharges.push('failed');
      const res = await post(path('/retry'), finance).expect(422);
      expect(res.body.code).toBe('PAYMENT_CHARGE_FAILED');
      expect((await audits(ids.plan_id)).map((l) => l.action)).toContain('plan.retry');
      await post(path('/suspend-access'), finance, { reason: 'Mora' }).expect(409);
    });

    it('marcar en mora (la regla actual suspende automáticamente) y restablecer', async () => {
      const res = await post(path('/mark-delinquent'), finance).expect(200);
      expect(res.body.status).toBe('DELINQUENT');
      // SUSPEND_ACCESS_ON_DELINQUENCY=true (discrepancia documentada con HU-33).
      expect((await enrollment()).status).toBe('SUSPENDED');
      expect(res.body.availableActions).toContain('RESTORE_ACCESS');
      const restored = await post(path('/restore-access'), finance, {
        reason: 'Acuerdo de pago con finanzas',
      }).expect(200);
      expect(restored.body.enrollmentStatus).toBe('ACTIVE');
      expect(restored.body.accessSuspendedAt).toBeNull();
    });

    it('suspender manual (solo En mora): SUSPENDED + aviso fijado; reintento exitoso restablece', async () => {
      await post(path('/suspend-access'), finance, {}).expect(400);
      const res = await post(path('/suspend-access'), finance, {
        reason: 'Sin respuesta tras 3 contactos',
      }).expect(200);
      expect(res.body.enrollmentStatus).toBe('SUSPENDED');
      expect(res.body.accessSuspendedAt).not.toBeNull();
      const notice = await prisma.notification.findFirstOrThrow({
        where: {
          userId: carla.id,
          dedupeKey: { startsWith: `plan-delinquent:${ids.plan_id}:suspended:` },
        },
      });
      expect(notice.pinned).toBe(true);

      const paid = await post(path('/retry'), finance).expect(200);
      expect(paid.body.status).toBe('CURRENT');
      expect((await enrollment()).status).toBe('ACTIVE');
      const resolved = await prisma.notification.findUniqueOrThrow({ where: { id: notice.id } });
      expect(resolved.pinned).toBe(false);
    });

    it('cancelar plan: cuotas pendientes canceladas, inscripción sin cambios; repetir → 409', async () => {
      const res = await post(path('/cancel'), finance, { reason: 'Baja voluntaria' }).expect(200);
      expect(res.body.status).toBe('CANCELLED');
      expect(res.body.cancelReason).toBe('Baja voluntaria');
      const third = res.body.installments.find((i: { sequence: number }) => i.sequence === 3);
      expect(third.status).toBe('CANCELLED');
      expect((await enrollment()).status).toBe('ACTIVE');
      await post(path('/cancel'), finance, { reason: 'Otra vez' }).expect(409);
      const actions = (await audits(ids.plan_id)).map((l) => l.action);
      expect(actions).toEqual(
        expect.arrayContaining([
          'plan.mark-delinquent',
          'plan.restore-access',
          'plan.suspend-access',
          'plan.cancel',
        ]),
      );
    });
  });
});
