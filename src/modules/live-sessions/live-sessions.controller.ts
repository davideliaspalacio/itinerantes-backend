import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import type { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { uuidOr404 } from '../../common/pipes/uuid-or-404.pipe';
import { ApiErrorResponses } from '../../common/swagger/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../../common/swagger/api-paginated-response.decorator';
import { BEARER_AUTH_NAME } from '../../config/openapi';
import {
  AttendanceResultDto,
  ListSessionsQueryDto,
  RegisterAttendanceRequestDto,
  SessionCardDto,
} from './dto/sessions.dto';
import { LiveSessionsService } from './live-sessions.service';

const SESSION_ID = uuidOr404('La sesión no existe.');

@ApiTags('Sesiones en vivo y asistencia')
@ApiBearerAuth(BEARER_AUTH_NAME)
@Controller('me/sessions')
export class LiveSessionsController {
  constructor(private readonly sessions: LiveSessionsService) {}

  @Get()
  @ApiOperation({
    summary: 'Mis sesiones en vivo',
    description:
      'HU-12: próximas (`scope=UPCOMING`, incluye la que está en curso) o historial (`scope=PAST`) ' +
      'de las formaciones EN LÍNEA con inscripción activa (los talleres presenciales se ven en ' +
      'Calendario y Aula; con `offerId` se listan todas las de esa oferta). Cada sesión trae `join` ' +
      '(el join_url solo con `state = OPEN`, desde 10 min antes; nunca el de anfitrión), ' +
      '`recording` ("Ver grabación" / "Grabación pendiente") y `attendance` (Pendiente / Registrada ' +
      '/ No registrada y ventana de 24 h). Canceladas: `status = CANCELLED`, sin enlace.',
  })
  @ApiPaginatedResponse(SessionCardDto, 'Sesiones paginadas.')
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'ENROLLMENT_REQUIRED',
    'ENROLLMENT_SUSPENDED',
    'NOT_FOUND',
    'RATE_LIMITED',
  )
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListSessionsQueryDto,
  ): Promise<PaginatedResponseDto<SessionCardDto>> {
    return this.sessions.list(user.id, query);
  }

  @Get(':sessionId')
  @ApiOperation({
    summary: 'Detalle de una sesión',
    description:
      'HU-12 / HU-18: datos de la sesión (oferta, módulo, docente, hora UTC → tu hora y CDMX), ' +
      'acceso, grabación y asistencia. Úsalo en la ruta `/portal/asistencia/[sesión]` (enlace de ' +
      'la notificación/correo) y para refrescar el botón al llegar `join.opensAt`. Sin inscripción ' +
      'activa → 403 `ENROLLMENT_REQUIRED` (sin enlaces); sesión inexistente → 404.',
  })
  @ApiParam({ name: 'sessionId', format: 'uuid' })
  @ApiOkResponse({ type: SessionCardDto })
  @ApiErrorResponses(
    'UNAUTHORIZED',
    'NOT_FOUND',
    'ENROLLMENT_REQUIRED',
    'ENROLLMENT_SUSPENDED',
    'RATE_LIMITED',
  )
  detail(
    @CurrentUser() user: AuthUser,
    @Param('sessionId', SESSION_ID) sessionId: string,
  ): Promise<SessionCardDto> {
    return this.sessions.detail(user.id, sessionId);
  }

  @Post(':sessionId/attendance')
  @ApiOperation({
    summary: 'Registrar mi asistencia',
    description:
      'HU-18: "Asistí a la sesión" (`attended: true`, obligatorio) + comentario opcional (máx. 500). ' +
      'Solo dentro de la ventana (abre al terminar la sesión; 24 h por defecto, configurable por ' +
      'oferta/sesión). No editable ni duplicable. Responde la sesión con `attendance.status = ' +
      'REGISTERED` y el progreso recalculado. Errores (todos con `meta.opensAt`, `meta.closesAt`, ' +
      '`meta.registeredAt`): `ATTENDANCE_NOT_OPEN_YET` (422), `ATTENDANCE_WINDOW_CLOSED` (422: "El ' +
      'registro de asistencia para esta sesión está cerrado"; pedir corrección al equipo), ' +
      '`ATTENDANCE_ALREADY_REGISTERED` (409: muestra "Asistencia registrada el …"), ' +
      '`SESSION_CANCELLED` (422), `ENROLLMENT_REQUIRED` (403).',
  })
  @ApiParam({ name: 'sessionId', format: 'uuid' })
  @ApiCreatedResponse({ type: AttendanceResultDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'NOT_FOUND',
    'ENROLLMENT_REQUIRED',
    'ENROLLMENT_SUSPENDED',
    'ATTENDANCE_NOT_OPEN_YET',
    'ATTENDANCE_WINDOW_CLOSED',
    'ATTENDANCE_ALREADY_REGISTERED',
    'SESSION_CANCELLED',
    'RATE_LIMITED',
  )
  registerAttendance(
    @CurrentUser() user: AuthUser,
    @Param('sessionId', SESSION_ID) sessionId: string,
    @Body() dto: RegisterAttendanceRequestDto,
  ): Promise<AttendanceResultDto> {
    return this.sessions.registerAttendance(user.id, sessionId, dto);
  }
}
