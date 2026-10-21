import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SiteMetricsResponseDto } from './dto/site-metrics.dto';
import { SiteMetricsService } from './site-metrics.service';

@ApiTags('Sitio público')
@Public()
@Controller('site')
export class SiteMetricsController {
  constructor(private readonly metrics: SiteMetricsService) {}

  @Get('metrics')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({
    summary: 'Cifras de impacto de la landing',
    description:
      'HU-01. Público, sin token. Devuelve las cifras visibles ("+3,000,000 L de agua revitaliza", ' +
      '"1,800+ personas formadas", "12+ territorios…", "250+ jóvenes capacitados") ordenadas. Usa ' +
      '`display` tal cual o `value` si animas el contador (pinta `prefix` + número + `suffix`). Las ' +
      'edita SUPER_ADMIN con `PATCH /admin/site/metrics/{key}`. Caché de 5 minutos.',
  })
  @ApiOkResponse({ type: SiteMetricsResponseDto })
  list(): Promise<SiteMetricsResponseDto> {
    return this.metrics.listPublic();
  }
}
