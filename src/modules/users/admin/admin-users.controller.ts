import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import type { PaginatedResponseDto } from '../../../common/dto/pagination.dto';
import type { AdminUser } from '../../../common/guards/permissions.guard';
import { uuidOr404 } from '../../../common/pipes/uuid-or-404.pipe';
import { ApiErrorResponses } from '../../../common/swagger/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../../../common/swagger/api-paginated-response.decorator';
import { BEARER_AUTH_NAME } from '../../../config/openapi';
import { Permission } from '../../../config/permissions';
import { AdminUsersService } from './admin-users.service';
import {
  AdminMeDto,
  AdminUserDto,
  ListAdminUsersQueryDto,
  RolesCatalogDto,
  UpdateUserRolesRequestDto,
  UserStatusChangeRequestDto,
} from './dto/admin-users.dto';

const USER_ID = uuidOr404('La cuenta no existe.');

@ApiTags('Admin – Equipo y permisos')
@ApiBearerAuth(BEARER_AUTH_NAME)
@Controller('admin')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get('me')
  @RequirePermissions(Permission.ADMIN_ACCESS)
  @ApiOperation({
    summary: 'Mi acceso al panel (roles y permisos)',
    description:
      'Fase 06 (HU-27 a HU-33: "un usuario sin rol administrativo… el sistema le niega el acceso"). ' +
      'Llámalo al entrar al panel: con `403 FORBIDDEN` la persona no es del equipo (redirige al ' +
      'portal); si no, usa `permissions` para mostrar secciones y botones (p. ej. sin ' +
      '`payments.manage` la pestaña Pagos es solo lectura, sin `applications.decide` no aparece ' +
      '"Registrar decisión"). Los roles se leen de la BD en cada petición: un cambio de rol aplica ' +
      'de inmediato. Permiso `admin.access` (cualquier rol del equipo).',
  })
  @ApiOkResponse({ type: AdminMeDto })
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN')
  me(@CurrentUser() user: AdminUser): Promise<AdminMeDto> {
    return this.users.me(user);
  }

  @Get('roles')
  @RequirePermissions(Permission.ADMIN_ACCESS)
  @ApiOperation({
    summary: 'Catálogo de roles y sus permisos',
    description:
      'Matriz rol → permisos (fuente: `src/config/permissions.ts`) con el texto de cada rol, para la ' +
      'pantalla de asignación de roles. Permiso `admin.access`.',
  })
  @ApiOkResponse({ type: RolesCatalogDto })
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN')
  roles(): RolesCatalogDto {
    return this.users.roles();
  }

  @Get('users')
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({
    summary: 'Cuentas (buscar personas para darles roles del equipo)',
    description:
      'Fase 06. Busca por nombre, correo o username; `staffOnly=true` lista solo al equipo. Para ' +
      'sumar a alguien al equipo: la persona se registra en el portal (HU-02/03) y aquí se le asignan ' +
      'roles. Permiso `users.manage` (SUPER_ADMIN).',
  })
  @ApiPaginatedResponse(AdminUserDto)
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN')
  list(@Query() query: ListAdminUsersQueryDto): Promise<PaginatedResponseDto<AdminUserDto>> {
    return this.users.list(query);
  }

  @Put('users/:id/roles')
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({
    summary: 'Asignar roles del equipo',
    description:
      'Reemplaza los roles del equipo de la cuenta (`PARTICIPANT` se conserva siempre). Reglas: nadie ' +
      'se quita a sí mismo SUPER_ADMIN (`409 ADMIN_SELF_ACTION`) y siempre queda al menos un ' +
      'SUPER_ADMIN activo (`409 ADMIN_LAST_SUPER_ADMIN`). Efecto inmediato. Queda en auditoría ' +
      '(`user.update-roles`). Permiso `users.manage`.',
  })
  @ApiOkResponse({ type: AdminUserDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'ADMIN_SELF_ACTION',
    'ADMIN_LAST_SUPER_ADMIN',
  )
  updateRoles(
    @CurrentUser() user: AdminUser,
    @Param('id', USER_ID) id: string,
    @Body() body: UpdateUserRolesRequestDto,
  ): Promise<AdminUserDto> {
    return this.users.updateRoles(user, id, body.roles);
  }

  @Post('users/:id/disable')
  @HttpCode(200)
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({
    summary: 'Deshabilitar una cuenta',
    description:
      'La cuenta queda `DISABLED` (login → `403 AUTH_ACCOUNT_DISABLED`), se cierran todas sus ' +
      'sesiones y pierde el acceso al panel de inmediato. No puedes deshabilitarte ' +
      '(`ADMIN_SELF_ACTION`) ni dejar el panel sin SUPER_ADMIN (`ADMIN_LAST_SUPER_ADMIN`). ' +
      'Auditoría `user.disable`. Permiso `users.manage`.',
  })
  @ApiOkResponse({ type: AdminUserDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'ADMIN_SELF_ACTION',
    'ADMIN_LAST_SUPER_ADMIN',
  )
  disable(
    @CurrentUser() user: AdminUser,
    @Param('id', USER_ID) id: string,
    @Body() body: UserStatusChangeRequestDto,
  ): Promise<AdminUserDto> {
    return this.users.disable(user, id, body.reason);
  }

  @Post('users/:id/enable')
  @HttpCode(200)
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({
    summary: 'Volver a habilitar una cuenta',
    description:
      'Vuelve a `ACTIVE` (o `PENDING_VERIFICATION` si nunca verificó su correo). Auditoría ' +
      '`user.enable`. Permiso `users.manage`.',
  })
  @ApiOkResponse({ type: AdminUserDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  enable(
    @CurrentUser() user: AdminUser,
    @Param('id', USER_ID) id: string,
    @Body() body: UserStatusChangeRequestDto,
  ): Promise<AdminUserDto> {
    return this.users.enable(user, id, body.reason);
  }

  @Post('users/:id/verify-email')
  @HttpCode(200)
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({
    summary: 'Marcar el correo de una cuenta como verificado',
    description:
      'HU-03 (soporte): para cuentas del equipo a las que no les llega el código OTP. Deja ' +
      '`emailVerifiedAt` y pasa de `PENDING_VERIFICATION` a `ACTIVE` (una cuenta `DISABLED` sigue ' +
      'deshabilitada). Invalida los códigos pendientes y vincula la formación Moodle como la ' +
      'verificación normal. Ya verificada → `409 AUTH_ALREADY_VERIFIED`. Auditoría ' +
      '`user.verify-email`. Permiso `users.manage`.',
  })
  @ApiOkResponse({ type: AdminUserDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'AUTH_ALREADY_VERIFIED',
  )
  verifyEmail(
    @CurrentUser() user: AdminUser,
    @Param('id', USER_ID) id: string,
    @Body() body: UserStatusChangeRequestDto,
  ): Promise<AdminUserDto> {
    return this.users.verifyEmail(user, id, body.reason);
  }
}
