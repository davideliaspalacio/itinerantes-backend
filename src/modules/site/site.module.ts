import { Module } from '@nestjs/common';
import { AdminSiteMetricsController } from './admin/admin-site-metrics.controller';
import { SiteMetricsController } from './site-metrics.controller';
import { SiteMetricsService } from './site-metrics.service';

/** Contenido dinámico del sitio público: cifras de impacto de la landing. */
@Module({
  controllers: [SiteMetricsController, AdminSiteMetricsController],
  providers: [SiteMetricsService],
})
export class SiteModule {}
