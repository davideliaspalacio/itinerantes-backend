import { Logger } from '@nestjs/common';
import { MailDriver, MailMessage, MailSendResult } from '../mail.types';

/** Driver de desarrollo/pruebas: no envía nada, solo registra el correo en el log. */
export class ConsoleMailDriver implements MailDriver {
  readonly name = 'console' as const;
  private readonly logger = new Logger('Mail:console');

  send(message: MailMessage & { from: string }): Promise<MailSendResult> {
    this.logger.log(
      { to: message.to, subject: message.subject, text: message.text },
      `Correo (no enviado): ${message.subject}`,
    );
    return Promise.resolve({ driver: this.name });
  }
}
