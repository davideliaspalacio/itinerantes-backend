import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
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
import { AdminContentService } from './admin-content.service';
import {
  AdminModuleDto,
  AdminModulesDto,
  CreateModuleRequestDto,
  CreateResourceRequestDto,
  ModuleMutationDto,
  ReorderModulesRequestDto,
  ReorderResourcesRequestDto,
  ResourceMutationDto,
  ResourceUploadUrlDto,
  ResourceUploadUrlRequestDto,
  UpdateModuleRequestDto,
  UpdateResourceRequestDto,
} from './dto/admin-content.dto';

const OFFER_ID = uuidOr404('La oferta no existe.');
const MODULE_ID = uuidOr404('El módulo no existe.');
const RESOURCE_ID = uuidOr404('El recurso no existe.');
const NOTIFY =
  'Si el elemento queda visible ahora con "Notificar a inscritos", se avisa UNA vez a los inscritos ' +
  'activos (portal + correo, `MATERIAL_PUBLISHED`) y la respuesta trae `notifiedCount` ("Se notificó ' +
  'a [n] inscritos"). Con `publishAt` futuro, el aviso sale al llegar la fecha (job).';

@ApiTags('Admin – Contenido del aula')
@ApiBearerAuth(BEARER_AUTH_NAME)
@Controller('admin')
export class AdminContentController {
  constructor(private readonly content: AdminContentService) {}

  @Get('offers/:id/modules')
  @RequirePermissions(Permission.OFFERS_READ)
  @ApiOperation({
    summary: 'Módulos y recursos de una oferta',
    description:
      'HU-28: lista reordenable con insignia Publicado/Oculto y, por módulo, las 4 secciones fijas: ' +
      'Presentación, Lecturas previas, Actividades y Grabación (una fila por sesión; `pending` = ya ' +
      'se realizó sin enlace → resaltar "Grabación pendiente"). Incluye ocultos. Permiso `offers.read`.',
  })
  @ApiOkResponse({ type: AdminModulesDto })
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  list(@Param('id', OFFER_ID) id: string): Promise<AdminModulesDto> {
    return this.content.list(id);
  }

  @Post('offers/:id/modules')
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiOperation({
    summary: 'Agregar módulo',
    description:
      'HU-28: se crea al final con el número siguiente, en "Oculto" y con las cuatro secciones vacías. ' +
      'Permiso `offers.write`.',
  })
  @ApiCreatedResponse({ type: ModuleMutationDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  createModule(
    @Param('id', OFFER_ID) id: string,
    @Body() dto: CreateModuleRequestDto,
    @CurrentUser() user: AdminUser,
  ): Promise<ModuleMutationDto> {
    return this.content.createModule(id, dto, user);
  }

  @Put('offers/:id/modules/order')
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiOperation({
    summary: 'Reordenar módulos (arrastrar y soltar)',
    description:
      'HU-28: envía TODOS los módulos en el nuevo orden; la numeración se recalcula. Permiso `offers.write`.',
  })
  @ApiOkResponse({ type: AdminModulesDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  reorderModules(
    @Param('id', OFFER_ID) id: string,
    @Body() dto: ReorderModulesRequestDto,
    @CurrentUser() user: AdminUser,
  ): Promise<AdminModulesDto> {
    return this.content.reorderModules(id, dto, user);
  }

  @Patch('modules/:moduleId')
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiOperation({
    summary: 'Editar / publicar / ocultar un módulo',
    description: `HU-28: título, descripción, docente, visibilidad y publicación programada. ${NOTIFY} Permiso \`offers.write\`.`,
  })
  @ApiOkResponse({ type: ModuleMutationDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  updateModule(
    @Param('moduleId', MODULE_ID) moduleId: string,
    @Body() dto: UpdateModuleRequestDto,
    @CurrentUser() user: AdminUser,
  ): Promise<ModuleMutationDto> {
    return this.content.updateModule(moduleId, dto, user);
  }

  @Delete('modules/:moduleId')
  @HttpCode(204)
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiOperation({
    summary: 'Borrar módulo',
    description:
      'Borra el módulo y sus recursos (las sesiones quedan sin módulo). Permiso `offers.write`.',
  })
  @ApiNoContentResponse()
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  async deleteModule(
    @Param('moduleId', MODULE_ID) moduleId: string,
    @CurrentUser() user: AdminUser,
  ): Promise<void> {
    await this.content.deleteModule(moduleId, user);
  }

  @Post('modules/:moduleId/resources/upload-url')
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiOperation({
    summary: 'URL firmada para subir el archivo de un recurso',
    description:
      'HU-28: Presentación PDF/PPTX; Lecturas PDF/DOCX/EPUB; Actividades cualquiera de esos; máx. ' +
      '50 MB (si no → 422 `ADMIN_UPLOAD_INVALID_FILE`, error en ese ítem). PUT del archivo y luego ' +
      'crea o edita el recurso con la `key` (se verifica tipo y tamaño reales). Permiso `offers.write`.',
  })
  @ApiCreatedResponse({ type: ResourceUploadUrlDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'ADMIN_UPLOAD_INVALID_FILE',
  )
  uploadUrl(
    @Param('moduleId', MODULE_ID) moduleId: string,
    @Body() dto: ResourceUploadUrlRequestDto,
  ): Promise<ResourceUploadUrlDto> {
    return this.content.resourceUploadUrl(moduleId, dto);
  }

  @Post('modules/:moduleId/resources')
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiOperation({
    summary: 'Agregar recurso',
    description:
      'HU-28: presentación (una por módulo: la nueva reemplaza a la anterior), lectura previa ' +
      '(archivo, enlace o recurso de la Biblioteca) o actividad (fecha dentro del periodo de la ' +
      `oferta). Oculto por defecto. ${NOTIFY} Permiso \`offers.write\`.`,
  })
  @ApiCreatedResponse({ type: ResourceMutationDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'ADMIN_UPLOAD_NOT_FOUND',
    'ADMIN_UPLOAD_INVALID_FILE',
  )
  createResource(
    @Param('moduleId', MODULE_ID) moduleId: string,
    @Body() dto: CreateResourceRequestDto,
    @CurrentUser() user: AdminUser,
  ): Promise<ResourceMutationDto> {
    return this.content.createResource(moduleId, dto, user);
  }

  @Put('modules/:moduleId/resources/order')
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiOperation({
    summary: 'Reordenar recursos del módulo',
    description: 'HU-28. Permiso `offers.write`.',
  })
  @ApiOkResponse({ type: AdminModuleDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  reorderResources(
    @Param('moduleId', MODULE_ID) moduleId: string,
    @Body() dto: ReorderResourcesRequestDto,
    @CurrentUser() user: AdminUser,
  ): Promise<AdminModuleDto> {
    return this.content.reorderResources(moduleId, dto, user);
  }

  @Patch('resources/:resourceId')
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiOperation({
    summary: 'Editar / publicar / ocultar un recurso',
    description:
      'HU-28: para cambiar la fuente envía uno de `fileKey` / `url` / `libraryResourceId` (los otros ' +
      `se limpian). ${NOTIFY} Permiso \`offers.write\`.`,
  })
  @ApiOkResponse({ type: ResourceMutationDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'ADMIN_UPLOAD_NOT_FOUND',
    'ADMIN_UPLOAD_INVALID_FILE',
  )
  updateResource(
    @Param('resourceId', RESOURCE_ID) resourceId: string,
    @Body() dto: UpdateResourceRequestDto,
    @CurrentUser() user: AdminUser,
  ): Promise<ResourceMutationDto> {
    return this.content.updateResource(resourceId, dto, user);
  }

  @Delete('resources/:resourceId')
  @HttpCode(204)
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiOperation({ summary: 'Borrar recurso', description: 'HU-28. Permiso `offers.write`.' })
  @ApiNoContentResponse()
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  async deleteResource(
    @Param('resourceId', RESOURCE_ID) resourceId: string,
    @CurrentUser() user: AdminUser,
  ): Promise<void> {
    await this.content.deleteResource(resourceId, user);
  }
}
