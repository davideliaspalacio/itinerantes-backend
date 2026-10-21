import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { addDaysInZone, addHours } from '../src/common/utils/time';
import type {
  ApplicationKind,
  ApplicationStatus,
  Prisma,
  ScholarshipLevel,
} from '../src/generated/prisma/client';
import { MAIL_DRIVER, type MailMessage, type MailSendResult } from '../src/infra/mail/mail.types';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { StorageService } from '../src/infra/storage/storage.service';
import { createStaffUser, createParticipant, type TestUser } from './utils/admin';
import { createTestApp } from './utils/create-test-app';
import { FakeStorage } from './utils/fake-storage';
import { MailCapture } from './utils/mail-capture';

/** MailCapture que puede fallar a propósito (HU-31: "decisión guardada pero correo no enviado"). */
class FlakyMail extends MailCapture {
  failFor: string | null = null;

  override send(message: MailMessage & { from: string }): Promise<MailSendResult> {
    if (this.failFor && [message.to].flat().includes(this.failFor)) {
      return Promise.reject(new Error('SMTP caído (prueba)'));
    }
    return super.send(message);
  }
}

/**
 * Panel — postulaciones (Fase 06): HU-31 (bandeja, detalle → "En revisión", evaluaciones del comité,
 * entrevista, vista previa, decisión, reintento de correo, exportación) y HU-32 (embudo, aprobados
 * sin pagar, recordatorios, WhatsApp, notas, extender plazo, cerrar inscripciones). Permisos por rol
 * y auditoría.
 */
describe('Admin — Postulaciones y seguimiento (e2e) — Fase 06', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const mail = new FlakyMail();
  const storage = new FakeStorage();

  const token = `ap${randomUUID().slice(0, 6)}`;
  const now = new Date();
  const days = (n: number) => addDaysInZone(now, n);
  const ids: Record<string, string> = {};

  let participant: TestUser;
  let committee: TestUser;
  let committee2: TestUser;
  let decider: TestUser;
  let followUp: TestUser;
  let finance: TestUser;
  let coordinator: TestUser;
  const applicants: TestUser[] = [];

  const api = () => request(app.getHttpServer());
  const auth = (u: TestUser) => ({ Authorization: `Bearer ${u.token}` });
  const get = (path: string, u: TestUser) => api().get(`/api/v1${path}`).set(auth(u));
  const post = (path: string, u: TestUser, body: object = {}) =>
    api().post(`/api/v1${path}`).set(auth(u)).send(body);
  const put = (path: string, u: TestUser, body: object = {}) =>
    api().put(`/api/v1${path}`).set(auth(u)).send(body);

  const offerData = (
    key: string,
    overrides: Partial<Prisma.OfferUncheckedCreateInput> = {},
  ): Prisma.OfferUncheckedCreateInput => ({
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
    endsAt: days(90),
    priceMxnCents: 1_020_000,
    priceUsdCents: 58_500,
    scholarshipEnabled: true,
    scholarshipLevels: ['AGUA_VIVA', 'AGUAS_LIBRES', 'SPECIAL'],
    ...overrides,
  });

  /** Postulación enviada (como la deja el portal de la Fase 04) con el estado indicado. */
  const application = async (
    user: TestUser,
    offerId: string,
    kind: ApplicationKind,
    status: ApplicationStatus,
    extra: Partial<Prisma.ApplicationUncheckedCreateInput> = {},
  ) => {
    const profile = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const created = await prisma.application.create({
      data: {
        userId: user.id,
        offerId,
        kind,
        status,
        applicantName: profile.fullName,
        applicantEmail: profile.email,
        phoneCountryCode: profile.phoneCountryCode,
        phoneNumber: profile.phoneNumber,
        countryCode: profile.countryCode,
        divisionName: profile.divisionName,
        municipalityName: profile.municipalityName,
        requestedLevel: kind === 'SCHOLARSHIP' ? 'AGUAS_LIBRES' : null,
        intentLetter: kind === 'SCHOLARSHIP' ? 'Carta '.repeat(200) : null,
        currency: 'MXN',
        originalAmountCents: kind === 'SCHOLARSHIP' ? 1_020_000 : 0,
        submittedAt: days(-5),
        termsAcceptedAt: days(-5),
        ...extra,
      },
    });
    return created.id;
  };

  const auditOf = (entityId: string, action: string) =>
    prisma.adminAuditLog.findMany({ where: { entityId, action } });

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
    participant = await createParticipant(app, mail);
    committee = await createStaffUser(app, mail, ['REVIEW_COMMITTEE']);
    committee2 = await createStaffUser(app, mail, ['REVIEW_COMMITTEE']);
    decider = await createStaffUser(app, mail, ['REVIEW_DECIDER']);
    followUp = await createStaffUser(app, mail, ['FOLLOW_UP']);
    finance = await createStaffUser(app, mail, ['FINANCE']);
    coordinator = await createStaffUser(app, mail, ['ACADEMIC_COORDINATOR']);
    for (let i = 0; i < 8; i++) applicants.push(await createParticipant(app, mail));

    ids.diploma = (await prisma.offer.create({ data: offerData('diploma') })).id;
    ids.call = (
      await prisma.offer.create({
        data: offerData('call', {
          type: 'OPEN_CALL',
          modality: 'IN_PERSON',
          isFree: true,
          priceMxnCents: null,
          priceUsdCents: null,
          scholarshipEnabled: false,
          scholarshipLevels: [],
          venueName: 'Sede',
          venueCity: 'Oaxaca',
        }),
      })
    ).id;
    ids.funnel = (await prisma.offer.create({ data: offerData('funnel') })).id;

    ids.a1 = await application(applicants[0], ids.diploma, 'SCHOLARSHIP', 'SUBMITTED');
    ids.a2 = await application(applicants[1], ids.diploma, 'SCHOLARSHIP', 'SUBMITTED', {
      requestedLevel: 'SPECIAL' as ScholarshipLevel,
    });
    ids.c1 = await application(applicants[2], ids.call, 'OPEN_CALL', 'SUBMITTED');
    // Embudo: 4 enviadas → 3 aprobadas → 2 con pago iniciado → 1 inscrita.
    ids.f1 = await application(applicants[3], ids.funnel, 'SCHOLARSHIP', 'ENROLLED', {
      decidedAt: days(-3),
      enrolledAt: days(-1),
      paymentStartedAt: days(-2),
    });
    ids.f2 = await application(
      applicants[4],
      ids.funnel,
      'SCHOLARSHIP',
      'APPROVED_PENDING_PAYMENT',
      {
        decidedAt: days(-3),
        paymentStartedAt: days(-2),
        assignedLevel: 'AGUAS_LIBRES',
        assignedPercent: 50,
        balanceCents: 510_000,
        responseDueAt: addHours(now, 30),
      },
    );
    ids.f3 = await application(applicants[5], ids.funnel, 'SCHOLARSHIP', 'EXPIRED', {
      decidedAt: days(-10),
      assignedLevel: 'AGUAS_LIBRES',
      assignedPercent: 50,
      balanceCents: 510_000,
      responseDueAt: days(-3),
      expiredAt: days(-3),
    });
    ids.f4 = await application(applicants[6], ids.funnel, 'SCHOLARSHIP', 'NOT_SELECTED', {
      decidedAt: days(-3),
    });
    await application(applicants[7], ids.funnel, 'SCHOLARSHIP', 'DRAFT', { submittedAt: null });
  }, 240_000);

  afterAll(async () => {
    await app.close();
  });

  describe('Permisos por rol', () => {
    it('participante y finanzas no ven la bandeja (403)', async () => {
      const res = await get('/admin/applications', participant).expect(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(res.body.meta.missingPermissions).toEqual(['applications.read']);
      await get('/admin/applications', finance).expect(403);
    });

    it('seguimiento no evalúa; el comité no decide ni ve seguimiento', async () => {
      await put(`/admin/applications/${ids.a1}/evaluations/me`, followUp, {
        recommendation: 'APPROVE',
      }).expect(403);
      await post(`/admin/applications/${ids.a1}/approve`, committee, {
        assignedLevel: 'AGUAS_LIBRES',
        emailPreviewConfirmed: true,
      }).expect(403);
      await get(`/admin/funnel/offers/${ids.funnel}`, committee).expect(403);
      await get(`/admin/funnel/offers/${ids.funnel}/follow-ups`, decider).expect(403);
    });

    it('sin sesión → 401', async () => {
      await api().get('/api/v1/admin/applications').expect(401);
    });
  });

  describe('HU-31: revisión en equipo', () => {
    it('bandeja con filtros: tipo, oferta, folio, "Requiere entrevista", sin borradores', async () => {
      const res = await get(`/admin/applications?offerId=${ids.diploma}`, committee).expect(200);
      expect(res.body.meta.total).toBe(2);
      expect(res.body.data[0]).toMatchObject({
        kind: 'SCHOLARSHIP',
        status: 'SUBMITTED',
        evaluationCount: 0,
        myEvaluation: null,
      });
      const interview = await get(
        `/admin/applications?offerId=${ids.diploma}&requiresInterview=true`,
        committee,
      ).expect(200);
      expect(interview.body.data.map((a: { id: string }) => a.id)).toEqual([ids.a2]);
      const folio = res.body.data.find((a: { id: string }) => a.id === ids.a1).folio as string;
      const byFolio = await get(`/admin/applications?q=${folio}`, committee).expect(200);
      expect(byFolio.body.data.map((a: { id: string }) => a.id)).toEqual([ids.a1]);
      const funnelApps = await get(`/admin/applications?offerId=${ids.funnel}`, coordinator).expect(
        200,
      );
      expect(funnelApps.body.meta.total).toBe(4); // el borrador no aparece
      const calls = await get(`/admin/applications?kind=OPEN_CALL&offerId=${ids.call}`, committee);
      expect(calls.body.data[0]).toMatchObject({ id: ids.c1, requiresInterview: true });
    });

    it('abrir el detalle (solo lectura) no cambia el estado; quien evalúa la pasa a "En revisión"', async () => {
      const ro = await get(`/admin/applications/${ids.a1}`, followUp).expect(200);
      expect(ro.body).toMatchObject({ status: 'SUBMITTED', reviewStarted: false });
      const first = await get(`/admin/applications/${ids.a1}`, committee).expect(200);
      expect(first.body).toMatchObject({ status: 'IN_REVIEW', reviewStarted: true });
      expect(first.body.contact.email).toBeDefined();
      expect(first.body.history.map((h: { toStatus: string }) => h.toStatus)).toEqual([
        'IN_REVIEW',
      ]);
      expect(first.body.decision.canDecide).toBe(false);
      const again = await get(`/admin/applications/${ids.a1}`, committee).expect(200);
      expect(again.body.reviewStarted).toBe(false);
      expect(await auditOf(ids.a1, 'application.start-review')).toHaveLength(1);
      // Inexistente / id mal formado → 404
      await get(`/admin/applications/${randomUUID()}`, committee).expect(404);
      await get('/admin/applications/no-es-uuid', committee).expect(404);
    });

    it('evaluaciones por integrante con resumen', async () => {
      await put(`/admin/applications/${ids.a1}/evaluations/me`, committee, {
        recommendation: 'APPROVE',
        suggestedLevel: 'AGUAS_LIBRES',
        comment: 'Sólida experiencia territorial.',
      }).expect(200);
      // Editable: la misma integrante cambia su evaluación (sigue siendo una).
      await put(`/admin/applications/${ids.a1}/evaluations/me`, committee, {
        recommendation: 'APPROVE',
        suggestedLevel: 'AGUAS_LIBRES',
      }).expect(200);
      await put(`/admin/applications/${ids.a1}/evaluations/me`, decider, {
        recommendation: 'APPROVE',
        suggestedLevel: 'AGUAS_LIBRES',
      }).expect(200);
      const res = await put(`/admin/applications/${ids.a1}/evaluations/me`, committee2, {
        recommendation: 'UNSURE',
        suggestedLevel: 'AGUA_VIVA',
      }).expect(200);
      expect(res.body.evaluations).toHaveLength(3);
      expect(res.body.evaluationSummary.label).toBe(
        '2 aprobar · 1 con dudas · nivel más sugerido: Aguas Libres 50%',
      );
      await put(`/admin/applications/${ids.a1}/evaluations/me`, committee, {
        recommendation: 'APPROVE',
        suggestedLevel: 'CENOTES_VIVOS',
      })
        .expect(400)
        .expect((r) => expect(r.body.details[0].code).toBe('LEVEL_NOT_ENABLED'));
      const mine = await get(
        `/admin/applications?offerId=${ids.diploma}&withoutMyEvaluation=true`,
        committee,
      ).expect(200);
      expect(mine.body.data.map((a: { id: string }) => a.id)).toEqual([ids.a2]);
      expect(await auditOf(ids.a1, 'application.evaluate')).toHaveLength(4);
    });

    it('vista previa: Aguas Libres 50% sobre 10,200 MXN → saldo 5,100 MXN a 7 días', async () => {
      const res = await get(
        `/admin/applications/${ids.a1}/decision-preview?decision=APPROVE&assignedLevel=AGUAS_LIBRES&message=Bienvenida`,
        decider,
      ).expect(200);
      expect(res.body).toMatchObject({
        status: 'APPROVED_PENDING_PAYMENT',
        assignedPercent: 50,
        balance: { amountCents: 510_000, currency: 'MXN' },
        blockedReason: null,
      });
      expect(res.body.email.subject).toContain('Tu beca fue aprobada');
      expect(res.body.email.body).toContain('$5,100.00 MXN');
      expect(res.body.email.body).toContain('Bienvenida');
    });

    it('aprobar exige confirmar la vista previa; la beca queda pendiente de pago', async () => {
      await post(`/admin/applications/${ids.a1}/approve`, decider, {
        assignedLevel: 'AGUAS_LIBRES',
      }).expect(400);
      const res = await post(`/admin/applications/${ids.a1}/approve`, decider, {
        assignedLevel: 'AGUAS_LIBRES',
        note: 'Comité 12/11',
        message: 'Te esperamos el día de inicio.',
        emailPreviewConfirmed: true,
      }).expect(200);
      expect(res.body.status).toBe('APPROVED_PENDING_PAYMENT');
      expect(res.body.decision).toMatchObject({
        assignedPercent: 50,
        balance: { amountCents: 510_000, currency: 'MXN' },
        emailStatus: 'SENT',
        decidedBy: { id: decider.id },
      });
      const enrollment = await prisma.enrollment.findUnique({ where: { applicationId: ids.a1 } });
      expect(enrollment?.status).toBe('PENDING_PAYMENT');
      const notice = await prisma.notification.findFirst({
        where: { userId: applicants[0].id, type: 'SCHOLARSHIP_APPROVED' },
      });
      expect(notice?.body).toContain('Te esperamos el día de inicio.');
      // Ya decidida → 409
      await post(`/admin/applications/${ids.a1}/reject`, decider, {
        emailPreviewConfirmed: true,
      }).expect(409);
      expect(await auditOf(ids.a1, 'application.approve')).toHaveLength(1);
    });

    it('beca especial: sin entrevista "Realizada" no se aprueba; con Zoom sí', async () => {
      const blocked = await post(`/admin/applications/${ids.a2}/approve`, decider, {
        assignedLevel: 'SPECIAL',
        assignedPercent: 75,
        emailPreviewConfirmed: true,
      }).expect(422);
      expect(blocked.body.code).toBe('APPLICATION_INTERVIEW_REQUIRED');
      const startsAt = days(2);
      const endsAt = addHours(startsAt, 1);
      await post(`/admin/applications/${ids.a2}/interview`, committee, {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        joinUrl: 'https://meet.google.com/abc-defg-hij',
      }).expect(400);
      const scheduled = await post(`/admin/applications/${ids.a2}/interview`, committee, {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        joinUrl: 'https://us02web.zoom.us/j/123456789',
      }).expect(200);
      expect(scheduled.body.status).toBe('INTERVIEW_SCHEDULED');
      expect(scheduled.body.decision.blockedReason).toBe('APPLICATION_INTERVIEW_REQUIRED');
      const done = await post(
        `/admin/applications/${ids.a2}/interview/complete`,
        committee,
        {},
      ).expect(200);
      expect(done.body.interviews[0].status).toBe('COMPLETED');
      expect(done.body.decision.blockedReason).toBeNull();
      const approved = await post(`/admin/applications/${ids.a2}/approve`, coordinator, {
        assignedLevel: 'SPECIAL',
        assignedPercent: 75,
        emailPreviewConfirmed: true,
      }).expect(200);
      expect(approved.body).toMatchObject({
        status: 'APPROVED_PENDING_PAYMENT',
        assignedPercent: 75,
      });
    });

    it('correo fallido: la decisión se conserva y [Reintentar envío] lo reenvía', async () => {
      mail.failFor = applicants[2].email;
      const res = await post(`/admin/applications/${ids.c1}/reject`, decider, {
        note: 'No cumple elegibilidad',
        emailPreviewConfirmed: true,
      }).expect(200);
      expect(res.body.status).toBe('NOT_SELECTED');
      expect(res.body.decision.emailStatus).toBe('FAILED');
      // Sigue caído: el reintento falla de nuevo pero no rompe nada.
      const still = await post(`/admin/applications/${ids.c1}/retry-email`, decider).expect(200);
      expect(still.body.emailStatus).toBe('FAILED');
      mail.failFor = null;
      const ok = await post(`/admin/applications/${ids.c1}/retry-email`, decider).expect(200);
      expect(ok.body.emailStatus).toBe('SENT');
      await post(`/admin/applications/${ids.c1}/retry-email`, decider).expect(409);
      expect(await auditOf(ids.c1, 'application.retry-email')).toHaveLength(2);
      await post(`/admin/applications/${ids.c1}/retry-email`, committee).expect(403);
    });

    it('exportar a CSV con los filtros', async () => {
      const res = await get(`/admin/applications/export?offerId=${ids.diploma}`, committee).expect(
        200,
      );
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text.startsWith('﻿Folio,Tipo,Estado')).toBe(true);
      expect(res.text).toContain('Aprobada – pendiente de pago');
    });
  });

  describe('HU-32: embudo y seguimiento', () => {
    it('embudo 4 → 3 → 2 → 1 (sin borradores)', async () => {
      const list = await get(`/admin/funnel/offers?q=${token}`, followUp).expect(200);
      expect(list.body.data.map((o: { id: string }) => o.id)).toContain(ids.funnel);
      const res = await get(`/admin/funnel/offers/${ids.funnel}`, followUp).expect(200);
      expect(res.body.stages.map((s: { count: number }) => s.count)).toEqual([4, 3, 2, 1]);
      expect(res.body).toMatchObject({
        conversionPercent: 25,
        pendingPayment: 1,
        expired: 1,
        notSelected: 1,
        dueSoon: 1,
      });
    });

    it('"Aprobados sin pagar" con contacto, WhatsApp y alerta de plazo', async () => {
      const res = await get(`/admin/funnel/offers/${ids.funnel}/follow-ups`, followUp).expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({
        applicationId: ids.f2,
        dueSoon: true,
        remainingDays: 2,
        paymentStarted: true,
        canRemind: true,
        balance: { amountCents: 510_000, currency: 'MXN' },
      });
      expect(res.body.data[0].phone.whatsappUrl).toMatch(/^https:\/\/wa\.me\/52\d+$/);
      const expired = await get(
        `/admin/funnel/offers/${ids.funnel}/follow-ups?tab=EXPIRED`,
        followUp,
      ).expect(200);
      expect(expired.body.data.map((i: { applicationId: string }) => i.applicationId)).toEqual([
        ids.f3,
      ]);
    });

    it('recordatorio: máximo 1 cada 24 h, con nota automática', async () => {
      const res = await post(`/admin/applications/${ids.f2}/reminders`, followUp).expect(201);
      expect(res.body.note.kind).toBe('REMINDER_SENT');
      expect(res.body.emailStatus).toBe('SENT');
      const again = await post(`/admin/applications/${ids.f2}/reminders`, followUp).expect(409);
      expect(again.body.code).toBe('FOLLOW_UP_REMINDER_TOO_SOON');
      expect(again.body.meta.availableAt).toBeDefined();
      await post(`/admin/applications/${ids.f3}/reminders`, followUp).expect(409); // vencida
      const notices = await prisma.notification.findMany({
        where: { userId: applicants[4].id, type: 'BALANCE_DUE_REMINDER' },
      });
      expect(notices).toHaveLength(1);
      const list = await get(`/admin/funnel/offers/${ids.funnel}/follow-ups`, followUp).expect(200);
      expect(list.body.data[0]).toMatchObject({ canRemind: false });
      expect(list.body.data[0].lastContactAt).not.toBeNull();
    });

    it('WhatsApp prellenado y teléfono inválido', async () => {
      const res = await post(`/admin/applications/${ids.f2}/whatsapp`, followUp, {
        template: 'Hola {nombre}, tu saldo es {saldo}: {link_pago}',
      }).expect(201);
      expect(res.body.url).toMatch(/^https:\/\/wa\.me\/52\d+\?text=/);
      expect(res.body.text).toContain('$5,100.00 MXN');
      expect(res.body.text).toContain(`/portal/postulaciones/${ids.f2}/pago`);
      await prisma.application.update({ where: { id: ids.f3 }, data: { phoneNumber: '' } });
      const bad = await post(`/admin/applications/${ids.f3}/whatsapp`, followUp).expect(422);
      expect(bad.body.code).toBe('FOLLOW_UP_PHONE_INVALID');
    });

    it('notas con resultado y línea de tiempo', async () => {
      await post(`/admin/applications/${ids.f2}/notes`, followUp, {
        body: 'Pagará el viernes.',
        outcome: 'WILL_PAY_SOON',
      }).expect(201);
      await post(`/admin/applications/${ids.f2}/notes`, followUp, {
        body: 'x'.repeat(1001),
      }).expect(400);
      const notes = await get(`/admin/applications/${ids.f2}/notes`, followUp).expect(200);
      expect(notes.body.data.map((n: { kind: string }) => n.kind)).toEqual([
        'NOTE',
        'WHATSAPP_CONTACT',
        'REMINDER_SENT',
      ]);
      const detail = await get(`/admin/applications/${ids.f2}/follow-up`, followUp).expect(200);
      expect(detail.body.lastOutcome).toBe('WILL_PAY_SOON');
      expect(detail.body.timeline.map((t: { kind: string }) => t.kind)).toEqual(
        expect.arrayContaining(['NOTE', 'REMINDER_SENT', 'WHATSAPP_CONTACT']),
      );
      // Postulación no aprobada → 409
      await get(`/admin/applications/${ids.a2}/follow-up`, followUp).expect(200);
      await post(`/admin/applications/${ids.f4}/notes`, followUp, { body: 'x' }).expect(409);
    });

    it('extender plazo reactiva una "Vencida" (motivo obligatorio)', async () => {
      await post(`/admin/applications/${ids.f3}/extend-deadline`, followUp, {
        responseDueAt: days(5).toISOString(),
      }).expect(400);
      await post(`/admin/applications/${ids.f3}/extend-deadline`, followUp, {
        responseDueAt: days(60).toISOString(),
        reason: 'Más allá del inicio',
      }).expect(400);
      const res = await post(`/admin/applications/${ids.f3}/extend-deadline`, followUp, {
        responseDueAt: days(5).toISOString(),
        reason: 'Pidió una semana más.',
      }).expect(200);
      expect(res.body.status).toBe('APPROVED_PENDING_PAYMENT');
      const enrollment = await prisma.enrollment.findUnique({ where: { applicationId: ids.f3 } });
      expect(enrollment?.status).toBe('PENDING_PAYMENT');
      expect(await auditOf(ids.f3, 'application.extend-deadline')).toHaveLength(1);
      await post(`/admin/applications/${ids.f3}/extend-deadline`, committee, {
        responseDueAt: days(5).toISOString(),
        reason: 'x',
      }).expect(403);
    });

    it('cerrar inscripciones de la oferta', async () => {
      await post(`/admin/funnel/offers/${ids.funnel}/close-enrollment`, finance).expect(403);
      const res = await post(`/admin/funnel/offers/${ids.funnel}/close-enrollment`, followUp, {
        reason: 'Cupo completo',
      }).expect(200);
      const offer = await prisma.offer.findUniqueOrThrow({ where: { id: ids.funnel } });
      expect(offer.enrollmentClosesAt?.toISOString()).toBe(res.body.enrollmentClosesAt);
      await post(`/admin/funnel/offers/${ids.funnel}/close-enrollment`, followUp).expect(409);
      expect(await auditOf(ids.funnel, 'offer.close-enrollment')).toHaveLength(1);
    });
  });
});
