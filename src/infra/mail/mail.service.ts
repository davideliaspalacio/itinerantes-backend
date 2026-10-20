import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { MAIL_DRIVER } from './mail.types';
import type { MailDriver, MailMessage, MailSendResult } from './mail.types';
import { EmailLayoutOptions, renderEmail } from './templates/base.template';

/**
 * Servicio de correo. Los módulos de dominio dependen SOLO de esta clase; el proveedor real
 * (console / smtp / resend) se elige con MAIL_DRIVER.
 *
 * ```ts
 * await this.mail.sendLayout('persona@correo.com', 'Tu código de verificación', {
 *   title: 'Verifica tu correo',
 *   paragraphs: [`Tu código es ${code}. Vence en 10 minutos.`],
 * });
 * ```
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly from: string;

  constructor(
    @Inject(MAIL_DRIVER) private readonly driver: MailDriver,
    config: ConfigService<Env, true>,
  ) {
    this.from = config.get('MAIL_FROM', { infer: true });
  }

  get driverName(): MailDriver['name'] {
    return this.driver.name;
  }

  async send(message: MailMessage): Promise<MailSendResult> {
    if (!message.html && !message.text) {
      throw new Error('MailService.send requiere html o text');
    }
    const result = await this.driver.send({ ...message, from: this.from });
    this.logger.log(
      { driver: result.driver, messageId: result.messageId, subject: message.subject },
      'Correo enviado',
    );
    return result;
  }

  /** Envía un correo con la plantilla base. */
  sendLayout(
    to: MailMessage['to'],
    subject: string,
    layout: EmailLayoutOptions,
  ): Promise<MailSendResult> {
    const { html, text } = renderEmail(layout);
    return this.send({ to, subject, html, text });
  }
}
