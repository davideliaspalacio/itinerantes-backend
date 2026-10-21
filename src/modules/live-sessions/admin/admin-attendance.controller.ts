import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import type { AdminUser } from '../../../common/guards/permissions.guard';
import { uuidOr404 } from '../../../common/pipes/uuid-or-404.pipe';
import { ApiErrorResponses } from '../../../common/swagger/api-error-responses.decorator';
import { BEARER_AUTH_NAME } from '../../../config/openapi';
import { Permission } from '../../../config/permissions';
import { AdminAttendanceService } from './admin-attendance.service';
import {
  AttendanceSessionChipsDto,
  MarkAttendanceRequestDto,
  MarkAttendanceResultDto,
  ParticipantAttendanceDto,
  ParticipantAttendanceQueryDto,
  RemindAttendanceResultDto,
  SessionAttendanceDto,
  SessionAttendanceQueryDto,
  UnmarkAttendanceResultDto,
} from './dto/admin-attendance.dto';

const OFFER_ID = uuidOr404('La oferta no existe.');
const SESSION_ID = uuidOr404('La sesión no existe.');
const CSV_RESPONSE = {
  description: 'CSV (UTF-8 con BOM, compatible con Excel).',
  content: { 'text/csv': { schema: { type: 'string' as const } } },
};

function csvFile({ fileName, csv }: { fileName: string; csv: string }): StreamableFile {
  const buffer = Buffer.from(csv, 'utf8');
  return new StreamableFile(buffer, {
    type: 'text/csv; charset=utf-8',
    disposition: `attachment; filename="${fileName}"`,
    length: buffer.length,
  });
}

@ApiTags('Admin – Asistencia')
@ApiBearerAuth(BEARER_AUTH_NAME)
@Controller('admin')
export class AdminAttendanceController {
  constructor(private readonly attendance: AdminAttendanceService) {}

  @Get('offers/:id/attendance/sessions')
  @RequirePermissions(Permission.ATTENDANCE_READ)
  @ApiParam({ name: 'id', format: 'uuid', description: 'Oferta.' })
  @ApiOperation({
    summary: 'Chips de sesiones con su estado de registro',
    description:
      'HU-30: por sesión, estado Programada / Registro abierto / Cerrada / Cancelada (el registro ' +
      'abre al terminar y cierra tras la ventana de la sesión u oferta), apertura/cierre y "18 de 25 ' +
      '(72%)". Permiso `attendance.read`.',
  })
  @ApiOkResponse({ type: AttendanceSessionChipsDto })
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  async chips(@Param('id', OFFER_ID) id: string): Promise<AttendanceSessionChipsDto> {
    return { data: await this.attendance.sessionChips(id) };
  }

  @Get('offers/:id/attendance/participants')
  @RequirePermissions(Permission.ATTENDANCE_READ)
  @ApiParam({ name: 'id', format: 'uuid', description: 'Oferta.' })
  @ApiOperation({
    summary: 'Asistencia "Por participante" (% de asistencia)',
    description:
      'HU-30: % = sesiones asistidas ÷ sesiones YA realizadas no canceladas (distinto del Progreso ' +
      'del aula). `belowThreshold` = alerta visual bajo 80%. Inscritos ACTIVE, COMPLETED o SUSPENDED ' +
      '(NAS y Moodle). Filtros `q`, `countryCode`, `belowThreshold`. Permiso `attendance.read`.',
  })
  @ApiOkResponse({ type: ParticipantAttendanceDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  participants(
    @Param('id', OFFER_ID) id: string,
    @Query() query: ParticipantAttendanceQueryDto,
  ): Promise<ParticipantAttendanceDto> {
    return this.attendance.participants(id, query);
  }

  @Get('offers/:id/attendance/export')
  @RequirePermissions(Permission.ATTENDANCE_READ)
  @ApiParam({ name: 'id', format: 'uuid', description: 'Oferta.' })
  @ApiProduces('text/csv')
  @ApiOperation({
    summary: 'Exportar asistencia por participante (CSV)',
    description:
      'HU-30 "Exportar": mismos filtros que "Por participante". Descárgalo con fetch (Bearer) → blob. ' +
      'Permiso `attendance.read`.',
  })
  @ApiOkResponse(CSV_RESPONSE)
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  async exportParticipants(
    @Param('id', OFFER_ID) id: string,
    @Query() query: ParticipantAttendanceQueryDto,
  ): Promise<StreamableFile> {
    return csvFile(await this.attendance.participantsCsv(id, query));
  }

  @Get('sessions/:id/attendance')
  @RequirePermissions(Permission.ATTENDANCE_READ)
  @ApiParam({ name: 'id', format: 'uuid', description: 'Sesión.' })
  @ApiOperation({
    summary: 'Asistencia "Por sesión"',
    description:
      'HU-30: cada inscrito con su estado (Registrada / Pendiente / No registrada; en canceladas ' +
      'NOT_APPLICABLE), fecha, origen (Participante / Manual), comentario, quién la marcó y motivo, ' +
      'más el resumen "18 de 25 registraron asistencia (72%)" (sin filtros). Filtros `status`, ' +
      '`countryCode`, `q`. Sin paginar (una sesión tiene decenas de inscritos). Permiso ' +
      '`attendance.read`.',
  })
  @ApiOkResponse({ type: SessionAttendanceDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  session(
    @Param('id', SESSION_ID) id: string,
    @Query() query: SessionAttendanceQueryDto,
  ): Promise<SessionAttendanceDto> {
    return this.attendance.sessionAttendance(id, query);
  }

  @Get('sessions/:id/attendance/export')
  @RequirePermissions(Permission.ATTENDANCE_READ)
  @ApiParam({ name: 'id', format: 'uuid', description: 'Sesión.' })
  @ApiProduces('text/csv')
  @ApiOperation({
    summary: 'Exportar asistencia de una sesión (CSV)',
    description: 'HU-30 "Exportar": respeta los filtros aplicados. Permiso `attendance.read`.',
  })
  @ApiOkResponse(CSV_RESPONSE)
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  async exportSession(
    @Param('id', SESSION_ID) id: string,
    @Query() query: SessionAttendanceQueryDto,
  ): Promise<StreamableFile> {
    return csvFile(await this.attendance.sessionCsv(id, query));
  }

  @Post('sessions/:id/attendance/mark')
  @HttpCode(200)
  @RequirePermissions(Permission.ATTENDANCE_WRITE)
  @ApiParam({ name: 'id', format: 'uuid', description: 'Sesión.' })
  @ApiOperation({
    summary: 'Marcar asistencia manual / "Pasar lista en sitio"',
    description:
      'HU-30: individual o masiva con motivo obligatorio; queda "Registrada" con origen MANUAL, quién ' +
      'y cuándo, y el % se recalcula. Se permite con la ventana cerrada. Las ya registradas se ' +
      'omiten (`alreadyRegistered`). Sesión cancelada → 422 `SESSION_CANCELLED`; personas sin ' +
      'inscripción vigente → 422 `ATTENDANCE_NOT_ENROLLED` (`meta.userIds`). Permiso ' +
      '`attendance.write`.',
  })
  @ApiOkResponse({ type: MarkAttendanceResultDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'SESSION_CANCELLED',
    'ATTENDANCE_NOT_ENROLLED',
  )
  mark(
    @Param('id', SESSION_ID) id: string,
    @Body() dto: MarkAttendanceRequestDto,
    @CurrentUser() user: AdminUser,
  ): Promise<MarkAttendanceResultDto> {
    return this.attendance.mark(id, dto, user);
  }

  @Post('sessions/:id/attendance/unmark')
  @HttpCode(200)
  @RequirePermissions(Permission.ATTENDANCE_WRITE)
  @ApiParam({ name: 'id', format: 'uuid', description: 'Sesión.' })
  @ApiOperation({
    summary: 'Desmarcar asistencia (corrección con motivo)',
    description:
      'HU-30 / HU-18 ("las correcciones las hace el equipo"): borra el registro (de la persona o ' +
      'manual) con motivo obligatorio; lo borrado queda en la auditoría. Permiso `attendance.write`.',
  })
  @ApiOkResponse({ type: UnmarkAttendanceResultDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  unmark(
    @Param('id', SESSION_ID) id: string,
    @Body() dto: MarkAttendanceRequestDto,
    @CurrentUser() user: AdminUser,
  ): Promise<UnmarkAttendanceResultDto> {
    return this.attendance.unmark(id, dto, user);
  }

  @Post('sessions/:id/attendance/remind')
  @HttpCode(200)
  @RequirePermissions(Permission.ATTENDANCE_WRITE)
  @ApiParam({ name: 'id', format: 'uuid', description: 'Sesión.' })
  @ApiOperation({
    summary: '"Recordar a pendientes"',
    description:
      'HU-30: avisa ATTENDANCE_OPEN (portal + correo) a quienes no han registrado, solo con el ' +
      'registro abierto; máximo un recordatorio por persona por día (`notified` = 0 si ya se envió ' +
      'hoy). Cancelada → 422 `SESSION_CANCELLED`; aún no abre → 422 `ATTENDANCE_NOT_OPEN_YET` ' +
      '(`meta.opensAt`); cerrada → 422 `ATTENDANCE_WINDOW_CLOSED`. Permiso `attendance.write`.',
  })
  @ApiOkResponse({ type: RemindAttendanceResultDto })
  @ApiErrorResponses(
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'SESSION_CANCELLED',
    'ATTENDANCE_NOT_OPEN_YET',
    'ATTENDANCE_WINDOW_CLOSED',
  )
  remind(
    @Param('id', SESSION_ID) id: string,
    @CurrentUser() user: AdminUser,
  ): Promise<RemindAttendanceResultDto> {
    return this.attendance.remind(id, user);
  }
}
