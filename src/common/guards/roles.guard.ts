import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../../generated/prisma/client';
import type { AuthUser } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AppException } from '../errors/app.exception';

/**
 * Guard global (APP_GUARD, después de JwtAuthGuard): si el endpoint tiene @Roles(...), el usuario
 * debe tener al menos uno de esos roles; si no → 403 FORBIDDEN.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, targets)) return true;

    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user) throw new AppException('UNAUTHORIZED');
    if (!hasAnyRole(user.roles, required)) throw new AppException('FORBIDDEN');
    return true;
  }
}

export function hasAnyRole(userRoles: readonly Role[], required: readonly Role[]): boolean {
  return required.some((role) => userRoles.includes(role));
}
