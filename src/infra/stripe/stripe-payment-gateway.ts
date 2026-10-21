import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { AppException } from '../../common/errors/app.exception';
import type { Env } from '../../config/env.schema';
import type {
  CheckoutSessionRef,
  CreateCheckoutInput,
  GatewayCheckoutSession,
  GatewayEvent,
  GatewayPaymentIntent,
  GatewaySetupIntent,
  OffSessionChargeInput,
  OffSessionChargeResult,
  PaymentGateway,
} from './payment-gateway';
import {
  toGatewayCheckoutSession,
  toGatewayEvent,
  toGatewayPaymentIntent,
  toGatewaySetupIntent,
} from './stripe-mappers';

/**
 * Implementación real del puerto `PaymentGateway` con el SDK oficial `stripe` (versión exacta en
 * package.json; la versión de API es la que fija el SDK). Sin STRIPE_SECRET_KEY la app arranca y
 * `configured = false`: el dominio responde 503 PAYMENTS_NOT_CONFIGURED antes de llegar aquí.
 */
@Injectable()
export class StripePaymentGateway implements PaymentGateway {
  private readonly logger = new Logger(StripePaymentGateway.name);
  private readonly stripe: Stripe | null;
  private readonly webhookSecret: string | undefined;

  constructor(config: ConfigService<Env, true>) {
    const secretKey = config.get('STRIPE_SECRET_KEY', { infer: true });
    this.webhookSecret = config.get('STRIPE_WEBHOOK_SECRET', { infer: true });
    this.stripe = secretKey
      ? new Stripe(secretKey, {
          maxNetworkRetries: 2,
          timeout: 20_000,
          appInfo: { name: 'escuela-itinerante-del-agua-backend' },
        })
      : null;
  }

  get configured(): boolean {
    return this.stripe !== null;
  }

  get webhooksConfigured(): boolean {
    return !!this.webhookSecret;
  }

  async ensureCustomer(input: {
    existingId: string | null;
    userId: string;
    email: string;
    name: string;
  }): Promise<string> {
    if (input.existingId) return input.existingId;
    const customer = await this.call(() =>
      this.client.customers.create(
        { email: input.email, name: input.name, metadata: { userId: input.userId } },
        { idempotencyKey: `customer:${input.userId}` },
      ),
    );
    return customer.id;
  }

  async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSessionRef> {
    const currency = input.currency.toLowerCase();
    const params: Stripe.Checkout.SessionCreateParams =
      input.mode === 'setup'
        ? {
            mode: 'setup',
            customer: input.customerId,
            currency,
            allowed_payment_method_types: ['card'],
            setup_intent_data: { metadata: input.metadata },
          }
        : {
            mode: 'payment',
            customer: input.customerId,
            allowed_payment_method_types: ['card'],
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency,
                  unit_amount: input.amountCents,
                  product_data: {
                    name: input.productName ?? 'Pago',
                    ...(input.description ? { description: input.description } : {}),
                  },
                },
              },
            ],
            payment_intent_data: {
              metadata: input.metadata,
              ...(input.saveCardForFutureUsage ? { setup_future_usage: 'off_session' } : {}),
              ...(input.description ? { description: input.description } : {}),
            },
          };
    const session = await this.call(() =>
      this.client.checkout.sessions.create(
        {
          ...params,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          expires_at: Math.floor(input.expiresAt.getTime() / 1000),
          metadata: input.metadata,
          locale: 'es-419',
          ...(input.clientReferenceId ? { client_reference_id: input.clientReferenceId } : {}),
        },
        { idempotencyKey: input.idempotencyKey },
      ),
    );
    if (!session.url) throw new AppException('PAYMENT_PROVIDER_ERROR');
    return { id: session.id, url: session.url, expiresAt: new Date(session.expires_at * 1000) };
  }

  async retrieveCheckoutSession(id: string): Promise<GatewayCheckoutSession> {
    const session = await this.call(() => this.client.checkout.sessions.retrieve(id));
    return toGatewayCheckoutSession(session);
  }

  async expireCheckoutSession(id: string): Promise<void> {
    try {
      await this.client.checkout.sessions.expire(id);
    } catch (error) {
      // Ya completada o vencida: no hay nada que cerrar.
      this.logger.warn({ err: error, sessionId: id }, 'No se pudo expirar la sesión de Checkout');
    }
  }

  async retrievePaymentIntent(id: string): Promise<GatewayPaymentIntent> {
    const pi = await this.call(() =>
      this.client.paymentIntents.retrieve(id, { expand: ['payment_method', 'latest_charge'] }),
    );
    return toGatewayPaymentIntent(pi);
  }

  async retrieveSetupIntent(id: string): Promise<GatewaySetupIntent> {
    const si = await this.call(() =>
      this.client.setupIntents.retrieve(id, { expand: ['payment_method'] }),
    );
    return toGatewaySetupIntent(si);
  }

  async chargeOffSession(input: OffSessionChargeInput): Promise<OffSessionChargeResult> {
    try {
      const pi = await this.client.paymentIntents.create(
        {
          amount: input.amountCents,
          currency: input.currency.toLowerCase(),
          customer: input.customerId,
          payment_method: input.paymentMethodId,
          off_session: true,
          confirm: true,
          description: input.description,
          metadata: input.metadata,
          expand: ['payment_method', 'latest_charge'],
        },
        { idempotencyKey: input.idempotencyKey },
      );
      const mapped = toGatewayPaymentIntent(pi);
      return {
        paymentIntentId: pi.id,
        status:
          pi.status === 'succeeded'
            ? 'succeeded'
            : pi.status === 'processing'
              ? 'processing'
              : 'failed',
        card: mapped.card,
        chargeId: mapped.chargeId,
        receiptUrl: mapped.receiptUrl,
        failureCode: mapped.failureCode,
        failureMessage:
          pi.status === 'requires_action'
            ? 'El banco pidió autenticación (3-D Secure): actualiza tu tarjeta para continuar.'
            : mapped.failureMessage,
      };
    } catch (error) {
      // Tarjeta rechazada / requiere autenticación: Stripe lanza StripeCardError con el PI.
      if (error instanceof Stripe.errors.StripeCardError) {
        const raw = error.raw as { payment_intent?: { id?: string } } | undefined;
        return {
          paymentIntentId: raw?.payment_intent?.id ?? null,
          status: 'failed',
          card: null,
          chargeId: null,
          receiptUrl: null,
          failureCode: error.decline_code ?? error.code ?? null,
          failureMessage: error.message,
        };
      }
      throw this.providerError(error);
    }
  }

  parseWebhookEvent(rawBody: Buffer, signature: string): GatewayEvent {
    if (!this.webhookSecret) throw new AppException('PAYMENTS_NOT_CONFIGURED');
    let event: Stripe.Event;
    try {
      // La verificación no hace llamadas de red; basta un cliente sin llave si falta la secreta.
      event = (this.stripe ?? new Stripe('sk_unconfigured')).webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch (error) {
      throw new AppException('PAYMENT_WEBHOOK_SIGNATURE_INVALID', { cause: error });
    }
    return toGatewayEvent(event);
  }

  // ------------------------------------------------------------------------------------------------

  private get client(): Stripe {
    if (!this.stripe) throw new AppException('PAYMENTS_NOT_CONFIGURED');
    return this.stripe;
  }

  private async call<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      throw this.providerError(error);
    }
  }

  private providerError(error: unknown): AppException {
    if (error instanceof AppException) return error;
    this.logger.error({ err: error }, 'Error de Stripe');
    return new AppException('PAYMENT_PROVIDER_ERROR', { cause: error });
  }
}
