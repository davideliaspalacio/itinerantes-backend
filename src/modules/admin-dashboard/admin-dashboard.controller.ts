import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AdminUser } from '../../common/guards/permissions.guard';
import { ApiErrorResponses } from '../../common/swagger/api-error-responses.decorator';
import { BEARER_AUTH_NAME } from '../../config/openapi';
import { Permission } from '../../config/permissions';
import { AdminDashboardService } from './admin-dashboard.service';
import {
  AdminDashboardDto,
  AdminDashboardQueryDto,
  AdminDashboardTrendsDto,
  AdminDashboardTrendsQueryDto,
} from './dto/admin-dashboard.dto';

@ApiTags('Admin – Dashboard')
@ApiBearerAuth(BEARER_AUTH_NAME)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get()
  @RequirePermissions(Permission.ADMIN_ACCESS)
  @ApiOperation({
    summary: 'Cifras del inicio del panel',
    description:
      'Todo el dashboard en una llamada. `people` lo ve cualquier integrante del equipo; ' +
      '`training` (`offers.read`), `applications` (`applications.read`), `payments` ' +
      '(`payments.read`) y `contact` (`contact.read`) vienen en `null` sin ese permiso. Las cifras ' +
      '"InPeriod" y los montos cobrados usan `from`/`to` (por defecto los últimos 30 días); los ' +
      'estados y `tasks` son la foto actual. Los montos van por moneda, nunca sumados.',
  })
  @ApiOkResponse({ type: AdminDashboardDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN')
  overview(
    @CurrentUser() user: AdminUser,
    @Query() query: AdminDashboardQueryDto,
  ): Promise<AdminDashboardDto> {
    return this.dashboard.overview(user, query);
  }

  @Get('trends')
  @RequirePermissions(Permission.ADMIN_ACCESS)
  @ApiOperation({
    summary: 'Series por mes para las gráficas del inicio',
    description:
      'Últimos `months` meses (1–24, por defecto 6) incluido el actual, cortados con la hora de ' +
      'Ciudad de México: personas nuevas, inscripciones nuevas, postulaciones enviadas y neto ' +
      'cobrado en MXN y USD (centavos). Cada serie viene en `null` sin su permiso.',
  })
  @ApiOkResponse({ type: AdminDashboardTrendsDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN')
  trends(
    @CurrentUser() user: AdminUser,
    @Query() query: AdminDashboardTrendsQueryDto,
  ): Promise<AdminDashboardTrendsDto> {
    return this.dashboard.trends(user, query);
  }
}
