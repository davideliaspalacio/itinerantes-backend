import { Resend } from 'resend';
import { MailDriver, MailMessage, MailSendResult } from '../mail.types';

/** Resend (producción). Requiere RESEND_API_KEY y un dominio verificado en MAIL_FROM. */
export class ResendMailDriver implements MailDriver {
  readonly name = 'resend' as const;
  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(message: MailMessage & { from: string }): Promise<MailSendResult> {
    const { data, error } = await this.client.emails.send({
      from: message.from,
      to: message.to,
      subject: message.subject,
      html: message.html ?? '',
      text: message.text ?? '',
      replyTo: message.replyTo,
    });
    if (error) {
      throw new Error(`Resend: ${error.name}: ${error.message}`);
    }
    return { driver: this.name, messageId: data?.id };
  }
}
