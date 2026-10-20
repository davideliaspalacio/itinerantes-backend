import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { MAIL_DRIVER } from '../src/infra/mail/mail.types';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { createTestApp } from './utils/create-test-app';
import { randomIp, uniqueEmail } from './utils/identity';
import { MailCapture } from './utils/mail-capture';

describe('Contacto (e2e) — HU-38 / HU-01', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const mail = new MailCapture();

  beforeAll(async () => {
    process.env.CONTACT_INBOX_EMAIL = 'contacto-equipo@example.com';
    app = await createTestApp({
      customize: (builder) => builder.overrideProvider(MAIL_DRIVER).useValue(mail),
    });
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    delete process.env.CONTACT_INBOX_EMAIL;
    await app.close();
  });

  const send = (body: Record<string, unknown>, ip = randomIp()) =>
    request(app.getHttpServer())
      .post('/api/v1/contact-messages')
      .set('X-Forwarded-For', ip)
      .set('User-Agent', 'e2e-test')
      .send(body);

  const base = () => ({
    name: 'Lucía Hernández',
    email: uniqueEmail('contacto'),
    subject: 'SCHOOL',
    message: 'Quisiera información sobre el próximo diplomado.',
    privacyAccepted: true,
    origin: 'CONTACT_PAGE',
  });

  it('mensaje válido → 201, queda NEW con hash de IP, acuse y aviso al equipo', async () => {
    const body = {
      ...base(),
      organization: 'Cooperativa',
      phone: { countryCode: '+52', number: '5512345678' },
    };
    const res = await send(body, '203.0.113.7').expect(201);
    expect(res.body).toMatchObject({ id: expect.any(String), status: 'NEW' });

    const saved = await prisma.contactMessage.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(saved).toMatchObject({
      email: body.email,
      subject: 'SCHOOL',
      origin: 'CONTACT_PAGE',
      status: 'NEW',
      phoneNumber: '5512345678',
      userAgent: 'e2e-test',
      projectType: null,
    });
    expect(saved.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(saved.ipHash).not.toContain('203.0.113.7');

    expect(mail.last(body.email)?.subject).toBe('Recibimos tu mensaje');
    const team = mail.last('contacto-equipo@example.com');
    expect(team?.replyTo).toBe(body.email);
    expect(team?.text).toContain('Asunto: Escuela');
  });

  it('"Diseño y asesoría" exige tipo de proyecto, ubicación y servicio', async () => {
    const res = await send({ ...base(), subject: 'DESIGN_CONSULTING' }).expect(400);
    const fields = (res.body.details as Array<{ field: string }>).map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['projectType', 'projectLocation', 'service']));

    const ok = await send({
      ...base(),
      subject: 'DESIGN_CONSULTING',
      origin: 'DESIGN_CONSULTING_PAGE',
      projectType: 'COLLECTIVE',
      projectLocation: 'San Cristóbal de las Casas, Chiapas',
      service: 'RAINWATER_HARVESTING_DESIGN',
    }).expect(201);
    const saved = await prisma.contactMessage.findUniqueOrThrow({ where: { id: ok.body.id } });
    expect(saved).toMatchObject({
      projectType: 'COLLECTIVE',
      service: 'RAINWATER_HARVESTING_DESIGN',
    });
  });

  it('otro asunto ignora los datos del proyecto', async () => {
    const ok = await send({ ...base(), origin: 'LANDING', projectType: 'HOUSEHOLD' }).expect(201);
    const saved = await prisma.contactMessage.findUniqueOrThrow({ where: { id: ok.body.id } });
    expect(saved).toMatchObject({ origin: 'LANDING', projectType: null });
  });

  it('validaciones: nombre corto, mensaje corto, política no aceptada', async () => {
    const res = await send({
      ...base(),
      name: 'Al',
      message: 'Hola',
      privacyAccepted: false,
    }).expect(400);
    const fields = (res.body.details as Array<{ field: string }>).map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'message', 'privacyAccepted']));
  });

  it('honeypot con texto → 201 pero no se guarda ni se envía nada', async () => {
    const body = { ...base(), website: 'http://spam.example' };
    const sentBefore = mail.messages.length;
    const res = await send(body).expect(201);
    expect(res.body.status).toBe('NEW');
    expect(await prisma.contactMessage.findUnique({ where: { id: res.body.id } })).toBeNull();
    expect(await prisma.contactMessage.count({ where: { email: body.email } })).toBe(0);
    expect(mail.messages.length).toBe(sentBefore);
  });

  it('máximo 5 envíos por IP por hora → 429 RATE_LIMITED', async () => {
    const ip = randomIp();
    for (let i = 0; i < 5; i++) {
      await send(base(), ip).expect(201);
    }
    const res = await send(base(), ip).expect(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    // Otra IP no está afectada.
    await send(base()).expect(201);
  });
});
