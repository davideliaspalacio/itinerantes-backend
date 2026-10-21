import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { missingPermissions, type Permission, permissionsForRoles } from '../../config/permissions';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { AuthUser } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { AppException } from '../errors/app.exception';

/** Usuario del panel: `AuthUser` con roles frescos de la BD y sus permisos efectivos. */
export interface AdminUser extends AuthUser {
  permissions: Permission[];
}

/**
 * Guard global (APP_GUARD, después de RolesGuard): si el endpoint tiene `@RequirePermissions(...)`,
 * consulta los roles y el estado ACTUALES del usuario (no los del token: así un rol retirado o una
 * cuenta deshabilitada pierden el acceso al instante) y exige todos los permisos.
 * Deja en `request.user` los roles frescos y `permissions` (ver `AdminUser`).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, targets)) return true;
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(
      PERMISSIONS_KEY,
      targets,
    );
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthUser | AdminUser }>();
    const user = request.user;
    if (!user) throw new AppException('UNAUTHORIZED');
    const fresh = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { roles: true, status: true },
    });
    if (!fresh || fresh.status !== 'ACTIVE') throw new AppException('FORBIDDEN');
    const missing = missingPermissions(fresh.roles, required);
    if (missing.length > 0) {
      throw new AppException('FORBIDDEN', { meta: { missingPermissions: missing } });
    }
    request.user = { ...user, roles: fresh.roles, permissions: permissionsForRoles(fresh.roles) };
    return true;
  }
}
