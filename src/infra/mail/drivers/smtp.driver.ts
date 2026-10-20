import { createTransport, Transporter } from 'nodemailer';
import { MailDriver, MailMessage, MailSendResult } from '../mail.types';

export interface SmtpOptions {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
}

/** SMTP vía nodemailer. En desarrollo apunta a Mailpit (UI en http://localhost:8025). */
export class SmtpMailDriver implements MailDriver {
  readonly name = 'smtp' as const;
  private readonly transporter: Transporter;

  constructor(options: SmtpOptions) {
    this.transporter = createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: options.user ? { user: options.user, pass: options.password } : undefined,
    });
  }

  async send(message: MailMessage & { from: string }): Promise<MailSendResult> {
    const info = (await this.transporter.sendMail({
      from: message.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo,
    })) as { messageId?: string };
    return { driver: this.name, messageId: info.messageId };
  }
}
