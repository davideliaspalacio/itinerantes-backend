import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';
import type { Permission } from '../../config/permissions';

export const PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Permisos del panel que exige un endpoint (TODOS). Lo aplica el `PermissionsGuard` global con la
 * matriz de `src/config/permissions.ts`, leyendo los roles ACTUALES del usuario en la BD (un cambio
 * de rol o una cuenta deshabilitada surten efecto de inmediato, sin esperar a que venza el token).
 * Sin permiso → 403 `FORBIDDEN` con `meta.missingPermissions`.
 *
 * En OpenAPI se documenta como `x-required-permissions` en la operación.
 *
 * @example @RequirePermissions(Permission.PAYMENTS_MANAGE)
 */
export const RequirePermissions = (
  ...permissions: Permission[]
): MethodDecorator & ClassDecorator =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    ApiExtension('x-required-permissions', permissions),
  );
