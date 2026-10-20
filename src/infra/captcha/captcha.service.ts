import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verificación de captcha (Cloudflare Turnstile). Desactivada si falta TURNSTILE_SECRET_KEY:
 * entonces `verify` siempre devuelve true y el token es opcional.
 */
@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);
  private readonly secret?: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly fetchFn: typeof fetch = fetch,
  ) {
    this.secret = config.get('TURNSTILE_SECRET_KEY', { infer: true });
  }

  get enabled(): boolean {
    return !!this.secret;
  }

  async verify(token: string | undefined, remoteIp?: string): Promise<boolean> {
    if (!this.secret) return true;
    if (!token) return false;
    try {
      const body = new URLSearchParams({ secret: this.secret, response: token });
      if (remoteIp) body.set('remoteip', remoteIp);
      const response = await this.fetchFn(TURNSTILE_VERIFY_URL, {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(5000),
      });
      const result = (await response.json()) as { success?: boolean; 'error-codes'?: string[] };
      if (!result.success) {
        this.logger.warn({ errors: result['error-codes'] }, 'Captcha rechazado');
      }
      return result.success === true;
    } catch (error) {
      // Si Cloudflare no responde, se rechaza (falla cerrado): el honeypot y el rate limit siguen activos.
      this.logger.error({ err: error }, 'No se pudo verificar el captcha');
      return false;
    }
  }
}
