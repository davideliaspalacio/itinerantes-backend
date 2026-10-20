import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Roles permitidos para un endpoint (el usuario necesita AL MENOS uno). Lo aplica el RolesGuard
 * (Fase 01/06). Cuando exista el enum Prisma `Role`, cambia el tipo de `string` a `Role`.
 *
 * @example @Roles('SUPER_ADMIN', 'FINANCE')
 */
export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
