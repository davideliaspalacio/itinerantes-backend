import { Controller, Get, Headers, Param, Query } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalAuth } from '../../common/decorators/optional-auth.decorator';
import type { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { ApiErrorResponses } from '../../common/swagger/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../../common/swagger/api-paginated-response.decorator';
import {
  ListOffersQueryDto,
  TopicAvailabilityQueryDto,
  ViewerTimezoneQueryDto,
} from './dto/offers.query.dto';
import {
  OfferDetailDto,
  OfferSummaryDto,
  TopicAvailabilityListDto,
} from './dto/offers.response.dto';
import { OffersService } from './offers.service';

const TIMEZONE_HEADER = ApiHeader({
  name: 'X-Timezone',
  required: false,
  example: 'America/Mexico_City',
  description:
    'Alternativa al query `tz` (zona IANA del navegador) para estimar la moneda sin sesión.',
});

const OPTIONAL_AUTH_NOTE =
  'Pública con sesión OPCIONAL: con `Authorization: Bearer` válido se personaliza (moneda del país ' +
  'del perfil y estado "Inscrito"); un token ausente o vencido NO da 401, se responde como visitante.';

@ApiTags('Oferta formativa')
@OptionalAuth()
@Controller('offers')
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  @ApiOperation({
    summary: 'Catálogo de oferta formativa',
    description:
      'HU-15: ofertas PUBLICADAS (nunca borradores) con filtros combinables (AND): `type` (varios), ' +
      '`modality`, `status` (por defecto `ENROLLMENT_OPEN,UPCOMING`), `scholarship=true` (solo ' +
      'diplomados NAS con beca), `topic` (HU-34) y `q` (≥ 3 caracteres; nombre o docente, sin ' +
      'acentos). Orden: abiertas/próximas por inicio más cercano; cerradas y finalizadas al final. ' +
      'Costo en MXN o USD según el visitante (`pricing.currency`); Moodle → `EXTERNAL_ENROLLMENT` ' +
      'sin precio. Horario: regla en hora CDMX + `firstSession` en UTC. ' +
      OPTIONAL_AUTH_NOTE,
  })
  @TIMEZONE_HEADER
  @ApiPaginatedResponse(OfferSummaryDto, 'Ofertas paginadas.')
  @ApiErrorResponses('VALIDATION_ERROR', 'RATE_LIMITED')
  list(
    @Query() query: ListOffersQueryDto,
    @CurrentUser() user: AuthUser | undefined,
    @Headers('x-timezone') timezoneHeader?: string,
  ): Promise<PaginatedResponseDto<OfferSummaryDto>> {
    return this.offers.list(query, { user, timezone: query.tz ?? timezoneHeader });
  }

  @Get('availability')
  @ApiOperation({
    summary: 'Disponibilidad por temática (página Itinerantes del Agua)',
    description:
      'HU-34: para cada temática literal del cliente (10 ítems en 3 grupos, en su orden) devuelve la ' +
      'etiqueta (`ENROLLMENT_OPEN` Inscripciones abiertas, `UPCOMING` Próximamente, ' +
      '`ENROLLMENT_CLOSED` Inscripciones cerradas, `OPEN_CALL` Programa por convocatoria, ' +
      '`NO_SCHEDULED_DATES` Sin fechas programadas) y el destino: ficha (una oferta vigente), catálogo ' +
      'filtrado (varias) o sin enlace (ninguna). Se resuelve con `Offer.publicTopic`, sin cambiar ' +
      'código al agregar ofertas.',
  })
  @ApiOkResponse({ type: TopicAvailabilityListDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'RATE_LIMITED')
  async availability(@Query() query: TopicAvailabilityQueryDto): Promise<TopicAvailabilityListDto> {
    return { data: await this.offers.topicAvailability(query.topics) };
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Ficha de una oferta',
    description:
      'HU-16: ficha completa (docentes, "¿Qué aprenderás?", temario publicado, fechas, horario CDMX, ' +
      'costo en la moneda del visitante, "hasta N cuotas", bloque de beca con tipos (cupo) y monto ' +
      'estimado, elegibilidad de convocatorias, cupo) y `actions`: los CTA calculados por el backend ' +
      '(`ENROLL_AND_PAY`, `PAY_IN_INSTALLMENTS`, `ENROLL_FREE`, `APPLY_SCHOLARSHIP`, ' +
      '`APPLY_OPEN_CALL`, `ACTIVATE_MOODLE_ACCESS`, `GO_TO_CLASSROOM`) con `enabled` y `reason`. ' +
      'Nunca expone el grupo de WhatsApp ni enlaces de sesión/grabación. Borrador, archivada o ' +
      'inexistente → 404 `OFFER_NOT_AVAILABLE`. ' +
      OPTIONAL_AUTH_NOTE,
  })
  @ApiParam({ name: 'slug', example: 'diplomado-en-ecotecnologias-del-agua' })
  @TIMEZONE_HEADER
  @ApiOkResponse({ type: OfferDetailDto })
  @ApiErrorResponses('OFFER_NOT_AVAILABLE', 'VALIDATION_ERROR', 'RATE_LIMITED')
  detail(
    @Param('slug') slug: string,
    @Query() query: ViewerTimezoneQueryDto,
    @CurrentUser() user: AuthUser | undefined,
    @Headers('x-timezone') timezoneHeader?: string,
  ): Promise<OfferDetailDto> {
    return this.offers.detail(slug.toLowerCase(), {
      user,
      timezone: query.tz ?? timezoneHeader,
    });
  }
}
