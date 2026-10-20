import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { MAIL_DRIVER } from '../src/infra/mail/mail.types';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { createTestApp } from './utils/create-test-app';
import {
  createVerifiedUser,
  login,
  PASSWORD,
  randomIp,
  registrationBody,
  uniqueEmail,
} from './utils/identity';
import { MailCapture } from './utils/mail-capture';

describe('Auth (e2e) — HU-02, HU-03, HU-04, HU-05', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const mail = new MailCapture();

  beforeAll(async () => {
    app = await createTestApp({
      customize: (builder) => builder.overrideProvider(MAIL_DRIVER).useValue(mail),
    });
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const post = (path: string, ip = randomIp()) =>
    http().post(`/api/v1${path}`).set('X-Forwarded-For', ip);

  /** Simula que pasó el cooldown de reenvío moviendo hacia atrás el último código. */
  async function skipCooldown(email: string): Promise<void> {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.otpCode.updateMany({
      where: { userId: user.id },
      data: { createdAt: new Date(Date.now() - 120_000) },
    });
  }

  describe('registro → OTP → login → refresh → logout', () => {
    const ip = randomIp();
    let body: Record<string, unknown>;
    let email: string;

    beforeAll(async () => {
      body = await registrationBody(app, { email: '  Nueva.Persona@Example.COM ' });
      email = 'nueva.persona@example.com';
      await prisma.user.deleteMany({ where: { email } });
    });

    it('POST /auth/register → 201 PENDING_VERIFICATION y envía el OTP', async () => {
      const res = await post('/auth/register', ip).send(body).expect(201);
      expect(res.body).toMatchObject({
        email,
        status: 'PENDING_VERIFICATION',
        otp: { maskedEmail: 'n***@example.com', codeLength: 6 },
      });
      const expiresAt = new Date(res.body.otp.expiresAt as string).getTime();
      const resendAt = new Date(res.body.otp.resendAvailableAt as string).getTime();
      expect(expiresAt - Date.now()).toBeGreaterThan(9 * 60_000);
      expect(resendAt - Date.now()).toBeLessThanOrEqual(30_000);
      expect(mail.last(email)?.subject).toContain('código de verificación');
      expect(mail.lastOtp(email)).toMatch(/^\d{6}$/);
    });

    it('registro duplicado → 409 AUTH_EMAIL_ALREADY_REGISTERED', async () => {
      const res = await post('/auth/register', ip)
        .send({ ...body, username: 'otro_usuario_x1' })
        .expect(409);
      expect(res.body.code).toBe('AUTH_EMAIL_ALREADY_REGISTERED');
      expect(res.body.details).toEqual([expect.objectContaining({ field: 'email' })]);
    });

    it('GET /auth/availability refleja el registro', async () => {
      const res = await http()
        .get('/api/v1/auth/availability')
        .query({ email: email.toUpperCase(), username: 'disponible_123' })
        .expect(200);
      expect(res.body).toEqual({
        email: { value: email, valid: true, available: false },
        username: { value: 'disponible_123', valid: true, available: true },
      });
      const invalid = await http()
        .get('/api/v1/auth/availability')
        .query({ username: 'x' })
        .expect(200);
      expect(invalid.body.username).toEqual({ value: 'x', valid: false, available: false });
    });

    it('login sin verificar → 403 AUTH_EMAIL_NOT_VERIFIED (sin reenvío en cooldown)', async () => {
      const sentBefore = mail.to(email).length;
      const res = await post('/auth/login', ip).send({ email, password: PASSWORD }).expect(403);
      expect(res.body.code).toBe('AUTH_EMAIL_NOT_VERIFIED');
      expect(res.body.meta).toMatchObject({
        email,
        maskedEmail: 'n***@example.com',
        otpSent: false,
        codeLength: 6,
      });
      expect(res.body.meta.expiresAt).toEqual(expect.any(String));
      expect(res.body.meta.resendAvailableAt).toEqual(expect.any(String));
      expect(mail.to(email).length).toBe(sentBefore);
    });

    it('login sin verificar tras el cooldown → reenvía el OTP (otpSent: true)', async () => {
      await skipCooldown(email);
      const res = await post('/auth/login', ip).send({ email, password: PASSWORD }).expect(403);
      expect(res.body.meta.otpSent).toBe(true);
    });

    it('login sin verificar con contraseña incorrecta → mensaje genérico', async () => {
      const res = await post('/auth/login', ip).send({ email, password: 'Otra12345' }).expect(401);
      expect(res.body.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('verify-email con código incorrecto → 400 AUTH_OTP_INVALID con intentos restantes', async () => {
      const code = mail.lastOtp(email);
      const wrong = code === '000000' ? '111111' : '000000';
      const res = await post('/auth/verify-email', ip).send({ email, code: wrong }).expect(400);
      expect(res.body.code).toBe('AUTH_OTP_INVALID');
      expect(res.body.meta).toEqual({ attemptsRemaining: 4 });
    });

    it('verify-email con código válido → 200 y la cuenta queda ACTIVE', async () => {
      const res = await post('/auth/verify-email', ip)
        .send({ email, code: mail.lastOtp(email) })
        .expect(200);
      expect(res.body).toEqual({ verified: true, email });
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.status).toBe('ACTIVE');
      expect(user.emailVerifiedAt).not.toBeNull();
    });

    it('verify-email de nuevo → 409 AUTH_ALREADY_VERIFIED', async () => {
      const res = await post('/auth/verify-email', ip).send({ email, code: '123456' }).expect(409);
      expect(res.body.code).toBe('AUTH_ALREADY_VERIFIED');
    });

    let refreshToken: string;

    it('login → 200 tokens + perfil', async () => {
      const res = await post('/auth/login', ip)
        .send({ email: 'NUEVA.persona@example.com', password: PASSWORD, rememberMe: true })
        .expect(200);
      expect(res.body).toMatchObject({
        tokenType: 'Bearer',
        expiresIn: 900,
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        user: { email, currency: 'MXN', roles: ['PARTICIPANT'], status: 'ACTIVE' },
      });
      const days =
        (new Date(res.body.refreshTokenExpiresAt as string).getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(29); // rememberMe → 30 días
      refreshToken = res.body.refreshToken;

      await http()
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(200);
    });

    it('refresh rota el token; reusar el anterior revoca la sesión', async () => {
      const first = await post('/auth/refresh', ip).send({ refreshToken }).expect(200);
      expect(first.body.refreshToken).not.toBe(refreshToken);

      const reuse = await post('/auth/refresh', ip).send({ refreshToken }).expect(401);
      expect(reuse.body.code).toBe('AUTH_REFRESH_INVALID');

      // La familia quedó revocada: el token nuevo tampoco sirve.
      await post('/auth/refresh', ip).send({ refreshToken: first.body.refreshToken }).expect(401);
    });

    it('logout revoca la sesión (idempotente)', async () => {
      const session = await login(app, email, PASSWORD);
      await post('/auth/logout', ip).send({ refreshToken: session.refreshToken }).expect(204);
      await post('/auth/logout', ip).send({ refreshToken: session.refreshToken }).expect(204);
      const res = await post('/auth/refresh', ip)
        .send({ refreshToken: session.refreshToken })
        .expect(401);
      expect(res.body.code).toBe('AUTH_REFRESH_INVALID');
    });
  });

  describe('validaciones de registro (HU-02)', () => {
    it('reglas de nombre, contraseña, teléfono y username', async () => {
      const body = await registrationBody(app, {
        fullName: 'Juan 123',
        password: 'abcdefgh',
        username: 'a',
        phone: { countryCode: '52', number: '55a12' },
      });
      const res = await post('/auth/register').send(body).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      const fields = (res.body.details as Array<{ field: string; code: string }>).map(
        (d) => `${d.field}:${d.code}`,
      );
      expect(fields).toEqual(
        expect.arrayContaining([
          'fullName:MATCHES',
          'password:PASSWORD_HAS_DIGIT',
          'username:MATCHES',
          'phone.countryCode:MATCHES',
          'phone.number:MATCHES',
        ]),
      );
    });

    it('teléfono con longitud inválida para el indicativo → INVALID_PHONE', async () => {
      const body = await registrationBody(app, { phone: { countryCode: '+52', number: '55123' } });
      const res = await post('/auth/register').send(body).expect(400);
      expect(res.body.details).toEqual([
        expect.objectContaining({ field: 'phone.number', code: 'INVALID_PHONE' }),
      ]);
    });

    it('México sin municipio de catálogo → location.municipalityId REQUIRED', async () => {
      const base = await registrationBody(app);
      const location = { ...(base.location as Record<string, unknown>) };
      delete location.municipalityId;
      const res = await post('/auth/register')
        .send({ ...base, location: { ...location, municipalityName: 'Coyoacán' } })
        .expect(400);
      expect(res.body.details).toEqual([
        expect.objectContaining({ field: 'location.municipalityId', code: 'REQUIRED' }),
      ]);
    });

    it('país sin lista (Colombia) acepta estado y municipio en texto libre', async () => {
      const body = await registrationBody(app, {
        phone: { countryCode: '+57', number: '3001234567' },
        location: { countryCode: 'co', divisionName: 'Antioquia', municipalityName: 'Medellín' },
      });
      await post('/auth/register').send(body).expect(201);
      const user = await prisma.user.findUniqueOrThrow({ where: { email: body.email as string } });
      expect(user).toMatchObject({
        countryCode: 'CO',
        divisionId: null,
        divisionName: 'Antioquia',
        municipalityName: 'Medellín',
      });
    });

    it('zona horaria inválida → IS_IANA_TIMEZONE', async () => {
      const body = await registrationBody(app, { timezone: 'Marte/Olympus' });
      const res = await post('/auth/register').send(body).expect(400);
      expect(res.body.details).toEqual([
        expect.objectContaining({ field: 'timezone', code: 'IS_IANA_TIMEZONE' }),
      ]);
    });

    it('username duplicado → 409 AUTH_USERNAME_TAKEN', async () => {
      const first = await registrationBody(app);
      await post('/auth/register').send(first).expect(201);
      const second = await registrationBody(app, { username: first.username });
      const res = await post('/auth/register').send(second).expect(409);
      expect(res.body.code).toBe('AUTH_USERNAME_TAKEN');
    });
  });

  describe('OTP: cooldown, reenvío y bloqueo (HU-03)', () => {
    it('reenviar dentro del cooldown → 429 AUTH_OTP_COOLDOWN con resendAvailableAt', async () => {
      const body = await registrationBody(app);
      await post('/auth/register').send(body).expect(201);
      const res = await post('/auth/otp/resend')
        .send({ email: body.email, purpose: 'EMAIL_VERIFICATION' })
        .expect(429);
      expect(res.body.code).toBe('AUTH_OTP_COOLDOWN');
      expect(new Date(res.body.meta.resendAvailableAt as string).getTime()).toBeGreaterThan(
        Date.now(),
      );
    });

    it('reenviar tras el cooldown invalida el código anterior', async () => {
      const body = await registrationBody(app);
      const email = body.email as string;
      await post('/auth/register').send(body).expect(201);
      const oldCode = mail.lastOtp(email);
      await skipCooldown(email);

      const resend = await post('/auth/otp/resend')
        .send({ email, purpose: 'EMAIL_VERIFICATION' })
        .expect(200);
      expect(resend.body).toMatchObject({ codeLength: 6, maskedEmail: expect.any(String) });
      const newCode = mail.lastOtp(email);

      if (oldCode !== newCode) {
        const res = await post('/auth/verify-email').send({ email, code: oldCode }).expect(400);
        expect(res.body.code).toBe('AUTH_OTP_INVALID');
      }
      await post('/auth/verify-email').send({ email, code: newCode }).expect(200);
    });

    it('código expirado → 400 AUTH_OTP_EXPIRED', async () => {
      const body = await registrationBody(app);
      const email = body.email as string;
      await post('/auth/register').send(body).expect(201);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      await prisma.otpCode.updateMany({
        where: { userId: user.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const res = await post('/auth/verify-email')
        .send({ email, code: mail.lastOtp(email) })
        .expect(400);
      expect(res.body.code).toBe('AUTH_OTP_EXPIRED');
    });

    it('5 intentos fallidos → 429 AUTH_OTP_LOCKED; ni el código correcto ni reenviar funcionan', async () => {
      const body = await registrationBody(app);
      const email = body.email as string;
      await post('/auth/register').send(body).expect(201);
      const code = mail.lastOtp(email);
      const wrong = code === '000000' ? '111111' : '000000';
      const ip = randomIp();

      for (let i = 1; i <= 4; i++) {
        const res = await post('/auth/verify-email', ip).send({ email, code: wrong }).expect(400);
        expect(res.body.meta.attemptsRemaining).toBe(5 - i);
      }
      const locked = await post('/auth/verify-email', ip).send({ email, code: wrong }).expect(429);
      expect(locked.body.code).toBe('AUTH_OTP_LOCKED');
      expect(new Date(locked.body.meta.lockedUntil as string).getTime()).toBeGreaterThan(
        Date.now(),
      );

      const correct = await post('/auth/verify-email', ip).send({ email, code }).expect(429);
      expect(correct.body.code).toBe('AUTH_OTP_LOCKED');

      await skipCooldown(email);
      const resend = await post('/auth/otp/resend', ip)
        .send({ email, purpose: 'EMAIL_VERIFICATION' })
        .expect(429);
      expect(resend.body.code).toBe('AUTH_OTP_LOCKED');
    });

    it('reenviar a una cuenta ya verificada → 409 AUTH_ALREADY_VERIFIED', async () => {
      const { email } = await createVerifiedUser(app, mail);
      const res = await post('/auth/otp/resend')
        .send({ email, purpose: 'EMAIL_VERIFICATION' })
        .expect(409);
      expect(res.body.code).toBe('AUTH_ALREADY_VERIFIED');
    });
  });

  describe('login (HU-04)', () => {
    it('correo inexistente y contraseña incorrecta dan el mismo error genérico', async () => {
      const { email } = await createVerifiedUser(app, mail);
      const a = await post('/auth/login')
        .send({ email: uniqueEmail('nadie'), password: PASSWORD })
        .expect(401);
      const b = await post('/auth/login').send({ email, password: 'Incorrecta1' }).expect(401);
      expect(a.body.code).toBe('AUTH_INVALID_CREDENTIALS');
      expect(b.body.code).toBe('AUTH_INVALID_CREDENTIALS');
      expect(a.body.message).toBe(b.body.message);
    });

    it('5 fallos consecutivos → 429 AUTH_LOGIN_LOCKED (también con la contraseña correcta)', async () => {
      const { email, password } = await createVerifiedUser(app, mail);
      const ip = randomIp();
      for (let i = 0; i < 4; i++) {
        await post('/auth/login', ip).send({ email, password: 'Incorrecta1' }).expect(401);
      }
      const locked = await post('/auth/login', ip)
        .send({ email, password: 'Incorrecta1' })
        .expect(429);
      expect(locked.body.code).toBe('AUTH_LOGIN_LOCKED');
      expect(locked.body.meta.lockedUntil).toEqual(expect.any(String));
      const res = await post('/auth/login', ip).send({ email, password }).expect(429);
      expect(res.body.code).toBe('AUTH_LOGIN_LOCKED');
    });

    it('campos vacíos → 400 VALIDATION_ERROR', async () => {
      const res = await post('/auth/login').send({ email: '', password: '' }).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('recuperación de contraseña (HU-05)', () => {
    it('correo sin cuenta → 404 AUTH_ACCOUNT_NOT_FOUND (revealUnknownEmailOnReset)', async () => {
      const res = await post('/auth/password/forgot')
        .send({ email: uniqueEmail('nadie') })
        .expect(404);
      expect(res.body.code).toBe('AUTH_ACCOUNT_NOT_FOUND');
    });

    it('flujo completo: forgot → verify-otp → reset; cierra sesiones y desbloquea', async () => {
      const { email, password } = await createVerifiedUser(app, mail);
      const session = await login(app, email, password);
      const ip = randomIp();

      const forgot = await post('/auth/password/forgot', ip).send({ email }).expect(200);
      expect(forgot.body).toMatchObject({ codeLength: 6, expiresAt: expect.any(String) });
      expect(mail.last(email)?.subject).toContain('recuperar tu contraseña');
      const code = mail.lastOtp(email);

      const bad = await post('/auth/password/verify-otp', ip)
        .send({ email, code: code === '000000' ? '111111' : '000000' })
        .expect(400);
      expect(bad.body.code).toBe('AUTH_OTP_INVALID');

      const verified = await post('/auth/password/verify-otp', ip)
        .send({ email, code })
        .expect(200);
      const { resetToken } = verified.body as { resetToken: string };
      expect(resetToken).toEqual(expect.any(String));

      // El OTP ya no sirve una segunda vez.
      const again = await post('/auth/password/verify-otp', ip).send({ email, code }).expect(400);
      expect(again.body.code).toBe('AUTH_OTP_EXPIRED');

      const mismatch = await post('/auth/password/reset', ip)
        .send({ resetToken, newPassword: 'NuevaClave2027', confirmPassword: 'Distinta2027' })
        .expect(400);
      expect(mismatch.body.details).toEqual([
        expect.objectContaining({ field: 'confirmPassword', code: 'PASSWORD_MISMATCH' }),
      ]);

      await post('/auth/password/reset', ip)
        .send({ resetToken, newPassword: 'NuevaClave2027', confirmPassword: 'NuevaClave2027' })
        .expect(204);

      // Un solo uso.
      const reuse = await post('/auth/password/reset', ip)
        .send({ resetToken, newPassword: 'OtraClave2028', confirmPassword: 'OtraClave2028' })
        .expect(400);
      expect(reuse.body.code).toBe('AUTH_RESET_TOKEN_INVALID');

      // Sesiones previas revocadas.
      await post('/auth/refresh', ip).send({ refreshToken: session.refreshToken }).expect(401);

      await post('/auth/login', ip).send({ email, password }).expect(401);
      await login(app, email, 'NuevaClave2027');
    });

    it('resetToken inventado → 400 AUTH_RESET_TOKEN_INVALID', async () => {
      const res = await post('/auth/password/reset')
        .send({
          resetToken: 'no-existe',
          newPassword: 'NuevaClave2027',
          confirmPassword: 'NuevaClave2027',
        })
        .expect(400);
      expect(res.body.code).toBe('AUTH_RESET_TOKEN_INVALID');
    });
  });

  describe('rutas protegidas', () => {
    it('sin token → 401 UNAUTHORIZED', async () => {
      const res = await http().get('/api/v1/me').expect(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('token inválido → 401 UNAUTHORIZED', async () => {
      const res = await http()
        .get('/api/v1/me')
        .set('Authorization', 'Bearer no.es.un.jwt')
        .expect(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('usuario demo del seed puede iniciar sesión', async () => {
      const session = await login(app, 'participante@example.com', 'Demo12345');
      expect(session.user).toMatchObject({ username: 'participante.demo', currency: 'MXN' });
      const admin = await login(app, 'admin@example.com', 'Admin12345');
      expect(admin.user).toMatchObject({ roles: ['SUPER_ADMIN'] });
    });
  });
});
