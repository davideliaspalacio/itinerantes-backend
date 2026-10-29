import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import type { AdminUser } from '../../common/guards/permissions.guard';
import { uuidOr404 } from '../../common/pipes/uuid-or-404.pipe';
import { ApiErrorResponses } from '../../common/swagger/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../../common/swagger/api-paginated-response.decorator';
import { BEARER_AUTH_NAME } from '../../config/openapi';
import { Permission } from '../../config/permissions';
import { AdminContactService } from './admin-contact.service';
import {
  AdminContactMessageDto,
  ContactInboxSummaryDto,
  ListContactMessagesQueryDto,
  UpdateContactMessageRequestDto,
} from './dto/admin-contact.dto';

const MESSAGE_ID = uuidOr404('El mensaje no existe.');

@ApiTags('Admin – Contacto')
@ApiBearerAuth(BEARER_AUTH_NAME)
@Controller('admin/contact-messages')
export class AdminContactController {
  constructor(private readonly contact: AdminContactService) {}

  @Get()
  @RequirePermissions(Permission.CONTACT_READ)
  @ApiOperation({
    summary: 'Bandeja de mensajes de Contacto',
    description:
      'HU-38 / HU-01: mensajes del formulario de Contacto y de la landing, más recientes primero. ' +
      'Filtra por estado, asunto, origen y rango de fechas; `q` busca en nombre, correo, ' +
      'organización y texto. Permiso `contact.read`.',
  })
  @ApiPaginatedResponse(AdminContactMessageDto)
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN')
  list(
    @Query() query: ListContactMessagesQueryDto,
  ): Promise<PaginatedResponseDto<AdminContactMessageDto>> {
    return this.contact.list(query);
  }

  @Get('summary')
  @RequirePermissions(Permission.CONTACT_READ)
  @ApiOperation({
    summary: 'Contadores de la bandeja',
    description:
      'HU-38: `unread` (mensajes NEW, para el contador del menú) y el total por estado (pestañas). ' +
      'Permiso `contact.read`.',
  })
  @ApiOkResponse({ type: ContactInboxSummaryDto })
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN')
  summary(): Promise<ContactInboxSummaryDto> {
    return this.contact.summary();
  }

  @Get(':id')
  @RequirePermissions(Permission.CONTACT_READ)
  @ApiOperation({
    summary: 'Detalle de un mensaje de Contacto',
    description: 'HU-38. Abrirlo NO cambia su estado. Permiso `contact.read`.',
  })
  @ApiOkResponse({ type: AdminContactMessageDto })
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  get(@Param('id', MESSAGE_ID) id: string): Promise<AdminContactMessageDto> {
    return this.contact.get(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CONTACT_MANAGE)
  @ApiOperation({
    summary: 'Cambiar estado o nota interna de un mensaje',
    description:
      'HU-38: `status` (NEW, IN_PROGRESS, ANSWERED, ARCHIVED; cualquier transición) y/o ' +
      '`internalNote` (`null` o "" la borra). Al menos uno de los dos (si no → 400 ' +
      '`VALIDATION_ERROR`). Guarda quién y cuándo (`handledBy`, `handledAt`). Auditoría ' +
      '`contact.update`. Permiso `contact.manage`.',
  })
  @ApiOkResponse({ type: AdminContactMessageDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  update(
    @CurrentUser() user: AdminUser,
    @Param('id', MESSAGE_ID) id: string,
    @Body() dto: UpdateContactMessageRequestDto,
  ): Promise<AdminContactMessageDto> {
    return this.contact.update(user, id, dto);
  }
}
