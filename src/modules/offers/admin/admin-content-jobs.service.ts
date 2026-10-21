import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { nowUtc } from '../../../common/utils/time';
import { BUSINESS_RULES } from '../../../config/business-rules';
import type { Env } from '../../../config/env.schema';
import { AdminContentService } from './admin-content.service';

/**
 * Publicación programada de módulos y recursos (HU-28): cuando llega `publishAt`, notifica a los
 * inscritos activos lo que se publicó con "Notificar a inscritos". Corre con SCHEDULER_ENABLED=true
 * (una sola instancia); es idempotente (claim de `publishedNotifiedAt` + dedupeKey).
 */
@Injectable()
export class AdminContentJobsService {
  private readonly logger = new Logger(AdminContentJobsService.name);
  private readonly enabled: boolean;

  constructor(
    private readonly content: AdminContentService,
    config: ConfigService<Env, true>,
  ) {
    this.enabled = config.get('SCHEDULER_ENABLED', { infer: true });
  }

  @Cron(BUSINESS_RULES.PORTAL_NOTIFICATIONS_CRON, { name: 'admin-content-publication' })
  async run(): Promise<void> {
    if (!this.enabled) return;
    try {
      const notified = await this.content.publishPending(nowUtc());
      if (notified > 0) this.logger.log({ notified }, 'Avisos de material publicado enviados');
    } catch (error) {
      this.logger.error({ err: error }, 'Job de publicación programada falló');
    }
  }
}
