import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiErrorResponses } from '../../common/swagger/api-error-responses.decorator';
import { BEARER_AUTH_NAME } from '../../config/openapi';
import { DashboardDto } from './dashboard.dto';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth(BEARER_AUTH_NAME)
@Controller('me/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Mi dashboard',
    description:
      'HU-06: "Próxima actividad" (con acceso HU-12), "Mi formación" (máx. 3 activas con % de ' +
      'progreso y [Continuar]), widget Calendario (próximos eventos con color), widget Biblioteca ' +
      '(material recomendado) y contador de notificaciones. Cada bloque es independiente: si uno ' +
      'falla llega `null` y aparece en `failedBlocks` (los demás se muestran). Los widgets de Becas / ' +
      'Convocatorias (Fase 04) y el aviso de cuota (Fase 05) se agregarán a esta respuesta.',
  })
  @ApiOkResponse({ type: DashboardDto })
  @ApiErrorResponses('UNAUTHORIZED', 'RATE_LIMITED')
  get(@CurrentUser() user: AuthUser): Promise<DashboardDto> {
    return this.dashboard.get(user.id);
  }
}
