import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import type { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { ApiErrorResponses } from '../../common/swagger/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../../common/swagger/api-paginated-response.decorator';
import { BEARER_AUTH_NAME } from '../../config/openapi';
import { CreateEnrollmentRequestDto, ListEnrollmentsQueryDto } from './dto/enrollments.query.dto';
import { FormationCardDto } from './dto/enrollments.response.dto';
import { EnrollmentsService } from './enrollments.service';

@ApiTags('Mi formación')
@ApiBearerAuth(BEARER_AUTH_NAME)
@Controller('me/enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollments: EnrollmentsService) {}

  @Get()
  @ApiOperation({
    summary: 'Mi formación',
    description:
      'HU-07: mis inscripciones (activas, completadas o suspendidas; nunca las pendientes de pago ni ' +
      'canceladas) filtradas por tipo (`type`, sub-ítems Diplomados/Cursos/Talleres) y pestaña ' +
      '(`phase`: ACTIVE, COMPLETED, ALL). Cada tarjeta trae portada, % de progreso (asistidas ÷ ' +
      'programadas sin canceladas), próxima sesión (UTC: muestra tu hora + CDMX), `origin = MOODLE` ' +
      '("Vía Moodle") y `canContinue` ([Continuar] → Aula `GET /me/classrooms/{offer.id}`). ' +
      'Orden: activas por próxima sesión; completadas por fecha de fin (más reciente primero). ' +
      'Lista vacía → estado vacío con botón al catálogo filtrado (`/escuela/oferta?type=…`).',
  })
  @ApiPaginatedResponse(FormationCardDto, 'Inscripciones paginadas.')
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'RATE_LIMITED')
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListEnrollmentsQueryDto,
  ): Promise<PaginatedResponseDto<FormationCardDto>> {
    return this.enrollments.listMine(user.id, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Inscribirme en una oferta gratuita',
    description:
      'Acción `ENROLL_FREE` de la ficha (HU-16): inscripción directa en una oferta NAS **gratuita** ' +
      '(no convocatoria) con inscripciones abiertas y cupo. Crea la inscripción ACTIVE, envía ' +
      'notificación + correo "Inscripción confirmada" y responde la tarjeta de Mi formación. ' +
      'Errores: `ENROLLMENT_ALREADY_EXISTS` (409, `meta.enrollmentStatus`) → "Ya estás inscrito · Ir ' +
      'a mi aula"; `OFFER_SOLD_OUT` (409) → "Cupo agotado"; `ENROLLMENT_CLOSED` (422, ' +
      '`meta.reason` = ENROLLMENT_NOT_OPEN_YET/ENROLLMENT_CLOSED/OFFER_FINISHED y ' +
      '`meta.availableFrom`); `ENROLLMENT_NOT_FREE` (422, `meta.requiredAction` = ENROLL_AND_PAY / ' +
      'APPLY_OPEN_CALL / ACTIVATE_MOODLE_ACCESS: usa ese flujo); `OFFER_NOT_AVAILABLE` (404). ' +
      'Las inscripciones de pago llegan en la Fase 05.',
  })
  @ApiCreatedResponse({ type: FormationCardDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'OFFER_NOT_AVAILABLE',
    'ENROLLMENT_ALREADY_EXISTS',
    'OFFER_SOLD_OUT',
    'ENROLLMENT_CLOSED',
    'ENROLLMENT_NOT_FREE',
    'RATE_LIMITED',
  )
  enroll(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateEnrollmentRequestDto,
  ): Promise<FormationCardDto> {
    return this.enrollments.enrollFree(user.id, dto.offerId);
  }
}
