import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import type { AdminUser } from '../../../common/guards/permissions.guard';
import { ApiErrorResponses } from '../../../common/swagger/api-error-responses.decorator';
import { BEARER_AUTH_NAME } from '../../../config/openapi';
import { Permission } from '../../../config/permissions';
import { AdminSiteMetricDto, UpdateSiteMetricRequestDto } from '../dto/site-metrics.dto';
import { SiteMetricsService } from '../site-metrics.service';

@ApiTags('Admin – Sitio público')
@ApiBearerAuth(BEARER_AUTH_NAME)
@Controller('admin/site/metrics')
export class AdminSiteMetricsController {
  constructor(private readonly metrics: SiteMetricsService) {}

  @Get()
  @RequirePermissions(Permission.SITE_WRITE)
  @ApiOperation({
    summary: 'Cifras de la landing (incluye ocultas)',
    description: 'Permiso `site.write` (SUPER_ADMIN).',
  })
  @ApiOkResponse({ type: [AdminSiteMetricDto] })
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN')
  list(): Promise<AdminSiteMetricDto[]> {
    return this.metrics.listAdmin();
  }

  @Patch(':key')
  @RequirePermissions(Permission.SITE_WRITE)
  @ApiOperation({
    summary: 'Editar una cifra de la landing',
    description:
      'Cambia número, texto, prefijo/sufijo, orden o visibilidad. Queda en la auditoría. Permiso ' +
      '`site.write` (SUPER_ADMIN).',
  })
  @ApiOkResponse({ type: AdminSiteMetricDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSiteMetricRequestDto,
    @CurrentUser() user: AdminUser,
  ): Promise<AdminSiteMetricDto> {
    return this.metrics.update(key, dto, user);
  }
}
