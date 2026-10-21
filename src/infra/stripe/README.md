# infra/stripe

Fase 05 (Pagos). Adaptador del procesador de pagos detrás del puerto `PaymentGateway`
(`payment-gateway.ts`, token `PAYMENT_GATEWAY`):

- `stripe-payment-gateway.ts`: implementación con el SDK oficial `stripe` (versión exacta fijada en
  `package.json`; la versión de API la fija el SDK). Checkout Sessions (`payment` y `setup`),
  PaymentIntents off-session para las cuotas y verificación de webhooks (`constructEvent` con el raw
  body y `STRIPE_WEBHOOK_SECRET`).
- `stripe-mappers.ts`: convierte objetos/eventos de Stripe a los tipos del puerto (lo reutiliza el
  fake de pruebas `test/utils/fake-payment-gateway.ts`, que firma payloads reales de Stripe).
- Sin `STRIPE_SECRET_KEY` la app arranca: `configured = false` y los checkouts responden
  `503 PAYMENTS_NOT_CONFIGURED`. Sin `STRIPE_WEBHOOK_SECRET` el webhook responde 503.

Configuración y pruebas con `stripe listen`: `docs/DEPLOY.md` → "Stripe".
