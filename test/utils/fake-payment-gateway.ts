import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { AppException } from '../../src/common/errors/app.exception';
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
  RefundInput,
  RefundResult,
} from '../../src/infra/stripe/payment-gateway';
import { toGatewayEvent } from '../../src/infra/stripe/stripe-mappers';

export const FAKE_WEBHOOK_SECRET = 'whsec_test_fake_secret_for_e2e';

interface FakeSession {
  id: string;
  mode: 'payment' | 'setup';
  status: 'open' | 'complete' | 'expired';
  paymentStatus: 'paid' | 'unpaid' | 'no_payment_required';
  customerId: string;
  amountCents: number | null;
  currency: string;
  metadata: Record<string, string>;
  expiresAt: Date;
  paymentIntentId: string | null;
  setupIntentId: string | null;
}

interface FakeIntent {
  id: string;
  status: 'succeeded' | 'requires_payment_method' | 'processing';
  amountCents: number;
  currency: string;
  customerId: string;
  paymentMethodId: string;
  metadata: Record<string, string>;
  failureMessage: string | null;
}

/**
 * Procesador de pagos en memoria para e2e (sin llaves ni red). Las sesiones/intentos se crean aquí y
 * la prueba los "completa" con `completeSession`; los webhooks se firman con el SDK real de Stripe
 * (`generateTestHeaderString`) y se verifican con `constructEvent` → mismo camino que producción.
 *
 * Uso: `createTestApp({ customize: (b) => b.overrideProvider(PAYMENT_GATEWAY).useValue(gateway) })`.
 */
export class FakePaymentGateway implements PaymentGateway {
  configured = true;
  webhooksConfigured = true;
  readonly sessions = new Map<string, FakeSession>();
  readonly intents = new Map<string, FakeIntent>();
  /** Resultados de los próximos cobros off-session (por defecto: éxito). */
  readonly nextCharges: Array<'succeeded' | 'failed'> = [];
  readonly offSessionCalls: OffSessionChargeInput[] = [];
  /** Fase 06: resultados de los próximos reembolsos (por defecto: éxito inmediato). */
  readonly nextRefunds: Array<'succeeded' | 'pending' | 'failed'> = [];
  readonly refundCalls: RefundInput[] = [];
  private readonly refundsByKey = new Map<string, RefundResult>();
  private readonly byIdempotencyKey = new Map<string, OffSessionChargeResult>();
  private readonly stripe = new Stripe('sk_test_fake_for_signatures');
  private eventSeq = 0;

  ensureCustomer(input: { existingId: string | null; userId: string }): Promise<string> {
    return Promise.resolve(input.existingId ?? `cus_fake_${input.userId.slice(0, 8)}`);
  }

  createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSessionRef> {
    const id = `cs_test_${randomUUID().replace(/-/g, '')}`;
    this.sessions.set(id, {
      id,
      mode: input.mode,
      status: 'open',
      paymentStatus: 'unpaid',
      customerId: input.customerId,
      amountCents: input.amountCents ?? null,
      currency: input.currency.toLowerCase(),
      metadata: { ...input.metadata },
      expiresAt: input.expiresAt,
      paymentIntentId: null,
      setupIntentId: null,
    });
    return Promise.resolve({
      id,
      url: `https://checkout.stripe.test/${id}`,
      expiresAt: input.expiresAt,
    });
  }

  retrieveCheckoutSession(id: string): Promise<GatewayCheckoutSession> {
    const s = this.require(id);
    return Promise.resolve({
      id: s.id,
      mode: s.mode,
      status: s.status,
      paymentStatus: s.paymentStatus,
      paymentIntentId: s.paymentIntentId,
      setupIntentId: s.setupIntentId,
      customerId: s.customerId,
      amountTotalCents: s.amountCents,
      currency: s.currency.toUpperCase(),
      metadata: s.metadata,
    });
  }

  expireCheckoutSession(id: string): Promise<void> {
    const s = this.sessions.get(id);
    if (s && s.status === 'open') s.status = 'expired';
    return Promise.resolve();
  }

  retrievePaymentIntent(id: string): Promise<GatewayPaymentIntent> {
    const pi = this.intents.get(id);
    if (!pi) throw new AppException('PAYMENT_PROVIDER_ERROR');
    return Promise.resolve({
      id: pi.id,
      status: pi.status,
      amountCents: pi.amountCents,
      currency: pi.currency.toUpperCase(),
      customerId: pi.customerId,
      paymentMethodId: pi.paymentMethodId,
      card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030 },
      chargeId: `ch_${pi.id.slice(3)}`,
      receiptUrl: `https://pay.stripe.test/receipts/${pi.id}`,
      failureCode: null,
      failureMessage: pi.failureMessage,
      metadata: pi.metadata,
    });
  }

  retrieveSetupIntent(id: string): Promise<GatewaySetupIntent> {
    return Promise.resolve({
      id,
      status: 'succeeded',
      paymentMethodId: `pm_new_${id.slice(5, 12)}`,
      card: { brand: 'mastercard', last4: '4444', expMonth: 1, expYear: 2031 },
      metadata: {},
    });
  }

  chargeOffSession(input: OffSessionChargeInput): Promise<OffSessionChargeResult> {
    const cached = this.byIdempotencyKey.get(input.idempotencyKey);
    if (cached) return Promise.resolve(cached);
    this.offSessionCalls.push(input);
    const outcome = this.nextCharges.shift() ?? 'succeeded';
    const id = `pi_off_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    this.intents.set(id, {
      id,
      status: outcome === 'succeeded' ? 'succeeded' : 'requires_payment_method',
      amountCents: input.amountCents,
      currency: input.currency.toLowerCase(),
      customerId: input.customerId,
      paymentMethodId: input.paymentMethodId,
      metadata: input.metadata,
      failureMessage: outcome === 'failed' ? 'Tu tarjeta no tiene fondos suficientes.' : null,
    });
    const result: OffSessionChargeResult = {
      paymentIntentId: id,
      status: outcome,
      card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030 },
      chargeId: outcome === 'succeeded' ? `ch_${id.slice(3)}` : null,
      receiptUrl: outcome === 'succeeded' ? `https://pay.stripe.test/receipts/${id}` : null,
      failureCode: outcome === 'failed' ? 'insufficient_funds' : null,
      failureMessage: outcome === 'failed' ? 'Tu tarjeta no tiene fondos suficientes.' : null,
    };
    this.byIdempotencyKey.set(input.idempotencyKey, result);
    return Promise.resolve(result);
  }

  refundPayment(input: RefundInput): Promise<RefundResult> {
    const cached = this.refundsByKey.get(input.idempotencyKey);
    if (cached) return Promise.resolve(cached);
    this.refundCalls.push(input);
    const status = this.nextRefunds.shift() ?? 'succeeded';
    const result: RefundResult = {
      id: `re_fake_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      status,
      amountCents: input.amountCents,
      failureMessage: status === 'failed' ? 'El banco rechazó el reembolso.' : null,
    };
    this.refundsByKey.set(input.idempotencyKey, result);
    return Promise.resolve(result);
  }

  parseWebhookEvent(rawBody: Buffer, signature: string): GatewayEvent {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, FAKE_WEBHOOK_SECRET);
    } catch (error) {
      throw new AppException('PAYMENT_WEBHOOK_SIGNATURE_INVALID', { cause: error });
    }
    return toGatewayEvent(event);
  }

  // --- Helpers de prueba ---------------------------------------------------------------------------

  /** La persona paga en Stripe Checkout (o guarda la tarjeta en modo setup). */
  completeSession(id: string): FakeSession {
    const s = this.require(id);
    s.status = 'complete';
    if (s.mode === 'payment') {
      s.paymentStatus = 'paid';
      const piId = `pi_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
      s.paymentIntentId = piId;
      this.intents.set(piId, {
        id: piId,
        status: 'succeeded',
        amountCents: s.amountCents ?? 0,
        currency: s.currency,
        customerId: s.customerId,
        paymentMethodId: `pm_${piId.slice(3, 15)}`,
        metadata: s.metadata,
        failureMessage: null,
      });
    } else {
      s.paymentStatus = 'no_payment_required';
      s.setupIntentId = `seti_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    }
    return s;
  }

  sessionForPayment(paymentId: string): FakeSession {
    const s = [...this.sessions.values()].find((x) => x.metadata.paymentId === paymentId);
    if (!s) throw new Error(`Sin sesión para el pago ${paymentId}`);
    return s;
  }

  lastSetupSession(planId: string): FakeSession {
    const all = [...this.sessions.values()].filter(
      (x) => x.mode === 'setup' && x.metadata.planId === planId,
    );
    return all[all.length - 1];
  }

  /** Evento de Stripe (JSON real) para una sesión de Checkout. */
  checkoutEvent(type: string, sessionId: string): Record<string, unknown> {
    const s = this.require(sessionId);
    return this.event(type, {
      id: s.id,
      object: 'checkout.session',
      mode: s.mode,
      status: s.status,
      payment_status: s.paymentStatus,
      payment_intent: s.paymentIntentId,
      setup_intent: s.setupIntentId,
      customer: s.customerId,
      amount_total: s.amountCents,
      currency: s.currency,
      metadata: s.metadata,
      expires_at: Math.floor(s.expiresAt.getTime() / 1000),
      client_reference_id: s.metadata.paymentId ?? null,
    });
  }

  intentEvent(type: string, intentId: string): Record<string, unknown> {
    const pi = this.intents.get(intentId)!;
    return this.event(type, {
      id: pi.id,
      object: 'payment_intent',
      status: pi.status,
      amount: pi.amountCents,
      currency: pi.currency,
      customer: pi.customerId,
      payment_method: pi.paymentMethodId,
      latest_charge: pi.status === 'succeeded' ? `ch_${pi.id.slice(3)}` : null,
      last_payment_error: pi.failureMessage
        ? { code: 'card_declined', decline_code: 'insufficient_funds', message: pi.failureMessage }
        : null,
      metadata: pi.metadata,
    });
  }

  /** Fase 06: evento `charge.refunded` (JSON real) de un PaymentIntent. */
  chargeRefundedEvent(
    paymentIntentId: string,
    amountCents: number,
    amountRefundedCents: number,
  ): Record<string, unknown> {
    return this.event('charge.refunded', {
      id: `ch_${paymentIntentId.slice(3)}`,
      object: 'charge',
      payment_intent: paymentIntentId,
      amount: amountCents,
      amount_refunded: amountRefundedCents,
      refunded: amountRefundedCents >= amountCents,
    });
  }

  /** Cuerpo y firma `Stripe-Signature` válidos (SDK real). */
  sign(
    event: Record<string, unknown>,
    secret = FAKE_WEBHOOK_SECRET,
  ): { body: string; signature: string } {
    const body = JSON.stringify(event);
    const signature = this.stripe.webhooks.generateTestHeaderString({ payload: body, secret });
    return { body, signature };
  }

  private event(type: string, object: Record<string, unknown>): Record<string, unknown> {
    this.eventSeq++;
    return {
      id: `evt_test_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      object: 'event',
      api_version: '2026-09-30.endive',
      created: Math.floor(Date.now() / 1000) + this.eventSeq,
      type,
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
      data: { object },
    };
  }

  private require(id: string): FakeSession {
    const s = this.sessions.get(id);
    if (!s) throw new AppException('PAYMENT_PROVIDER_ERROR');
    return s;
  }
}
