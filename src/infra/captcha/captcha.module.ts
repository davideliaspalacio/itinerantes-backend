import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { CaptchaService } from './captcha.service';

@Global()
@Module({
  providers: [
    {
      provide: CaptchaService,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => new CaptchaService(config),
    },
  ],
  exports: [CaptchaService],
})
export class CaptchaModule {}
