import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../generated/prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Roles permitidos para un endpoint (el usuario necesita AL MENOS uno). Lo aplica el RolesGuard
 * global. Sin @Roles basta con estar autenticado.
 *
 * @example @Roles(Role.SUPER_ADMIN, Role.FINANCE)
 */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
