import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { MAIL_DRIVER } from '../src/infra/mail/mail.types';
import { createTestApp } from './utils/create-test-app';
import { createVerifiedUser, login, randomIp } from './utils/identity';
import { MailCapture } from './utils/mail-capture';

describe('Perfil (e2e) — HU-14, HU-11', () => {
  let app: NestExpressApplication;
  const mail = new MailCapture();
  let email: string;
  let password: string;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp({
      customize: (builder) => builder.overrideProvider(MAIL_DRIVER).useValue(mail),
    });
    ({ email, password } = await createVerifiedUser(app, mail));
    token = (await login(app, email, password)).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

  it('GET /me → perfil con moneda derivada del país', async () => {
    const res = await auth(http().get('/api/v1/me')).expect(200);
    expect(res.body).toMatchObject({
      email,
      fullName: 'María José Núñez',
      phone: { countryCode: '+52', number: '5512345678' },
      location: {
        countryCode: 'MX',
        countryName: 'México',
        divisionName: 'Ciudad de México',
        municipalityName: 'Coyoacán',
      },
      timezone: 'America/Bogota',
      currency: 'MXN',
      roles: ['PARTICIPANT'],
    });
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('PATCH /me cambia datos y al pasar a otro país la moneda es USD', async () => {
    const res = await auth(http().patch('/api/v1/me'))
      .send({
        fullName: '  Ana   Lucía Pérez ',
        phone: { countryCode: '+57', number: '300 123 4567' },
        location: { countryCode: 'CO', divisionName: 'Antioquia', municipalityName: 'Medellín' },
      })
      .expect(200);
    expect(res.body).toMatchObject({
      fullName: 'Ana Lucía Pérez',
      phone: { countryCode: '+57', number: '3001234567' },
      location: { countryCode: 'CO', divisionId: null, divisionName: 'Antioquia' },
      currency: 'USD',
      timezone: 'America/Bogota',
    });
  });

  it('PATCH /me no permite cambiar username ni correo', async () => {
    const res = await auth(http().patch('/api/v1/me'))
      .send({ username: 'otro', email: 'otro@example.com' })
      .expect(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'username', code: 'UNKNOWN_FIELD' }),
        expect.objectContaining({ field: 'email', code: 'UNKNOWN_FIELD' }),
      ]),
    );
  });

  it('PATCH /me con ubicación inválida → INVALID_LOCATION', async () => {
    const res = await auth(http().patch('/api/v1/me'))
      .send({ location: { countryCode: 'ZZ', divisionName: 'Xx', municipalityName: 'Yy' } })
      .expect(400);
    expect(res.body.details).toEqual([
      expect.objectContaining({ field: 'location.countryCode', code: 'INVALID_LOCATION' }),
    ]);
  });

  it('PATCH /me/timezone guarda la zona ("Usar siempre esta zona")', async () => {
    const res = await auth(http().patch('/api/v1/me/timezone'))
      .send({ timezone: 'Europe/Madrid' })
      .expect(200);
    expect(res.body.timezone).toBe('Europe/Madrid');
    const bad = await auth(http().patch('/api/v1/me/timezone'))
      .send({ timezone: 'Hora/Local' })
      .expect(400);
    expect(bad.body.details[0].code).toBe('IS_IANA_TIMEZONE');
  });

  it('POST /me/password valida la actual y conserva la sesión actual', async () => {
    const other = await login(app, email, password);

    const wrong = await auth(http().post('/api/v1/me/password'))
      .set('X-Forwarded-For', randomIp())
      .send({
        currentPassword: 'NoEsLaMia1',
        newPassword: 'NuevaClave2027',
        confirmPassword: 'NuevaClave2027',
      })
      .expect(400);
    expect(wrong.body.code).toBe('AUTH_CURRENT_PASSWORD_INVALID');

    const weak = await auth(http().post('/api/v1/me/password'))
      .send({ currentPassword: password, newPassword: 'corta1', confirmPassword: 'corta1' })
      .expect(400);
    expect(weak.body.details[0]).toMatchObject({ field: 'newPassword', code: 'MIN_LENGTH' });

    await auth(http().post('/api/v1/me/password'))
      .send({
        currentPassword: password,
        newPassword: 'NuevaClave2027',
        confirmPassword: 'NuevaClave2027',
      })
      .expect(204);

    // La otra sesión se cerró; la actual sigue.
    await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: other.refreshToken })
      .expect(401);
    await auth(http().get('/api/v1/me')).expect(200);
    await login(app, email, 'NuevaClave2027');
  });
});
