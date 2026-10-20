import type { MailDriver, MailMessage, MailSendResult } from '../../src/infra/mail/mail.types';

type SentMail = MailMessage & { from: string };

/**
 * Driver de correo para e2e: guarda los correos en memoria (no depende de Mailpit).
 * Uso: `createTestApp({ customize: (b) => b.overrideProvider(MAIL_DRIVER).useValue(mail) })`.
 */
export class MailCapture implements MailDriver {
  readonly name = 'console' as const;
  readonly messages: SentMail[] = [];

  send(message: SentMail): Promise<MailSendResult> {
    this.messages.push(message);
    return Promise.resolve({ driver: this.name });
  }

  to(email: string): SentMail[] {
    return this.messages.filter((m) => [m.to].flat().includes(email));
  }

  last(email: string): SentMail | undefined {
    return this.to(email).at(-1);
  }

  /** Último código OTP (6 dígitos) enviado a `email`. */
  lastOtp(email: string): string {
    const text = this.last(email)?.text ?? '';
    const match = /^(\d{6})$/m.exec(text);
    if (!match) throw new Error(`No hay OTP para ${email}`);
    return match[1];
  }
}
