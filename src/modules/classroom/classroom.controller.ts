import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import type { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { uuidOr404 } from '../../common/pipes/uuid-or-404.pipe';
import { ApiErrorResponses } from '../../common/swagger/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../../common/swagger/api-paginated-response.decorator';
import { BEARER_AUTH_NAME } from '../../config/openapi';
import { AccessUrlDto } from '../enrollments/dto/portal-shared.dto';
import { ListSessionsQueryDto, SessionCardDto } from '../live-sessions/dto/sessions.dto';
import { ClassroomService } from './classroom.service';
import {
  ClassroomDto,
  ConfirmFinalProjectRequestDto,
  FinalProjectDto,
  FinalProjectUploadRequestDto,
  MaterialsDto,
  UploadUrlDto,
} from './dto/classroom.dto';

const OFFER_ID = uuidOr404('La formación no existe.');
const ACCESS_ERRORS = [
  'UNAUTHORIZED',
  'NOT_FOUND',
  'ENROLLMENT_REQUIRED',
  'ENROLLMENT_SUSPENDED',
  'RATE_LIMITED',
] as const;
const ACCESS_NOTE =
  ' Sin inscripción activa → 403 `ENROLLMENT_REQUIRED` (`meta.offerSlug` para ofrecer la ficha; ' +
  'nunca se exponen enlaces); acceso suspendido por mora → 403 `ENROLLMENT_SUSPENDED`; oferta ' +
  'inexistente → 404.';

@ApiTags('Aula')
@ApiBearerAuth(BEARER_AUTH_NAME)
@ApiParam({
  name: 'offerId',
  format: 'uuid',
  description: '`offer.id` de la tarjeta de Mi formación.',
})
@Controller('me/classrooms/:offerId')
export class ClassroomController {
  constructor(private readonly classroom: ClassroomService) {}

  @Get()
  @ApiOperation({
    summary: 'Aula de mi formación',
    description:
      'HU-17 (destino de [Continuar]): encabezado (portada, nombre, docentes, "Ver ficha" con ' +
      '`offer.slug`), progreso (asistidas ÷ programadas sin canceladas), "Antes de empezar" + grupo ' +
      'de WhatsApp (solo inscritos, desde la fecha del equipo), próxima sesión ([Entrar a sesión] 10 ' +
      'min antes; presencial: lugar y "Cómo llegar"), módulos con estado Próximo/En curso/Completado ' +
      'y "Proyecto final" (solo diplomados). Bloques que fallen por separado: materiales ' +
      '(`/materials`) y sesiones (`/sessions`) tienen endpoint propio para reintentar.' +
      ACCESS_NOTE,
  })
  @ApiOkResponse({ type: ClassroomDto })
  @ApiErrorResponses(...ACCESS_ERRORS)
  get(
    @CurrentUser() user: AuthUser,
    @Param('offerId', OFFER_ID) offerId: string,
  ): Promise<ClassroomDto> {
    return this.classroom.classroom(user.id, offerId);
  }

  @Get('materials')
  @ApiOperation({
    summary: 'Materiales del curso',
    description:
      'HU-08: módulos PUBLICADOS (ocultos o programados a futuro nunca aparecen) con sus cuatro ' +
      'grupos en orden: Presentación del módulo, Lecturas previas, Actividades y Grabación de la ' +
      'sesión (una por sesión: "Ver grabación", "Disponible después de la sesión" o "Grabación ' +
      'pendiente"). Los archivos NO traen URL: pide una temporal con `…/resources/{id}/access`.' +
      ACCESS_NOTE,
  })
  @ApiOkResponse({ type: MaterialsDto })
  @ApiErrorResponses(...ACCESS_ERRORS)
  materials(
    @CurrentUser() user: AuthUser,
    @Param('offerId', OFFER_ID) offerId: string,
  ): Promise<MaterialsDto> {
    return this.classroom.materials(user.id, offerId);
  }

  @Get('resources/:resourceId/access')
  @ApiOperation({
    summary: 'Abrir / descargar un recurso',
    description:
      'HU-08 [Descargar]/[Ver]: archivo → URL firmada temporal (`expiresAt`, ~10 min; si vence, ' +
      'vuelve a llamar); enlace externo → la URL (abrir en pestaña nueva). Recurso oculto, ' +
      'programado o de otra oferta → 404 `NOT_FOUND`. Sin archivo ni enlace → 404 ' +
      '`RESOURCE_FILE_UNAVAILABLE`.' +
      ACCESS_NOTE,
  })
  @ApiParam({ name: 'resourceId', format: 'uuid' })
  @ApiOkResponse({ type: AccessUrlDto })
  @ApiErrorResponses(...ACCESS_ERRORS, 'RESOURCE_FILE_UNAVAILABLE')
  resourceAccess(
    @CurrentUser() user: AuthUser,
    @Param('offerId', OFFER_ID) offerId: string,
    @Param('resourceId', uuidOr404('El recurso no existe.')) resourceId: string,
  ): Promise<AccessUrlDto> {
    return this.classroom.resourceAccess(user.id, offerId, resourceId);
  }

  @Get('sessions')
  @ApiOperation({
    summary: 'Sesiones del aula',
    description:
      'HU-17 "Sesiones pasadas" (`scope=PAST`: fecha, módulo, [Ver grabación] o "Grabación ' +
      'pendiente" y asistencia Pendiente/Registrada/No registrada) y próximas (`scope=UPCOMING`). ' +
      'Incluye talleres presenciales (registro de asistencia con el mismo formulario).' +
      ACCESS_NOTE,
  })
  @ApiPaginatedResponse(SessionCardDto, 'Sesiones paginadas.')
  @ApiErrorResponses('VALIDATION_ERROR', ...ACCESS_ERRORS)
  sessions(
    @CurrentUser() user: AuthUser,
    @Param('offerId', OFFER_ID) offerId: string,
    @Query() query: ListSessionsQueryDto,
  ): Promise<PaginatedResponseDto<SessionCardDto>> {
    return this.classroom.sessionsOf(user.id, offerId, query);
  }

  @Post('final-project/upload-url')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Proyecto final: pedir URL de carga',
    description:
      'HU-17 paso 1/3: valida tipo (PDF, DOCX, PPTX o ZIP) y tamaño (≤ 20 MB) declarados y devuelve ' +
      'una URL firmada para `PUT` directo a storage con el header `Content-Type` indicado. Paso 2: ' +
      '`PUT uploadUrl` con el archivo. Paso 3: `PUT …/final-project { key }`. Solo diplomados con ' +
      'entrega habilitada y antes de la fecha límite.' +
      ACCESS_NOTE,
  })
  @ApiOkResponse({ type: UploadUrlDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    ...ACCESS_ERRORS,
    'FINAL_PROJECT_NOT_AVAILABLE',
    'FINAL_PROJECT_DEADLINE_PASSED',
    'FINAL_PROJECT_INVALID_FILE',
  )
  finalProjectUploadUrl(
    @CurrentUser() user: AuthUser,
    @Param('offerId', OFFER_ID) offerId: string,
    @Body() dto: FinalProjectUploadRequestDto,
  ): Promise<UploadUrlDto> {
    return this.classroom.finalProjectUploadUrl(user.id, offerId, dto);
  }

  @Put('final-project')
  @ApiOperation({
    summary: 'Proyecto final: confirmar entrega',
    description:
      'HU-17 paso 3/3: confirma el archivo subido (`key` del paso 1). El backend verifica en storage ' +
      'que exista, su tipo real y tamaño. Reemplaza la entrega anterior (reemplazable hasta la fecha ' +
      'límite). `FINAL_PROJECT_UPLOAD_NOT_FOUND` → vuelve a subirlo.' +
      ACCESS_NOTE,
  })
  @ApiOkResponse({ type: FinalProjectDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    ...ACCESS_ERRORS,
    'FINAL_PROJECT_NOT_AVAILABLE',
    'FINAL_PROJECT_DEADLINE_PASSED',
    'FINAL_PROJECT_INVALID_FILE',
    'FINAL_PROJECT_UPLOAD_NOT_FOUND',
  )
  confirmFinalProject(
    @CurrentUser() user: AuthUser,
    @Param('offerId', OFFER_ID) offerId: string,
    @Body() dto: ConfirmFinalProjectRequestDto,
  ): Promise<FinalProjectDto> {
    return this.classroom.confirmFinalProject(user.id, offerId, dto);
  }

  @Get('final-project/download')
  @ApiOperation({
    summary: 'Proyecto final: descargar mi entrega',
    description:
      'HU-17: URL firmada temporal de mi archivo entregado (404 si no hay entrega).' + ACCESS_NOTE,
  })
  @ApiOkResponse({ type: AccessUrlDto })
  @ApiErrorResponses(...ACCESS_ERRORS)
  finalProjectDownload(
    @CurrentUser() user: AuthUser,
    @Param('offerId', OFFER_ID) offerId: string,
  ): Promise<AccessUrlDto> {
    return this.classroom.finalProjectDownload(user.id, offerId);
  }
}
