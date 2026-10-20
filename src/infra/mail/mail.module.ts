import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { ConsoleMailDriver } from './drivers/console.driver';
import { ResendMailDriver } from './drivers/resend.driver';
import { SmtpMailDriver } from './drivers/smtp.driver';
import { MailService } from './mail.service';
import { MAIL_DRIVER, MailDriver } from './mail.types';

export function createMailDriver(config: ConfigService<Env, true>): MailDriver {
  const driver = config.get('MAIL_DRIVER', { infer: true });
  switch (driver) {
    case 'smtp':
      return new SmtpMailDriver({
        host: config.get('SMTP_HOST', { infer: true }),
        port: config.get('SMTP_PORT', { infer: true }),
        secure: config.get('SMTP_SECURE', { infer: true }),
        user: config.get('SMTP_USER', { infer: true }),
        password: config.get('SMTP_PASSWORD', { infer: true }),
      });
    case 'resend':
      // env.schema garantiza que RESEND_API_KEY existe cuando MAIL_DRIVER=resend.
      return new ResendMailDriver(config.get('RESEND_API_KEY', { infer: true }) ?? '');
    case 'console':
    default:
      return new ConsoleMailDriver();
  }
}

@Global()
@Module({
  providers: [
    { provide: MAIL_DRIVER, useFactory: createMailDriver, inject: [ConfigService] },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
