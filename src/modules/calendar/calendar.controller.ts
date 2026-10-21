import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiErrorResponses } from '../../common/swagger/api-error-responses.decorator';
import { BEARER_AUTH_NAME } from '../../config/openapi';
import { CalendarService } from './calendar.service';
import { CalendarQueryDto, CalendarResponseDto } from './dto/calendar.dto';

@ApiTags('Calendario')
@ApiBearerAuth(BEARER_AUTH_NAME)
@Controller('me/calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get()
  @ApiOperation({
    summary: 'Mi calendario',
    description:
      'HU-10: actividades en el rango [`from`, `to`) (máx. 62 días): sesiones generadas de mis ' +
      'formaciones (Formación/Territorio, solo inscritos; talleres con sede y sin enlace), eventos ' +
      'manuales de mi audiencia (webinars, encuentros), fechas importantes (inscripciones, becas, ' +
      'inicio, proyecto final) de ofertas publicadas y fechas de actividades de mis módulos (HU-08). Cada ítem trae su categoría de color, hora UTC ' +
      '(muestra tu hora + CDMX) y, si aplica, `join` (HU-12) y `link` (Aula u oferta). Las ' +
      'canceladas siguen visibles con `status = CANCELLED` y sin enlace. Orden cronológico. ' +
      'Rango inválido → 400 `VALIDATION_ERROR` (`details[].code` INVALID_RANGE / RANGE_TOO_LARGE).',
  })
  @ApiOkResponse({ type: CalendarResponseDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'RATE_LIMITED')
  async get(
    @CurrentUser() user: AuthUser,
    @Query() query: CalendarQueryDto,
  ): Promise<CalendarResponseDto> {
    return { data: await this.calendar.range(user.id, query.from, query.to, query.categories) };
  }
}
