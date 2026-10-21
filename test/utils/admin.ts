import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Role } from '../../src/generated/prisma/client';
import { PrismaService } from '../../src/infra/prisma/prisma.service';
import { createVerifiedUser, login } from './identity';
import type { MailCapture } from './mail-capture';

export interface TestUser {
  token: string;
  id: string;
  email: string;
}

/**
 * Crea una cuenta verificada con los roles dados (Fase 06) y devuelve su token. El
 * `PermissionsGuard` lee los roles de la BD en cada petición, así que el token sirve aunque se
 * cambien los roles después.
 */
export async function createStaffUser(
  app: NestExpressApplication,
  mail: MailCapture,
  roles: Role[],
  overrides: Record<string, unknown> = {},
): Promise<TestUser> {
  const prisma = app.get(PrismaService);
  const { email, password } = await createVerifiedUser(app, mail, overrides);
  const user = await prisma.user.update({
    where: { email },
    data: { roles: ['PARTICIPANT', ...roles.filter((r) => r !== 'PARTICIPANT')] },
  });
  const body = await login(app, email, password);
  return { token: body.accessToken, id: user.id, email };
}

/** Participante verificado (sin roles del equipo). */
export async function createParticipant(
  app: NestExpressApplication,
  mail: MailCapture,
  overrides: Record<string, unknown> = {},
): Promise<TestUser> {
  return createStaffUser(app, mail, [], overrides);
}
