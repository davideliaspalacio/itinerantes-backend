import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import type { AdminUser } from '../../../common/guards/permissions.guard';
import { uuidOr404 } from '../../../common/pipes/uuid-or-404.pipe';
import { ApiErrorResponses } from '../../../common/swagger/api-error-responses.decorator';
import { BEARER_AUTH_NAME } from '../../../config/openapi';
import { Permission } from '../../../config/permissions';
import {
  AdminScholarshipTypeDto,
  AdminScholarshipTypesResponseDto,
  CreateScholarshipTypeRequestDto,
  UpdateScholarshipTypeRequestDto,
} from '../dto/scholarship-types.dto';
import { ScholarshipTypesService } from '../scholarship-types.service';

const TYPE_ID = uuidOr404('El tipo de beca no existe.');

@ApiTags('Admin – Tipos de beca')
@ApiBearerAuth(BEARER_AUTH_NAME)
@Controller('admin/scholarship-types')
export class AdminScholarshipTypesController {
  constructor(private readonly types: ScholarshipTypesService) {}

  @Get()
  @RequirePermissions(Permission.OFFERS_READ)
  @ApiOperation({
    summary: 'Tipos de beca (incluye inactivos)',
    description:
      'HU-27/31: catálogo para el asistente de ofertas (paso 4), el filtro de postulaciones y la ' +
      'pantalla de administración. Incluye inactivos y `usage` (ofertas, postulaciones y ' +
      'evaluaciones que lo usan). Permiso `offers.read` (todo el equipo).',
  })
  @ApiOkResponse({ type: AdminScholarshipTypesResponseDto })
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN')
  list(): Promise<AdminScholarshipTypesResponseDto> {
    return this.types.listAdmin();
  }

  @Post()
  @RequirePermissions(Permission.SCHOLARSHIP_TYPES_WRITE)
  @ApiOperation({
    summary: 'Crear tipo de beca',
    description:
      '`key` MAYÚSCULAS_CON_GUION_BAJO, única e inmutable. Rango 1 ≤ minPercent ≤ maxPercent ≤ 100 ' +
      '(fijo si son iguales). Queda en la auditoría (`scholarship_type.create`). Permiso ' +
      '`scholarship_types.write` (SUPER_ADMIN).',
  })
  @ApiCreatedResponse({ type: AdminScholarshipTypeDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'SCHOLARSHIP_TYPE_KEY_TAKEN',
    'SCHOLARSHIP_TYPE_INVALID_RANGE',
  )
  create(
    @Body() dto: CreateScholarshipTypeRequestDto,
    @CurrentUser() user: AdminUser,
  ): Promise<AdminScholarshipTypeDto> {
    return this.types.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions(Permission.SCHOLARSHIP_TYPES_WRITE)
  @ApiOperation({
    summary: 'Editar tipo de beca',
    description:
      'Nombre, descripción, rango, entrevista, orden y `active`. `key` NO es editable (400 ' +
      '`UNKNOWN_FIELD`). Desactivar lo deja de ofrecer en ofertas y postulaciones nuevas; lo ya ' +
      'asignado se conserva (el nombre asignado queda guardado en la postulación). Cambiar el rango ' +
      'afecta a las ofertas que no lo sobrescriben. Auditoría `scholarship_type.update`. Permiso ' +
      '`scholarship_types.write` (SUPER_ADMIN).',
  })
  @ApiOkResponse({ type: AdminScholarshipTypeDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'SCHOLARSHIP_TYPE_INVALID_RANGE',
  )
  update(
    @Param('id', TYPE_ID) id: string,
    @Body() dto: UpdateScholarshipTypeRequestDto,
    @CurrentUser() user: AdminUser,
  ): Promise<AdminScholarshipTypeDto> {
    return this.types.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.SCHOLARSHIP_TYPES_WRITE)
  @ApiOperation({
    summary: 'Borrar tipo de beca',
    description:
      'Solo si ninguna oferta, postulación ni evaluación lo usa; si no → 409 ' +
      '`SCHOLARSHIP_TYPE_IN_USE` (`meta.usage`): desactívalo en su lugar. Auditoría ' +
      '`scholarship_type.delete`. Permiso `scholarship_types.write` (SUPER_ADMIN).',
  })
  @ApiNoContentResponse()
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'SCHOLARSHIP_TYPE_IN_USE')
  async remove(@Param('id', TYPE_ID) id: string, @CurrentUser() user: AdminUser): Promise<void> {
    await this.types.remove(id, user);
  }
}
