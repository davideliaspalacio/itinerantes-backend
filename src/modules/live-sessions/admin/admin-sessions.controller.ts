import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import type { AdminUser } from '../../../common/guards/permissions.guard';
import { uuidOr404 } from '../../../common/pipes/uuid-or-404.pipe';
import { ApiErrorResponses } from '../../../common/swagger/api-error-responses.decorator';
import { BEARER_AUTH_NAME } from '../../../config/openapi';
import { Permission } from '../../../config/permissions';
import { AdminSessionsService } from './admin-sessions.service';
import {
  AdminSessionDto,
  AdminSessionListDto,
  CancelSessionRequestDto,
  CreateSessionRequestDto,
  GenerateSessionsRequestDto,
  GenerateSessionsResultDto,
  RescheduleSessionRequestDto,
  SessionChangeResultDto,
  SessionPreviewDto,
  UpdateSessionRequestDto,
} from './dto/admin-sessions.dto';

const OFFER_ID = uuidOr404('La oferta no existe.');
const SESSION_ID = uuidOr404('La sesión no existe.');
const NOTIFY =
  ' Avisa a los inscritos con acceso (portal + correo) con la hora en la zona de cada persona y la ' +
  'hora CDMX; `notifiedCount` = personas notificadas.';

@ApiTags('Admin – Sesiones')
@ApiBearerAuth(BEARER_AUTH_NAME)
@Controller('admin')
export class AdminSessionsController {
  constructor(private readonly sessions: AdminSessionsService) {}

  @Get('offers/:id/sessions')
  @RequirePermissions(Permission.OFFERS_READ)
  @ApiParam({ name: 'id', format: 'uuid', description: 'Oferta.' })
  @ApiOperation({
    summary: 'Sesiones de una oferta (panel)',
    description:
      'HU-29: todas las sesiones (también canceladas) en orden, con enlace de anfitrión (`hostUrl`, ' +
      'solo panel), de participante y grabación, módulo, estado del registro de asistencia (chip ' +
      'HU-30), banderas para los íconos (editada, cancelada, sin enlace, grabación pendiente) y ' +
      'conteo de asistencia. Permiso `offers.read`.',
  })
  @ApiOkResponse({ type: AdminSessionListDto })
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  async list(@Param('id', OFFER_ID) id: string): Promise<AdminSessionListDto> {
    return { data: await this.sessions.list(id) };
  }

  @Post('offers/:id/sessions/preview')
  @HttpCode(200)
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiParam({ name: 'id', format: 'uuid', description: 'Oferta.' })
  @ApiOperation({
    summary: 'Vista previa de la generación de sesiones',
    description:
      'HU-29 pasos Regla → Excepciones → Vista previa (sin guardar nada). Usa la regla enviada o la ' +
      'de la oferta, recorre el rango (fechas CDMX dentro del periodo de la oferta), omite fechas ' +
      'excluidas y festivos de México sin reprogramar (`EXCLUDED`), marca `CONFLICT` lo que se ' +
      'traslapa con sesiones existentes (también canceladas) y reparte módulos. `canConfirm` = false ' +
      'con conflictos, sin sesiones o con curso > 9 h (texto en `blockedReason`); diplomado ≠ 60 h ' +
      'es solo advertencia (`warnings`). Incluye las fechas importantes elegidas. Permiso ' +
      '`offers.write`.',
  })
  @ApiOkResponse({ type: SessionPreviewDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  preview(
    @Param('id', OFFER_ID) id: string,
    @Body() dto: GenerateSessionsRequestDto,
  ): Promise<SessionPreviewDto> {
    return this.sessions.preview(id, dto);
  }

  @Post('offers/:id/sessions/generate')
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiParam({ name: 'id', format: 'uuid', description: 'Oferta.' })
  @ApiOperation({
    summary: '"Crear sesiones" (confirmar la vista previa)',
    description:
      'HU-29: mismo cuerpo que la vista previa; recalcula y, si se puede confirmar, crea TODAS las ' +
      'sesiones en una transacción (nunca parcial) con la categoría de la oferta, el enlace ' +
      'recurrente y su módulo; guarda la regla en la oferta si se envió y crea/actualiza las fechas ' +
      'importantes elegidas. Cada sesión nace con su registro de asistencia (HU-30). Bloqueada → 422 ' +
      '`SESSION_GENERATION_BLOCKED` (`meta.conflictCount`, `meta.violations`, `meta.blockedReason`). ' +
      'Permiso `offers.write`.',
  })
  @ApiCreatedResponse({ type: GenerateSessionsResultDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'SESSION_GENERATION_BLOCKED',
    'SESSION_CONFLICT',
  )
  generate(
    @Param('id', OFFER_ID) id: string,
    @Body() dto: GenerateSessionsRequestDto,
    @CurrentUser() user: AdminUser,
  ): Promise<GenerateSessionsResultDto> {
    return this.sessions.generate(id, dto, user);
  }

  @Post('offers/:id/sessions')
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiParam({ name: 'id', format: 'uuid', description: 'Oferta.' })
  @ApiOperation({
    summary: 'Crear una sesión manual',
    description:
      'HU-29: sesión suelta (fuera de la regla). Enlaces solo en línea y de zoom.us o ' +
      'meet.google.com (`details[].code` INVALID_MEETING_URL / NOT_APPLICABLE). Traslape con otra ' +
      'sesión programada → 409 `SESSION_CONFLICT`. Permiso `offers.write`.',
  })
  @ApiCreatedResponse({ type: AdminSessionDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'SESSION_CONFLICT',
  )
  create(
    @Param('id', OFFER_ID) id: string,
    @Body() dto: CreateSessionRequestDto,
    @CurrentUser() user: AdminUser,
  ): Promise<AdminSessionDto> {
    return this.sessions.create(id, dto, user);
  }

  @Get('sessions/:id')
  @RequirePermissions(Permission.OFFERS_READ)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Detalle de una sesión (panel)',
    description: 'HU-29. Permiso `offers.read`.',
  })
  @ApiOkResponse({ type: AdminSessionDto })
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  get(@Param('id', SESSION_ID) id: string): Promise<AdminSessionDto> {
    return this.sessions.get(id);
  }

  @Patch('sessions/:id')
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Editar enlaces, módulo, categoría, ventana o grabación de una sesión',
    description:
      'HU-29 (enlace por sesión, color) y HU-28 ("pego y publico su link de grabación"). No cambia ' +
      'el horario (usa reprogramar). `null` quita un valor. Al poner o cambiar `recordingUrl` se ' +
      'publica la grabación y, con `notifyRecording` (por defecto true), se avisa RECORDING_PUBLISHED ' +
      'a los inscritos una sola vez por sesión (`notifiedCount`). Permiso `offers.write`.',
  })
  @ApiOkResponse({ type: SessionChangeResultDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  update(
    @Param('id', SESSION_ID) id: string,
    @Body() dto: UpdateSessionRequestDto,
    @CurrentUser() user: AdminUser,
  ): Promise<SessionChangeResultDto> {
    return this.sessions.update(id, dto, user);
  }

  @Post('sessions/:id/reschedule')
  @HttpCode(200)
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Reprogramar una sesión (con motivo)',
    description:
      'HU-29: solo cambia esa sesión; guarda la hora original y el motivo (ícono "editada").' +
      NOTIFY +
      ' Cancelada → 422 `SESSION_CANCELLED`; traslape → 409 `SESSION_CONFLICT`. Permiso `offers.write`.',
  })
  @ApiOkResponse({ type: SessionChangeResultDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'SESSION_CANCELLED',
    'SESSION_CONFLICT',
  )
  reschedule(
    @Param('id', SESSION_ID) id: string,
    @Body() dto: RescheduleSessionRequestDto,
    @CurrentUser() user: AdminUser,
  ): Promise<SessionChangeResultDto> {
    return this.sessions.reschedule(id, dto, user);
  }

  @Post('sessions/:id/cancel')
  @HttpCode(200)
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Cancelar una sesión (con motivo)',
    description:
      'HU-29/HU-30: queda "Cancelada" (visible en el calendario, sin enlace ni registro de ' +
      'asistencia; no cuenta para el % de nadie).' +
      NOTIFY +
      ' Ya cancelada → 422 `SESSION_CANCELLED`. Permiso `offers.write`.',
  })
  @ApiOkResponse({ type: SessionChangeResultDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'SESSION_CANCELLED',
  )
  cancel(
    @Param('id', SESSION_ID) id: string,
    @Body() dto: CancelSessionRequestDto,
    @CurrentUser() user: AdminUser,
  ): Promise<SessionChangeResultDto> {
    return this.sessions.cancel(id, dto, user);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Borrar una sesión sin asistencias',
    description:
      'Para corregir una generación (y volver a generar). Con registros de asistencia → 409 ' +
      '`SESSION_HAS_ATTENDANCE` (cancélala). No avisa a nadie. Permiso `offers.write`.',
  })
  @ApiNoContentResponse({ description: 'Borrada.' })
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'SESSION_HAS_ATTENDANCE')
  remove(@Param('id', SESSION_ID) id: string, @CurrentUser() user: AdminUser): Promise<void> {
    return this.sessions.remove(id, user);
  }
}
