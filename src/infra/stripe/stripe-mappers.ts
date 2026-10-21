import type Stripe from 'stripe';
import type {
  GatewayCard,
  GatewayCheckoutSession,
  GatewayEvent,
  GatewayPaymentIntent,
  GatewayPaymentIntentStatus,
  GatewaySetupIntent,
} from './payment-gateway';

/**
 * Conversión de objetos de Stripe (API pinned por el SDK) a los tipos del puerto `PaymentGateway`.
 * Lo usan `StripePaymentGateway` y el fake de pruebas (que firma payloads reales de Stripe).
 */

const idOf = (value: string | { id: string } | null | undefined): string | null =>
  value == null ? null : typeof value === 'string' ? value : value.id;

export function toGatewayCheckoutSession(session: Stripe.Checkout.Session): GatewayCheckoutSession {
  return {
    id: session.id,
    mode: session.mode as GatewayCheckoutSession['mode'],
    status: session.status as GatewayCheckoutSession['status'],
    paymentStatus: session.payment_status as GatewayCheckoutSession['paymentStatus'],
    paymentIntentId: idOf(session.payment_intent),
    setupIntentId: idOf(session.setup_intent),
    customerId: idOf(session.customer),
    amountTotalCents: session.amount_total ?? null,
    currency: session.currency?.toUpperCase() ?? null,
    metadata: { ...(session.metadata ?? {}) },
  };
}

function cardFromPaymentMethod(pm: Stripe.PaymentMethod | string | null): GatewayCard | null {
  if (!pm || typeof pm === 'string' || !pm.card) return null;
  return {
    brand: pm.card.brand ?? null,
    last4: pm.card.last4 ?? null,
    expMonth: pm.card.exp_month ?? null,
    expYear: pm.card.exp_year ?? null,
  };
}

function cardFromCharge(charge: Stripe.Charge | string | null): GatewayCard | null {
  if (!charge || typeof charge === 'string') return null;
  const card = charge.payment_method_details?.card;
  if (!card) return null;
  return {
    brand: card.brand ?? null,
    last4: card.last4 ?? null,
    expMonth: card.exp_month ?? null,
    expYear: card.exp_year ?? null,
  };
}

export function toGatewayPaymentIntent(pi: Stripe.PaymentIntent): GatewayPaymentIntent {
  const charge = pi.latest_charge && typeof pi.latest_charge !== 'string' ? pi.latest_charge : null;
  return {
    id: pi.id,
    status: pi.status as GatewayPaymentIntentStatus,
    amountCents: pi.amount,
    currency: pi.currency.toUpperCase(),
    customerId: idOf(pi.customer),
    paymentMethodId: idOf(pi.payment_method),
    card: cardFromPaymentMethod(pi.payment_method) ?? cardFromCharge(charge),
    chargeId: idOf(pi.latest_charge),
    receiptUrl: charge?.receipt_url ?? null,
    failureCode: pi.last_payment_error?.decline_code ?? pi.last_payment_error?.code ?? null,
    failureMessage: pi.last_payment_error?.message ?? null,
    metadata: { ...(pi.metadata ?? {}) },
  };
}

export function toGatewaySetupIntent(si: Stripe.SetupIntent): GatewaySetupIntent {
  return {
    id: si.id,
    status: si.status,
    paymentMethodId: idOf(si.payment_method),
    card: cardFromPaymentMethod(si.payment_method),
    metadata: { ...(si.metadata ?? {}) },
  };
}

/**
 * Eventos que el dominio procesa (configúralos en el endpoint del dashboard de Stripe, ver
 * docs/DEPLOY.md). El resto se registra como `ignored` (200 para que Stripe no reintente).
 */
export const HANDLED_STRIPE_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.refunded',
] as const;

export function toGatewayEvent(event: Stripe.Event): GatewayEvent {
  const base = { id: event.id, createdAt: new Date(event.created * 1000), type: event.type };
  switch (event.type) {
    case 'checkout.session.completed':
      return {
        ...base,
        kind: 'checkout.completed',
        session: toGatewayCheckoutSession(event.data.object),
      };
    case 'checkout.session.async_payment_succeeded':
      return {
        ...base,
        kind: 'checkout.async_succeeded',
        session: toGatewayCheckoutSession(event.data.object),
      };
    case 'checkout.session.async_payment_failed':
      return {
        ...base,
        kind: 'checkout.async_failed',
        session: toGatewayCheckoutSession(event.data.object),
      };
    case 'checkout.session.expired':
      return {
        ...base,
        kind: 'checkout.expired',
        session: toGatewayCheckoutSession(event.data.object),
      };
    case 'payment_intent.succeeded':
      return {
        ...base,
        kind: 'payment_intent.succeeded',
        paymentIntent: toGatewayPaymentIntent(event.data.object),
      };
    case 'payment_intent.payment_failed':
      return {
        ...base,
        kind: 'payment_intent.failed',
        paymentIntent: toGatewayPaymentIntent(event.data.object),
      };
    case 'charge.refunded': {
      const charge = event.data.object;
      return {
        ...base,
        kind: 'charge.refunded',
        charge: {
          id: charge.id,
          paymentIntentId: idOf(charge.payment_intent),
          amountCents: charge.amount,
          amountRefundedCents: charge.amount_refunded,
          refunded: charge.refunded,
        },
      };
    }
    default:
      return { ...base, kind: 'ignored' };
  }
}
