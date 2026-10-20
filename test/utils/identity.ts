import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../../src/infra/prisma/prisma.service';
import type { MailCapture } from './mail-capture';

/** IP aleatoria (X-Forwarded-For) para aislar los límites de @Throttle entre pruebas. */
export function randomIp(): string {
  return `10.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`;
}

export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}-${randomUUID().slice(0, 8)}@example.com`;
}

export const PASSWORD = 'Agua2026segura';

/** Cuerpo de registro válido (México, con ids de catálogo de CDMX / Coyoacán). */
export async function registrationBody(
  app: NestExpressApplication,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const prisma = app.get(PrismaService);
  const cdmx = await prisma.adminDivision.findUniqueOrThrow({
    where: { countryCode_code: { countryCode: 'MX', code: '09' } },
  });
  const coyoacan = await prisma.municipality.findUniqueOrThrow({
    where: { divisionId_code: { divisionId: cdmx.id, code: '003' } },
  });
  const email = uniqueEmail();
  return {
    fullName: 'María José Núñez',
    username: `u_${randomUUID().slice(0, 12).replace(/-/g, '')}`,
    email,
    password: PASSWORD,
    phone: { countryCode: '+52', number: '5512345678' },
    location: { countryCode: 'MX', divisionId: cdmx.id, municipalityId: coyoacan.id },
    timezone: 'America/Bogota',
    ...overrides,
  };
}

/** Registra y verifica un usuario; devuelve email y contraseña. */
export async function createVerifiedUser(
  app: NestExpressApplication,
  mail: MailCapture,
  overrides: Record<string, unknown> = {},
): Promise<{ email: string; password: string }> {
  const ip = randomIp();
  const body = await registrationBody(app, overrides);
  await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .set('X-Forwarded-For', ip)
    .send(body)
    .expect(201);
  const email = body.email as string;
  await request(app.getHttpServer())
    .post('/api/v1/auth/verify-email')
    .set('X-Forwarded-For', ip)
    .send({ email, code: mail.lastOtp(email) })
    .expect(200);
  return { email, password: (body.password as string) ?? PASSWORD };
}

/** Login y devuelve el cuerpo (tokens + user). */
export async function login(
  app: NestExpressApplication,
  email: string,
  password: string,
  rememberMe = false,
): Promise<{ accessToken: string; refreshToken: string; [key: string]: unknown }> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('X-Forwarded-For', randomIp())
    .send({ email, password, rememberMe })
    .expect(200);
  return res.body as { accessToken: string; refreshToken: string };
}
