import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import type { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { uuidOr404 } from '../../common/pipes/uuid-or-404.pipe';
import { ApiErrorResponses } from '../../common/swagger/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../../common/swagger/api-paginated-response.decorator';
import { BEARER_AUTH_NAME } from '../../config/openapi';
import { ListNotificationsQueryDto } from './dto/notifications.query.dto';
import {
  MarkAllReadResponseDto,
  NotificationDto,
  UnreadCountDto,
} from './dto/notifications.response.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notificaciones')
@ApiBearerAuth(BEARER_AUTH_NAME)
@Controller('me/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Mis notificaciones',
    description:
      'HU-13: panel de la campana e historial. Orden: fijadas primero (prioridad alta sin ' +
      'regularizar: cobro fallido, mora) y luego de la más reciente a la más antigua. Filtros ' +
      '`unread=true` y `category`.',
  })
  @ApiPaginatedResponse(NotificationDto, 'Notificaciones paginadas.')
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'RATE_LIMITED')
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<PaginatedResponseDto<NotificationDto>> {
    return this.notifications.list(user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Contador de no leídas',
    description: 'HU-13: número del indicador de la campana (consúltalo al navegar o cada minuto).',
  })
  @ApiOkResponse({ type: UnreadCountDto })
  @ApiErrorResponses('UNAUTHORIZED', 'RATE_LIMITED')
  unreadCount(@CurrentUser() user: AuthUser): Promise<UnreadCountDto> {
    return this.notifications.unreadCount(user.id);
  }

  @Post('read-all')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Marcar todas como leídas',
    description: 'HU-13 "Marcar todas como leídas". Las fijadas siguen fijadas hasta regularizar.',
  })
  @ApiOkResponse({ type: MarkAllReadResponseDto })
  @ApiErrorResponses('UNAUTHORIZED', 'RATE_LIMITED')
  markAllRead(@CurrentUser() user: AuthUser): Promise<MarkAllReadResponseDto> {
    return this.notifications.markAllRead(user.id);
  }

  @Post(':id/read')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Marcar una notificación como leída',
    description:
      'HU-13. Idempotente. Una notificación de otra persona responde 404 `NOT_FOUND` (no se revela).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: NotificationDto })
  @ApiErrorResponses('UNAUTHORIZED', 'NOT_FOUND', 'RATE_LIMITED')
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidOr404('La notificación no existe.')) id: string,
  ): Promise<NotificationDto> {
    return this.notifications.markRead(user.id, id);
  }
}
