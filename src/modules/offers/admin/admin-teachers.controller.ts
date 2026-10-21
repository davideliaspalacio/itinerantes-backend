import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
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
import type { PaginatedResponseDto } from '../../../common/dto/pagination.dto';
import type { AdminUser } from '../../../common/guards/permissions.guard';
import { uuidOr404 } from '../../../common/pipes/uuid-or-404.pipe';
import { ApiErrorResponses } from '../../../common/swagger/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../../../common/swagger/api-paginated-response.decorator';
import { BEARER_AUTH_NAME } from '../../../config/openapi';
import { Permission } from '../../../config/permissions';
import { AdminTeachersService } from './admin-teachers.service';
import {
  AdminTeacherDto,
  CreateTeacherRequestDto,
  ListTeachersQueryDto,
  UpdateTeacherRequestDto,
} from './dto/admin-teachers.dto';

const TEACHER_ID = uuidOr404('El docente no existe.');

@ApiTags('Admin – Docentes')
@ApiBearerAuth(BEARER_AUTH_NAME)
@Controller('admin/teachers')
export class AdminTeachersController {
  constructor(private readonly teachers: AdminTeachersService) {}

  @Get()
  @RequirePermissions(Permission.OFFERS_READ)
  @ApiOperation({
    summary: 'Docentes',
    description:
      'HU-27: selector de docentes del paso 1 (orden alfabético, búsqueda). Permiso `offers.read`.',
  })
  @ApiPaginatedResponse(AdminTeacherDto)
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN')
  list(@Query() query: ListTeachersQueryDto): Promise<PaginatedResponseDto<AdminTeacherDto>> {
    return this.teachers.list(query);
  }

  @Post()
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiOperation({
    summary: 'Registrar docente',
    description:
      'HU-27: nombre, semblanza, CV (enlace https) y foto (key de `POST /admin/uploads/images` con ' +
      '`TEACHER_PHOTO`, verificada en storage). Permiso `offers.write`.',
  })
  @ApiCreatedResponse({ type: AdminTeacherDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'ADMIN_UPLOAD_NOT_FOUND',
    'ADMIN_UPLOAD_INVALID_FILE',
  )
  create(
    @Body() dto: CreateTeacherRequestDto,
    @CurrentUser() user: AdminUser,
  ): Promise<AdminTeacherDto> {
    return this.teachers.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiOperation({ summary: 'Editar docente', description: 'HU-27. Permiso `offers.write`.' })
  @ApiOkResponse({ type: AdminTeacherDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'ADMIN_UPLOAD_NOT_FOUND',
    'ADMIN_UPLOAD_INVALID_FILE',
  )
  update(
    @Param('id', TEACHER_ID) id: string,
    @Body() dto: UpdateTeacherRequestDto,
    @CurrentUser() user: AdminUser,
  ): Promise<AdminTeacherDto> {
    return this.teachers.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiOperation({
    summary: 'Borrar docente',
    description:
      'Solo si no está en ninguna oferta ni módulo (si no → 409 `TEACHER_IN_USE`). Permiso `offers.write`.',
  })
  @ApiNoContentResponse()
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'TEACHER_IN_USE')
  async remove(@Param('id', TEACHER_ID) id: string, @CurrentUser() user: AdminUser): Promise<void> {
    await this.teachers.remove(id, user);
  }
}
