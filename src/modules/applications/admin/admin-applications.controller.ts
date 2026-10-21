import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
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
import type { PaginatedResponseDto } from '../../../common/dto/pagination.dto';
import type { AdminUser } from '../../../common/guards/permissions.guard';
import { uuidOr404 } from '../../../common/pipes/uuid-or-404.pipe';
import { ApiErrorResponses } from '../../../common/swagger/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../../../common/swagger/api-paginated-response.decorator';
import { formatInZone, nowUtc, OFFICIAL_TIMEZONE } from '../../../common/utils/time';
import { BEARER_AUTH_NAME } from '../../../config/openapi';
import { Permission } from '../../../config/permissions';
import { AdminApplicationsService } from './admin-applications.service';
import {
  AdminApplicationDetailDto,
  AdminApplicationListItemDto,
  ApproveApplicationRequestDto,
  CancelInterviewRequestDto,
  CompleteInterviewRequestDto,
  DecisionPreviewDto,
  DecisionPreviewQueryDto,
  ListAdminApplicationsQueryDto,
  RejectApplicationRequestDto,
  RetryEmailRequestDto,
  RetryEmailResultDto,
  ScheduleInterviewRequestDto,
  UpsertEvaluationRequestDto,
} from './dto/admin-applications.dto';

const APP_ID = uuidOr404('La postulación no existe.');
const NOT_FOUND = ' Postulación inexistente, en borrador o id mal formado → 404 `NOT_FOUND`.';

@ApiTags('Admin – Postulaciones')
@ApiBearerAuth(BEARER_AUTH_NAME)
@Controller('admin/applications')
export class AdminApplicationsController {
  constructor(private readonly service: AdminApplicationsService) {}

  @Get()
  @RequirePermissions(Permission.APPLICATIONS_READ)
  @ApiOperation({
    summary: 'Bandeja de postulaciones (becas y convocatorias)',
    description:
      'HU-31: pestañas Becas (`kind=SCHOLARSHIP`) / Convocatorias (`kind=OPEN_CALL`); filtros por ' +
      'oferta, estado (HU-21), nivel solicitado, país, "Requiere entrevista" y "Sin mi evaluación"; ' +
      'búsqueda por nombre, correo o folio. Nunca lista borradores. Cada fila trae las insignias ' +
      '(`requiresInterview`, `evaluationCount`, `myEvaluation`). Permiso `applications.read`.',
  })
  @ApiPaginatedResponse(AdminApplicationListItemDto)
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN')
  list(
    @CurrentUser() user: AdminUser,
    @Query() query: ListAdminApplicationsQueryDto,
  ): Promise<PaginatedResponseDto<AdminApplicationListItemDto>> {
    return this.service.list(user, query);
  }

  @Get('export')
  @RequirePermissions(Permission.APPLICATIONS_READ)
  @ApiProduces('text/csv')
  @ApiOperation({
    summary: 'Exportar postulaciones a CSV (Excel)',
    description:
      'HU-31 "Exportar a Excel para la transición": mismos filtros que la bandeja (se ignoran ' +
      '`page`/`pageSize`; máx. 5000 filas). CSV UTF-8 con BOM (Excel muestra bien los acentos). ' +
      'Descárgalo con `fetch` (Bearer) → `blob`. Permiso `applications.read`.',
  })
  @ApiOkResponse({
    description: 'CSV',
    content: { 'text/csv': { schema: { type: 'string', format: 'binary' } } },
  })
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN')
  async export(
    @CurrentUser() user: AdminUser,
    @Query() query: ListAdminApplicationsQueryDto,
  ): Promise<StreamableFile> {
    const csv = Buffer.from(await this.service.exportCsv(user, query), 'utf8');
    const stamp = formatInZone(nowUtc(), OFFICIAL_TIMEZONE, 'yyyy-MM-dd');
    return new StreamableFile(csv, {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="postulaciones-${stamp}.csv"`,
      length: csv.length,
    });
  }

  @Get(':id')
  @RequirePermissions(Permission.APPLICATIONS_READ)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Detalle de una postulación',
    description:
      'HU-31: datos de contacto, carta o respuestas, evidencias (URLs firmadas ~10 min), historial ' +
      'con notas internas, entrevistas, evaluaciones de todo el comité + resumen ("2 aprobar · 1 con ' +
      'dudas · nivel más sugerido: Aguas Libres 50%"), bloque de decisión (`canDecide`, ' +
      '`blockedReason`, niveles con saldo en la moneda del postulante) y estado de los correos ' +
      '(`emails[]`, `decision.emailStatus`). `prevId`/`nextId` para [Anterior]/[Siguiente]. ' +
      '**Efecto:** si la postulación está "Enviada" y quien la abre puede evaluar o decidir, pasa a ' +
      '"En revisión" (`reviewStarted: true`, aviso solo en el portal). Permiso `applications.read`.' +
      NOT_FOUND,
  })
  @ApiOkResponse({ type: AdminApplicationDetailDto })
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  detail(
    @CurrentUser() user: AdminUser,
    @Param('id', APP_ID) id: string,
  ): Promise<AdminApplicationDetailDto> {
    return this.service.detail(user, id);
  }

  @Put(':id/evaluations/me')
  @RequirePermissions(Permission.APPLICATIONS_EVALUATE)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Guardar mi evaluación',
    description:
      'HU-31: una evaluación editable por integrante (Aprobar / No seleccionar / Tengo dudas + nivel ' +
      'sugerido + comentario). Nunca visible al postulante. Solo en Enviada, En revisión o ' +
      'Entrevista agendada (si no, 409 `APPLICATION_INVALID_STATE`). Permiso `applications.evaluate`.' +
      NOT_FOUND,
  })
  @ApiOkResponse({ type: AdminApplicationDetailDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'APPLICATION_INVALID_STATE',
  )
  evaluate(
    @CurrentUser() user: AdminUser,
    @Param('id', APP_ID) id: string,
    @Body() dto: UpsertEvaluationRequestDto,
  ): Promise<AdminApplicationDetailDto> {
    return this.service.upsertEvaluation(user, id, dto);
  }

  @Post(':id/interview')
  @HttpCode(200)
  @RequirePermissions(Permission.APPLICATIONS_INTERVIEW)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Agendar o reprogramar la entrevista por Zoom',
    description:
      'HU-31: fecha, hora y enlace (URL https de zoom.us). Pasa a "Entrevista agendada" y notifica ' +
      'con la hora en la zona del postulante + CDMX. Si ya estaba agendada, reprograma (cancela la ' +
      'anterior). Permiso `applications.interview`.' +
      NOT_FOUND,
  })
  @ApiOkResponse({ type: AdminApplicationDetailDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'APPLICATION_INVALID_STATE',
  )
  scheduleInterview(
    @CurrentUser() user: AdminUser,
    @Param('id', APP_ID) id: string,
    @Body() dto: ScheduleInterviewRequestDto,
  ): Promise<AdminApplicationDetailDto> {
    return this.service.scheduleInterview(user, id, dto);
  }

  @Post(':id/interview/complete')
  @HttpCode(200)
  @RequirePermissions(Permission.APPLICATIONS_INTERVIEW)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Marcar la entrevista como "Realizada" (o "No asistió")',
    description:
      'HU-31: requisito para aprobar Beca especial y convocatorias. Sin entrevista agendada → 404. ' +
      'Permiso `applications.interview`.',
  })
  @ApiOkResponse({ type: AdminApplicationDetailDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  completeInterview(
    @CurrentUser() user: AdminUser,
    @Param('id', APP_ID) id: string,
    @Body() dto: CompleteInterviewRequestDto,
  ): Promise<AdminApplicationDetailDto> {
    return this.service.completeInterview(user, id, dto.outcome ?? 'COMPLETED');
  }

  @Post(':id/interview/cancel')
  @HttpCode(200)
  @RequirePermissions(Permission.APPLICATIONS_INTERVIEW)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Cancelar la entrevista (sin reprogramar)',
    description:
      'HU-31: la postulación vuelve a "En revisión". Solo desde "Entrevista agendada" (si no, 409). ' +
      'Permiso `applications.interview`.',
  })
  @ApiOkResponse({ type: AdminApplicationDetailDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'APPLICATION_INVALID_STATE',
  )
  cancelInterview(
    @CurrentUser() user: AdminUser,
    @Param('id', APP_ID) id: string,
    @Body() dto: CancelInterviewRequestDto,
  ): Promise<AdminApplicationDetailDto> {
    return this.service.cancelInterview(user, id, dto.note);
  }

  @Get(':id/decision-preview')
  @RequirePermissions(Permission.APPLICATIONS_DECIDE)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Vista previa de la decisión y del correo',
    description:
      'HU-31 "Requiere vista previa confirmada": calcula % asignado, saldo en la moneda del ' +
      'postulante (Aguas Libres 50% sobre 10,200 MXN → 5,100 MXN), plazo (7 días sin superar el ' +
      'inicio) y el asunto/cuerpo del correo, sin guardar nada. `blockedReason = ' +
      'APPLICATION_INTERVIEW_REQUIRED` si falta la entrevista "Realizada". Permiso ' +
      '`applications.decide`.' +
      NOT_FOUND,
  })
  @ApiOkResponse({ type: DecisionPreviewDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  decisionPreview(
    @Param('id', APP_ID) id: string,
    @Query() query: DecisionPreviewQueryDto,
  ): Promise<DecisionPreviewDto> {
    return this.service.decisionPreview(id, query);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions(Permission.APPLICATIONS_DECIDE)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Registrar decisión: Aprobada',
    description:
      'HU-31: beca → nivel asignado (puede diferir del solicitado; Beca especial 71–80%); con saldo ' +
      'pasa a "Aprobada – pendiente de pago" (link de pago a 7 días, HU-23) y reserva la inscripción; ' +
      'sin costo → "Aprobada – confirma tu participación". `message` = párrafo editable que se agrega ' +
      'al correo; `emailPreviewConfirmed: true` obligatorio. Convocatoria o beca > 70% sin entrevista ' +
      '"Realizada" → 422 `APPLICATION_INTERVIEW_REQUIRED`. Si el correo falla, la decisión se conserva ' +
      'y `decision.emailStatus = FAILED` ("Correo no enviado" + [Reintentar envío]). Permiso ' +
      '`applications.decide`.' +
      NOT_FOUND,
  })
  @ApiOkResponse({ type: AdminApplicationDetailDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'APPLICATION_INVALID_STATE',
    'APPLICATION_INTERVIEW_REQUIRED',
  )
  approve(
    @CurrentUser() user: AdminUser,
    @Param('id', APP_ID) id: string,
    @Body() dto: ApproveApplicationRequestDto,
  ): Promise<AdminApplicationDetailDto> {
    return this.service.approve(user, id, dto);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions(Permission.APPLICATIONS_DECIDE)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Registrar decisión: No seleccionada',
    description:
      'HU-31: pasa a "No seleccionada" y notifica (portal + correo). `emailPreviewConfirmed: true` ' +
      'obligatorio. Permiso `applications.decide`.' +
      NOT_FOUND,
  })
  @ApiOkResponse({ type: AdminApplicationDetailDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'APPLICATION_INVALID_STATE',
  )
  reject(
    @CurrentUser() user: AdminUser,
    @Param('id', APP_ID) id: string,
    @Body() dto: RejectApplicationRequestDto,
  ): Promise<AdminApplicationDetailDto> {
    return this.service.reject(user, id, dto);
  }

  @Post(':id/retry-email')
  @HttpCode(200)
  @RequirePermissions(Permission.APPLICATIONS_DECIDE)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Reintentar el envío de un correo fallido',
    description:
      'HU-31 "Decisión guardada pero correo no enviado → [Reintentar envío]": reenvía el correo de la ' +
      'notificación indicada (o el último fallido de la postulación) sin repetir la decisión ni ' +
      'duplicar el aviso del portal. Sin correo fallido → 409 `NOTIFICATION_EMAIL_NOT_FAILED`. ' +
      'Permiso `applications.decide`.',
  })
  @ApiOkResponse({ type: RetryEmailResultDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'NOTIFICATION_EMAIL_NOT_FAILED',
  )
  retryEmail(
    @CurrentUser() user: AdminUser,
    @Param('id', APP_ID) id: string,
    @Body() dto: RetryEmailRequestDto,
  ): Promise<RetryEmailResultDto> {
    return this.service.retryEmail(user, id, dto.notificationId);
  }
}
