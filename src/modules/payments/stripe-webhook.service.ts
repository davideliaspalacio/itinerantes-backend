import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { nowUtc } from '../../common/utils/time';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  type GatewayEvent,
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from '../../infra/stripe/payment-gateway';
import { InstallmentCollectionService } from './installment-collection.service';
import { PaymentLedgerService } from './payment-ledger.service';

export interface WebhookResult {
  received: true;
  /** El evento ya se había procesado (Stripe lo reenvió). */
  duplicate: boolean;
  /** Tipo no procesado por el dominio (se acusa recibo igual). */
  ignored: boolean;
}

/**
 * Webhook de Stripe (`POST /api/v1/webhooks/stripe`):
 * 1. Verifica la firma con el cuerpo CRUDO (`Stripe-Signature` + STRIPE_WEBHOOK_SECRET).
 * 2. Idempotencia: registra el `event.id` en `stripe_events`; si ya se procesó, responde 200 sin
 *    repetir efectos. Si el procesamiento falla, guarda el error y responde 500 (Stripe reintenta).
 * 3. Despacha al libro de pagos, cuyas transiciones condicionadas toleran eventos repetidos o fuera
 *    de orden (p. ej. `payment_intent.succeeded` antes de `checkout.session.completed`).
 */
@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: PaymentLedgerService,
    private readonly collection: InstallmentCollectionService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  async handle(rawBody: Buffer | undefined, signature: string | undefined): Promise<WebhookResult> {
    if (!this.gateway.webhooksConfigured) throw new AppException('PAYMENTS_NOT_CONFIGURED');
    if (!rawBody || !Buffer.isBuffer(rawBody) || !signature) {
      throw new AppException('PAYMENT_WEBHOOK_SIGNATURE_INVALID');
    }
    const event = this.gateway.parseWebhookEvent(rawBody, signature);

    await this.prisma.stripeEvent.createMany({
      data: [{ id: event.id, type: event.type, stripeCreatedAt: event.createdAt }],
      skipDuplicates: true,
    });
    const record = await this.prisma.stripeEvent.findUniqueOrThrow({ where: { id: event.id } });
    if (record.processedAt) return { received: true, duplicate: true, ignored: false };

    try {
      await this.dispatch(event);
    } catch (error) {
      this.logger.error({ err: error, eventId: event.id, type: event.type }, 'Webhook falló');
      await this.prisma.stripeEvent.update({
        where: { id: event.id },
        data: { error: error instanceof Error ? error.message.slice(0, 2000) : String(error) },
      });
      throw error;
    }
    await this.prisma.stripeEvent.update({
      where: { id: event.id },
      data: { processedAt: nowUtc(), error: null },
    });
    return { received: true, duplicate: false, ignored: event.kind === 'ignored' };
  }

  private async dispatch(event: GatewayEvent): Promise<void> {
    switch (event.kind) {
      case 'checkout.completed':
      case 'checkout.async_succeeded':
        if (event.session.mode === 'setup') await this.collection.applyCardUpdate(event.session);
        else await this.ledger.applyCheckoutSession(event.session);
        return;
      case 'checkout.expired':
        if (event.session.mode !== 'setup') await this.ledger.applyCheckoutSession(event.session);
        return;
      case 'checkout.async_failed':
        await this.ledger.failCheckoutPayment(event.session);
        return;
      case 'payment_intent.succeeded':
        await this.ledger.applyPaymentIntentSucceeded(event.paymentIntent);
        return;
      case 'payment_intent.failed':
        await this.ledger.applyPaymentIntentFailed(event.paymentIntent);
        return;
      case 'charge.refunded':
        await this.ledger.applyRefund(event.charge);
        return;
      case 'ignored':
        return;
    }
  }
}
