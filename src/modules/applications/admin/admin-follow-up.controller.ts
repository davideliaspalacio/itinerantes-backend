import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
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
import { AdminFollowUpService } from './admin-follow-up.service';
import {
  CloseEnrollmentRequestDto,
  CloseEnrollmentResultDto,
  CreateFollowUpNoteRequestDto,
  ExtendDeadlineRequestDto,
  FollowUpDetailDto,
  FollowUpItemDto,
  FollowUpNoteDto,
  FollowUpNotesDto,
  FunnelOfferDto,
  ListFollowUpsQueryDto,
  ListFunnelOffersQueryDto,
  OfferFunnelDto,
  ReminderResultDto,
  WhatsappRequestDto,
  WhatsappResultDto,
} from './dto/admin-follow-up.dto';

const OFFER_ID = uuidOr404('La oferta no existe.');
const APP_ID = uuidOr404('La postulación no existe.');
const APPROVED_ONLY =
  ' Solo postulaciones ya aprobadas (pendientes, inscritas o vencidas); otras → 409 ' +
  '`APPLICATION_INVALID_STATE`.';

@ApiTags('Admin – Seguimiento')
@ApiBearerAuth(BEARER_AUTH_NAME)
@Controller('admin')
export class AdminFollowUpController {
  constructor(private readonly service: AdminFollowUpService) {}

  // --- Embudo ----------------------------------------------------------------------------------------

  @Get('funnel/offers')
  @RequirePermissions(Permission.FOLLOW_UP_READ)
  @ApiOperation({
    summary: 'Ofertas con postulaciones o inscripciones (selector)',
    description:
      'HU-32: solo ofertas con postulaciones enviadas o inscripciones. Más reciente primero. ' +
      'Permiso `followup.read`.',
  })
  @ApiPaginatedResponse(FunnelOfferDto)
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN')
  offers(@Query() query: ListFunnelOffersQueryDto): Promise<PaginatedResponseDto<FunnelOfferDto>> {
    return this.service.offers(query);
  }

  @Get('funnel/offers/:offerId')
  @RequirePermissions(Permission.FOLLOW_UP_READ)
  @ApiParam({ name: 'offerId', format: 'uuid' })
  @ApiOperation({
    summary: 'Embudo de conversión de una oferta',
    description:
      'HU-32: Postulados → Aprobados → Con pago iniciado → Inscritos con conteos y % (p. ej. 40 → 30 ' +
      '→ 24 → 20 = 50%), más tarjetas de resumen (en revisión, pendientes de pago/confirmación, ' +
      'vencidas, no seleccionadas, plazos ≤ 2 días). Permiso `followup.read`.',
  })
  @ApiOkResponse({ type: OfferFunnelDto })
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  funnel(@Param('offerId', OFFER_ID) offerId: string): Promise<OfferFunnelDto> {
    return this.service.funnel(offerId);
  }

  @Get('funnel/offers/:offerId/follow-ups')
  @RequirePermissions(Permission.FOLLOW_UP_READ)
  @ApiParam({ name: 'offerId', format: 'uuid' })
  @ApiOperation({
    summary: '"Aprobados sin pagar" / "Vencidas"',
    description:
      'HU-32: `tab=PENDING` (Aprobada – pendiente de pago o de confirmación, por vencimiento más ' +
      'próximo; `dueSoon` = 2 días o menos) o `tab=EXPIRED`. Incluye contacto (correo, teléfono y ' +
      '`whatsappUrl`), saldo en MXN/USD, plazo restante, último contacto y si se puede enviar ' +
      'recordatorio. Al pagar salen de la lista. Permiso `followup.read` (sin él no se ven datos de ' +
      'contacto: 403).',
  })
  @ApiPaginatedResponse(FollowUpItemDto)
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  followUps(
    @Param('offerId', OFFER_ID) offerId: string,
    @Query() query: ListFollowUpsQueryDto,
  ): Promise<PaginatedResponseDto<FollowUpItemDto>> {
    return this.service.followUps(offerId, query);
  }

  @Post('funnel/offers/:offerId/close-enrollment')
  @HttpCode(200)
  @RequirePermissions(Permission.FOLLOW_UP_MANAGE)
  @ApiParam({ name: 'offerId', format: 'uuid' })
  @ApiOperation({
    summary: 'Cerrar inscripciones',
    description:
      'HU-32 "Cerrar inscripciones cambia la oferta (HU-27)": fija el cierre de inscripciones (o de ' +
      'la convocatoria) en este momento. Oferta no publicada o ya cerrada → 409 ' +
      '`OFFER_INVALID_STATE`. Permiso `followup.manage`.',
  })
  @ApiOkResponse({ type: CloseEnrollmentResultDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'OFFER_INVALID_STATE',
  )
  closeEnrollment(
    @CurrentUser() user: AdminUser,
    @Param('offerId', OFFER_ID) offerId: string,
    @Body() dto: CloseEnrollmentRequestDto,
  ): Promise<CloseEnrollmentResultDto> {
    return this.service.closeEnrollment(user, offerId, dto.reason);
  }

  // --- Persona ---------------------------------------------------------------------------------------

  @Get('applications/:id/follow-up')
  @RequirePermissions(Permission.FOLLOW_UP_READ)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Panel lateral de seguimiento de una persona',
    description:
      'HU-32: contacto, saldo, plazo y línea de tiempo (decisión y cambios de estado, recordatorios, ' +
      'WhatsApp, notas con autor, pagos). Permiso `followup.read`.' +
      APPROVED_ONLY,
  })
  @ApiOkResponse({ type: FollowUpDetailDto })
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'APPLICATION_INVALID_STATE')
  detail(@Param('id', APP_ID) id: string): Promise<FollowUpDetailDto> {
    return this.service.detail(id);
  }

  @Get('applications/:id/notes')
  @RequirePermissions(Permission.FOLLOW_UP_READ)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Notas de seguimiento',
    description:
      'HU-32: historial con autor (más reciente primero). Permiso `followup.read`.' + APPROVED_ONLY,
  })
  @ApiOkResponse({ type: FollowUpNotesDto })
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'APPLICATION_INVALID_STATE')
  notes(@Param('id', APP_ID) id: string): Promise<FollowUpNotesDto> {
    return this.service.notes(id);
  }

  @Post('applications/:id/notes')
  @RequirePermissions(Permission.FOLLOW_UP_MANAGE)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Agregar nota de seguimiento',
    description:
      'HU-32: texto (máx. 1,000) + resultado opcional (Sin respuesta / Pagará pronto / Solicita ' +
      'cuotas / Desiste). Interna: nunca visible al postulante. Permiso `followup.manage`.' +
      APPROVED_ONLY,
  })
  @ApiCreatedResponse({ type: FollowUpNoteDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'APPLICATION_INVALID_STATE',
  )
  addNote(
    @CurrentUser() user: AdminUser,
    @Param('id', APP_ID) id: string,
    @Body() dto: CreateFollowUpNoteRequestDto,
  ): Promise<FollowUpNoteDto> {
    return this.service.addNote(user, id, dto.body, dto.outcome);
  }

  @Post('applications/:id/reminders')
  @RequirePermissions(Permission.FOLLOW_UP_MANAGE)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Enviar recordatorio por correo',
    description:
      'HU-32: correo + notificación con saldo, fecha límite y link de pago (HU-23), o para confirmar ' +
      'participación. Solo "Aprobada – pendiente de pago/confirmación". Máximo 1 cada 24 h → 409 ' +
      '`FOLLOW_UP_REMINDER_TOO_SOON` (`meta.availableAt`). Registra una nota automática. Permiso ' +
      '`followup.manage`.',
  })
  @ApiCreatedResponse({ type: ReminderResultDto })
  @ApiErrorResponses(
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'APPLICATION_INVALID_STATE',
    'FOLLOW_UP_REMINDER_TOO_SOON',
  )
  remind(
    @CurrentUser() user: AdminUser,
    @Param('id', APP_ID) id: string,
  ): Promise<ReminderResultDto> {
    return this.service.sendReminder(user, id);
  }

  @Post('applications/:id/whatsapp')
  @RequirePermissions(Permission.FOLLOW_UP_MANAGE)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Contactar por WhatsApp (enlace wa.me prellenado)',
    description:
      'HU-32: arma el enlace `https://wa.me/<número>?text=…` con la plantilla ({nombre}, {saldo}, ' +
      '{link_pago}) y registra una nota automática. La plataforma NO envía WhatsApp: el frontend abre ' +
      'la URL en otra pestaña. Sin teléfono válido con indicativo → 422 `FOLLOW_UP_PHONE_INVALID`. ' +
      'Permiso `followup.manage`.' +
      APPROVED_ONLY,
  })
  @ApiCreatedResponse({ type: WhatsappResultDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'APPLICATION_INVALID_STATE',
    'FOLLOW_UP_PHONE_INVALID',
  )
  whatsapp(
    @CurrentUser() user: AdminUser,
    @Param('id', APP_ID) id: string,
    @Body() dto: WhatsappRequestDto,
  ): Promise<WhatsappResultDto> {
    return this.service.whatsapp(user, id, dto.template);
  }

  @Post('applications/:id/extend-deadline')
  @HttpCode(200)
  @RequirePermissions(Permission.FOLLOW_UP_MANAGE)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Extender plazo',
    description:
      'HU-32: nueva fecha (futura y ≤ inicio de clases; si no, 400 con `details[].field = ' +
      'responseDueAt`) y motivo obligatorio. Si estaba "Vencida", la reactiva y vuelve a reservar la ' +
      'inscripción (si su tipo de beca ya no tiene cupo → 409 `SCHOLARSHIP_TYPE_FULL`). Deja nota ' +
      'automática. Permiso `followup.manage`.' +
      APPROVED_ONLY,
  })
  @ApiOkResponse({ type: FollowUpDetailDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'APPLICATION_INVALID_STATE',
    'SCHOLARSHIP_TYPE_FULL',
  )
  extendDeadline(
    @CurrentUser() user: AdminUser,
    @Param('id', APP_ID) id: string,
    @Body() dto: ExtendDeadlineRequestDto,
  ): Promise<FollowUpDetailDto> {
    return this.service.extendDeadline(user, id, new Date(dto.responseDueAt), dto.reason.trim());
  }
}
