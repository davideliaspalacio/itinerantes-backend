import { Module } from '@nestjs/common';
import { ApplicationsModule } from '../applications/applications.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminPaymentPlansService } from './admin/admin-payment-plans.service';
import { AdminPaymentsController } from './admin/admin-payments.controller';
import { AdminPaymentsService } from './admin/admin-payments.service';
import { CheckoutService } from './checkout.service';
import { InstallmentCollectionService } from './installment-collection.service';
import { PaymentJobsService } from './payment-jobs.service';
import { PaymentLedgerService } from './payment-ledger.service';
import { PaymentsController } from './payments.controller';
import { PaymentsQueryService } from './payments-query.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';
import { TransfersService } from './transfers.service';

/**
 * Pagos (Fase 05: HU-22, 23, 24, 26 + "Mis pagos" de HU-14). Dependencias en un solo sentido:
 * `payments` → (`applications`, `enrollments`, `notifications`) + puerto `PAYMENT_GATEWAY`
 * (`StripeModule`, global). `dashboard` importa este módulo (nunca al revés).
 * - `CheckoutService`: pantalla de pago, Stripe Checkout, actualizar tarjeta, conciliación.
 * - `PaymentLedgerService`: aplica resultados (idempotente) e inscribe.
 * - `InstallmentCollectionService`: cobro off-session de cuotas, reintentos, mora, avisos.
 * - `TransfersService`: comprobantes (participante) y `approveTransfer`/`rejectTransfer` (Fase 06).
 * - `PaymentsQueryService`: Mis pagos, recibo PDF y bloque del Dashboard.
 * - `StripeWebhookService` + `PaymentJobsService`.
 * - Fase 06 (HU-33): panel `/admin/payments|transfers|payment-plans|refunds` (`admin/`).
 */
@Module({
  imports: [ApplicationsModule, EnrollmentsModule, NotificationsModule],
  controllers: [PaymentsController, StripeWebhookController, AdminPaymentsController],
  providers: [
    CheckoutService,
    PaymentLedgerService,
    InstallmentCollectionService,
    TransfersService,
    PaymentsQueryService,
    StripeWebhookService,
    PaymentJobsService,
    AdminPaymentsService,
    AdminPaymentPlansService,
  ],
  exports: [
    CheckoutService,
    PaymentLedgerService,
    InstallmentCollectionService,
    TransfersService,
    PaymentsQueryService,
    PaymentJobsService,
  ],
})
export class PaymentsModule {}
