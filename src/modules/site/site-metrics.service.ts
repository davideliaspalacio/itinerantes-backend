import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import type { SiteMetric } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { type AuditActor, AuditService } from '../audit/audit.service';
import type {
  AdminSiteMetricDto,
  SiteMetricDto,
  SiteMetricsResponseDto,
  UpdateSiteMetricRequestDto,
} from './dto/site-metrics.dto';

/** "1800" → "1,800"; "3000000" → "3,000,000" (formato es-MX). */
export function formatMetric(metric: Pick<SiteMetric, 'value' | 'prefix' | 'suffix'>): string {
  return `${metric.prefix}${metric.value.toLocaleString('es-MX')}${metric.suffix}`;
}

function toDto(metric: SiteMetric): SiteMetricDto {
  return {
    key: metric.key,
    label: metric.label,
    value: metric.value,
    prefix: metric.prefix,
    suffix: metric.suffix,
    display: formatMetric(metric),
    sortOrder: metric.sortOrder,
  };
}

function toAdminDto(metric: SiteMetric): AdminSiteMetricDto {
  return { ...toDto(metric), visible: metric.visible, updatedAt: metric.updatedAt.toISOString() };
}

@Injectable()
export class SiteMetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listPublic(): Promise<SiteMetricsResponseDto> {
    const metrics = await this.prisma.siteMetric.findMany({
      where: { visible: true },
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
    });
    const updatedAt = metrics.reduce<Date | null>(
      (latest, m) => (!latest || m.updatedAt > latest ? m.updatedAt : latest),
      null,
    );
    return { data: metrics.map(toDto), updatedAt: updatedAt?.toISOString() ?? null };
  }

  async listAdmin(): Promise<AdminSiteMetricDto[]> {
    const metrics = await this.prisma.siteMetric.findMany({
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
    });
    return metrics.map(toAdminDto);
  }

  async update(
    key: string,
    dto: UpdateSiteMetricRequestDto,
    actor: AuditActor,
  ): Promise<AdminSiteMetricDto> {
    const before = await this.prisma.siteMetric.findUnique({ where: { key } });
    if (!before) throw new AppException('NOT_FOUND', { message: 'La métrica no existe.' });
    const after = await this.prisma.siteMetric.update({ where: { key }, data: dto });
    await this.audit.record({
      actor,
      action: 'site_metric.update',
      entityType: 'SiteMetric',
      entityId: key,
      summary: `Actualizó la cifra «${after.label}» a ${formatMetric(after)}`,
      before: { ...before, updatedAt: undefined },
      after: { ...after, updatedAt: undefined },
    });
    return toAdminDto(after);
  }
}
