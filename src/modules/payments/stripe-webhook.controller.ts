import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { ApiErrorResponses } from '../../common/swagger/api-error-responses.decorator';
import { HANDLED_STRIPE_EVENTS } from '../../infra/stripe/stripe-mappers';
import { StripeWebhookService, type WebhookResult } from './stripe-webhook.service';

/** Ruta del webhook (sin prefijo): `app.setup.ts` conserva el cuerpo crudo SOLO aquí. */
export const STRIPE_WEBHOOK_PATH = 'webhooks/stripe';

@ApiTags('Webhooks')
@Controller(STRIPE_WEBHOOK_PATH)
export class StripeWebhookController {
  constructor(private readonly webhooks: StripeWebhookService) {}

  @Post()
  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Webhook de Stripe (no lo llama el frontend)',
    description:
      'Endpoint para Stripe (configúralo en Dashboard → Developers → Webhooks; ver docs/DEPLOY.md). ' +
      'Verifica la firma `Stripe-Signature` con el cuerpo CRUDO y `STRIPE_WEBHOOK_SECRET` ' +
      '(firma inválida → 400 `PAYMENT_WEBHOOK_SIGNATURE_INVALID`). Idempotente (tabla ' +
      '`stripe_events`) y tolerante a eventos fuera de orden. Eventos procesados: ' +
      HANDLED_STRIPE_EVENTS.join(', ') +
      '. Otros tipos → 200 `ignored: true`. Error interno → 500 (Stripe reintenta). Sin ' +
      '`STRIPE_WEBHOOK_SECRET` → 503 `PAYMENTS_NOT_CONFIGURED`.',
  })
  @ApiHeader({ name: 'Stripe-Signature', required: true, description: 'Firma de Stripe.' })
  @ApiBody({
    description: 'Evento de Stripe (JSON crudo, sin modificar).',
    schema: {
      type: 'object',
      example: { id: 'evt_123', type: 'checkout.session.completed', data: { object: {} } },
    },
  })
  @ApiOkResponse({
    description: 'Recibido.',
    schema: {
      type: 'object',
      properties: {
        received: { type: 'boolean', example: true },
        duplicate: { type: 'boolean', example: false },
        ignored: { type: 'boolean', example: false },
      },
    },
  })
  @ApiErrorResponses(
    'PAYMENT_WEBHOOK_SIGNATURE_INVALID',
    'INTERNAL_ERROR',
    'PAYMENTS_NOT_CONFIGURED',
  )
  handle(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<WebhookResult> {
    return this.webhooks.handle(req.body as Buffer | undefined, signature);
  }
}
