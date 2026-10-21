import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
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
import type { PaginatedResponseDto } from '../../../common/dto/pagination.dto';
import type { AdminUser } from '../../../common/guards/permissions.guard';
import { uuidOr404 } from '../../../common/pipes/uuid-or-404.pipe';
import { ApiErrorResponses } from '../../../common/swagger/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../../../common/swagger/api-paginated-response.decorator';
import { BEARER_AUTH_NAME } from '../../../config/openapi';
import { Permission } from '../../../config/permissions';
import { AdminCalendarService } from './admin-calendar.service';
import {
  AdminCalendarDto,
  AdminCalendarEventDto,
  AdminCalendarQueryDto,
  CreateCalendarEventRequestDto,
  ListCalendarEventsQueryDto,
  UpdateCalendarEventRequestDto,
} from './dto/admin-calendar.dto';

const EVENT_ID = uuidOr404('El evento no existe.');

@ApiTags('Admin – Calendario')
@ApiBearerAuth(BEARER_AUTH_NAME)
@Controller('admin')
export class AdminCalendarController {
  constructor(private readonly calendar: AdminCalendarService) {}

  @Get('calendar')
  @RequirePermissions(Permission.OFFERS_READ)
  @ApiOperation({
    summary: 'Calendario del panel (vista mensual / lista)',
    description:
      'HU-29: sesiones de todas las ofertas (también canceladas) y eventos de todas las audiencias ' +
      'en el rango, con su categoría de color, filtrable por oferta y categoría; `edited` y ' +
      '`missingLink` para los íconos. Rango máx. 62 días (400 `VALIDATION_ERROR` con ' +
      '`details[].code` INVALID_RANGE / RANGE_TOO_LARGE). Permiso `offers.read`.',
  })
  @ApiOkResponse({ type: AdminCalendarDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN')
  async view(@Query() query: AdminCalendarQueryDto): Promise<AdminCalendarDto> {
    return { data: await this.calendar.calendar(query) };
  }

  @Get('calendar-events')
  @RequirePermissions(Permission.OFFERS_READ)
  @ApiOperation({
    summary: 'Eventos de calendario (manuales y fechas importantes)',
    description:
      'HU-29 / HU-10. Paginado; filtros por oferta, tipo, categoría, estado y fechas. Permiso `offers.read`.',
  })
  @ApiPaginatedResponse(AdminCalendarEventDto)
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN')
  list(
    @Query() query: ListCalendarEventsQueryDto,
  ): Promise<PaginatedResponseDto<AdminCalendarEventDto>> {
    return this.calendar.list(query);
  }

  @Post('calendar-events')
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiOperation({
    summary: '"+ Evento manual"',
    description:
      'HU-29: webinar, encuentro de comunidad… (kind MANUAL, categoría por defecto Eventos). Solo lo ' +
      've la audiencia elegida (HU-10): ALL_REGISTERED o OFFER_ENROLLED (exige `offerId`). No ' +
      'notifica. Permiso `offers.write`.',
  })
  @ApiCreatedResponse({ type: AdminCalendarEventDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN')
  create(
    @Body() dto: CreateCalendarEventRequestDto,
    @CurrentUser() user: AdminUser,
  ): Promise<AdminCalendarEventDto> {
    return this.calendar.create(dto, user);
  }

  @Patch('calendar-events/:id')
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Editar un evento',
    description: 'HU-29. `null` quita un valor opcional. Permiso `offers.write`.',
  })
  @ApiOkResponse({ type: AdminCalendarEventDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  update(
    @Param('id', EVENT_ID) id: string,
    @Body() dto: UpdateCalendarEventRequestDto,
    @CurrentUser() user: AdminUser,
  ): Promise<AdminCalendarEventDto> {
    return this.calendar.update(id, dto, user);
  }

  @Post('calendar-events/:id/cancel')
  @HttpCode(200)
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Cancelar un evento',
    description:
      'Sigue visible como "Cancelado" sin enlace (HU-10). Ya cancelado → 409 `CONFLICT`. Permiso `offers.write`.',
  })
  @ApiOkResponse({ type: AdminCalendarEventDto })
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT')
  cancel(
    @Param('id', EVENT_ID) id: string,
    @CurrentUser() user: AdminUser,
  ): Promise<AdminCalendarEventDto> {
    return this.calendar.cancel(id, user);
  }

  @Delete('calendar-events/:id')
  @HttpCode(204)
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Borrar un evento',
    description: 'Desaparece del calendario. Permiso `offers.write`.',
  })
  @ApiNoContentResponse({ description: 'Borrado.' })
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  remove(@Param('id', EVENT_ID) id: string, @CurrentUser() user: AdminUser): Promise<void> {
    return this.calendar.remove(id, user);
  }
}
