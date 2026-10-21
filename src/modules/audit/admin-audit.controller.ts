import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { ApiErrorResponses } from '../../common/swagger/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../../common/swagger/api-paginated-response.decorator';
import { BEARER_AUTH_NAME } from '../../config/openapi';
import { Permission } from '../../config/permissions';
import { AuditService } from './audit.service';
import { AuditLogDto, ListAuditLogsQueryDto } from './dto/audit.dto';

@ApiTags('Admin – Auditoría')
@ApiBearerAuth(BEARER_AUTH_NAME)
@Controller('admin/audit-logs')
export class AdminAuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions(Permission.AUDIT_READ)
  @ApiOperation({
    summary: 'Registro de auditoría del panel',
    description:
      'Fase 06: toda acción de escritura del panel queda registrada (actor, acción, entidad, ' +
      'antes/después resumido). Más reciente primero. Filtra por entidad (`entityType` + ' +
      '`entityId`, p. ej. el historial de una oferta), por actor o por acción (`offer.` = prefijo). ' +
      'Permiso `audit.read` (SUPER_ADMIN).',
  })
  @ApiPaginatedResponse(AuditLogDto)
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN')
  list(@Query() query: ListAuditLogsQueryDto): Promise<PaginatedResponseDto<AuditLogDto>> {
    return this.audit.list(query);
  }
}
