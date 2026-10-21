/**
 * Puerto hacia el procesador de pagos (Stripe). El dominio (src/modules/payments) solo conoce esta
 * interfaz: la implementación real es `StripePaymentGateway` y las pruebas usan un fake
 * (`test/utils/fake-payment-gateway.ts`). Todos los montos van en centavos enteros.
 *
 * Inyección: `@Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway`.
 */

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export type GatewayCurrency = 'MXN' | 'USD';

export interface GatewayCard {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
}

export interface CreateCheckoutInput {
  /** `payment`: cobra `amountCents`; `setup`: solo guarda una tarjeta nueva ("Actualizar tarjeta"). */
  mode: 'payment' | 'setup';
  customerId: string;
  currency: GatewayCurrency;
  /** Obligatorio en `payment`. */
  amountCents?: number;
  /** Concepto visible en Stripe Checkout. */
  productName?: string;
  description?: string;
  successUrl: string;
  cancelUrl: string;
  expiresAt: Date;
  /** Guardar la tarjeta para cobros off-session (1.ª cuota de un plan). */
  saveCardForFutureUsage?: boolean;
  /** Se copia a la sesión y al PaymentIntent/SetupIntent (`paymentId`, `planId`, ...). */
  metadata: Record<string, string>;
  /** `client_reference_id` (id del pago). */
  clientReferenceId?: string;
  idempotencyKey: string;
}

export interface CheckoutSessionRef {
  id: string;
  url: string;
  expiresAt: Date;
}

export interface GatewayCheckoutSession {
  id: string;
  mode: 'payment' | 'setup' | 'subscription';
  /** `open` | `complete` | `expired` */
  status: 'open' | 'complete' | 'expired' | null;
  /** `paid` | `unpaid` | `no_payment_required` */
  paymentStatus: 'paid' | 'unpaid' | 'no_payment_required';
  paymentIntentId: string | null;
  setupIntentId: string | null;
  customerId: string | null;
  amountTotalCents: number | null;
  currency: string | null;
  metadata: Record<string, string>;
}

export type GatewayPaymentIntentStatus =
  | 'succeeded'
  | 'processing'
  | 'requires_action'
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_capture'
  | 'canceled';

export interface GatewayPaymentIntent {
  id: string;
  status: GatewayPaymentIntentStatus;
  amountCents: number;
  currency: string;
  customerId: string | null;
  paymentMethodId: string | null;
  card: GatewayCard | null;
  chargeId: string | null;
  receiptUrl: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  metadata: Record<string, string>;
}

export interface GatewaySetupIntent {
  id: string;
  status: string;
  paymentMethodId: string | null;
  card: GatewayCard | null;
  metadata: Record<string, string>;
}

export interface OffSessionChargeInput {
  customerId: string;
  paymentMethodId: string;
  amountCents: number;
  currency: GatewayCurrency;
  description: string;
  metadata: Record<string, string>;
  /** Misma clave = mismo PaymentIntent (reintentar tras una caída no cobra dos veces). */
  idempotencyKey: string;
}

/** Resultado de un cobro off-session: nunca lanza por tarjeta rechazada (eso es `failed`). */
export interface OffSessionChargeResult {
  paymentIntentId: string | null;
  status: 'succeeded' | 'processing' | 'failed';
  card: GatewayCard | null;
  chargeId: string | null;
  receiptUrl: string | null;
  failureCode: string | null;
  failureMessage: string | null;
}

/** Fase 06 (HU-33): reembolso total o parcial de un cobro con tarjeta. */
export interface RefundInput {
  paymentIntentId: string;
  /** Monto a reembolsar (centavos, ≤ lo cobrado y no reembolsado). */
  amountCents: number;
  /** Se copia a la metadata del Refund (`paymentId`, `refundId`, `reason`…). */
  metadata: Record<string, string>;
  /** Misma clave = mismo Refund (un doble clic o un reintento no reembolsa dos veces). */
  idempotencyKey: string;
}

/** Resultado del reembolso: `pending` = en proceso en Stripe (se confirma con `charge.refunded`). */
export interface RefundResult {
  id: string;
  status: 'pending' | 'succeeded' | 'failed';
  amountCents: number;
  failureMessage: string | null;
}

/** Evento de webhook ya verificado y normalizado (solo los que el dominio procesa). */
export type GatewayEvent = { id: string; createdAt: Date; type: string } & (
  | {
      kind: 'checkout.completed' | 'checkout.async_succeeded' | 'checkout.async_failed';
      session: GatewayCheckoutSession;
    }
  | { kind: 'checkout.expired'; session: GatewayCheckoutSession }
  | {
      kind: 'payment_intent.succeeded' | 'payment_intent.failed';
      paymentIntent: GatewayPaymentIntent;
    }
  | {
      kind: 'charge.refunded';
      charge: {
        id: string;
        paymentIntentId: string | null;
        amountCents: number;
        amountRefundedCents: number;
        refunded: boolean;
      };
    }
  | { kind: 'ignored' }
);

export interface PaymentGateway {
  /** `false` sin STRIPE_SECRET_KEY: los checkouts responden 503 PAYMENTS_NOT_CONFIGURED. */
  readonly configured: boolean;
  /** `false` sin STRIPE_WEBHOOK_SECRET: el webhook responde 503. */
  readonly webhooksConfigured: boolean;

  /** Crea (o reutiliza `existingId`) el cliente de Stripe de la persona. */
  ensureCustomer(input: {
    existingId: string | null;
    userId: string;
    email: string;
    name: string;
  }): Promise<string>;

  createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSessionRef>;
  retrieveCheckoutSession(id: string): Promise<GatewayCheckoutSession>;
  /** Cierra una sesión abierta (idempotente: si ya terminó, no falla). */
  expireCheckoutSession(id: string): Promise<void>;

  retrievePaymentIntent(id: string): Promise<GatewayPaymentIntent>;
  retrieveSetupIntent(id: string): Promise<GatewaySetupIntent>;
  /** Cobra una cuota con la tarjeta guardada sin la persona presente (off_session). */
  chargeOffSession(input: OffSessionChargeInput): Promise<OffSessionChargeResult>;

  /**
   * Fase 06 (HU-33): reembolsa (total o parcial) un PaymentIntent cobrado. Nunca lanza por un
   * reembolso rechazado (eso es `failed`); sí lanza PAYMENT_PROVIDER_ERROR si Stripe no responde.
   */
  refundPayment(input: RefundInput): Promise<RefundResult>;

  /** Verifica la firma (`Stripe-Signature`) con el cuerpo CRUDO y normaliza el evento. */
  parseWebhookEvent(rawBody: Buffer, signature: string): GatewayEvent;
}
