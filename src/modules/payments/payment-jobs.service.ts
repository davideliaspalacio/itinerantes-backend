import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { nowUtc } from '../../common/utils/time';
import { BUSINESS_RULES } from '../../config/business-rules';
import type { Env } from '../../config/env.schema';
import { CheckoutService } from './checkout.service';
import { InstallmentCollectionService } from './installment-collection.service';

/**
 * Tareas programadas de pagos (HU-22/24/13). Solo con SCHEDULER_ENABLED=true (una instancia).
 * Idempotentes: claims atómicos de cuotas, transiciones condicionadas y `dedupeKey`.
 * - Cobra cuotas vencidas y reintentos ("3 reintentos en 7 días").
 * - Plan "En mora" a los 15 días (y suspensión si SUSPEND_ACCESS_ON_DELINQUENCY).
 * - Aviso "cuota próxima" 7 días antes.
 * - Concilia checkouts vencidos sin webhook (libera el cupo retenido).
 */
@Injectable()
export class PaymentJobsService {
  private readonly logger = new Logger(PaymentJobsService.name);
  private readonly enabled: boolean;

  constructor(
    private readonly collection: InstallmentCollectionService,
    private readonly checkout: CheckoutService,
    config: ConfigService<Env, true>,
  ) {
    this.enabled = config.get('SCHEDULER_ENABLED', { infer: true });
  }

  @Cron(BUSINESS_RULES.PAYMENT_JOBS_CRON, { name: 'payments' })
  async run(): Promise<void> {
    if (!this.enabled) return;
    try {
      const result = await this.runOnce(nowUtc());
      if (Object.values(result).some((n) => n > 0)) this.logger.log(result, 'Job de pagos');
    } catch (error) {
      this.logger.error({ err: error }, 'Job de pagos falló');
    }
  }

  /** Una corrida completa (las pruebas la llaman directamente con un `now` controlado). */
  async runOnce(now: Date): Promise<Record<string, number>> {
    const charged = await this.collection.chargeDue(now);
    const delinquent = await this.collection.markDelinquent(now);
    const upcoming = await this.collection.notifyUpcoming(now);
    const checkouts = await this.checkout.reconcileExpired(now);
    return { charged, delinquent, upcoming, checkouts };
  }
}
