import { Global, Module } from '@nestjs/common';
import { PAYMENT_GATEWAY } from './payment-gateway';
import { StripePaymentGateway } from './stripe-payment-gateway';

/**
 * Procesador de pagos (Fase 05). Expone el puerto `PAYMENT_GATEWAY` (implementación Stripe). En
 * pruebas: `overrideProvider(PAYMENT_GATEWAY).useValue(new FakePaymentGateway())`.
 */
@Global()
@Module({
  providers: [
    StripePaymentGateway,
    { provide: PAYMENT_GATEWAY, useExisting: StripePaymentGateway },
  ],
  exports: [PAYMENT_GATEWAY],
})
export class StripeModule {}
