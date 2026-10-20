import { ConfigService } from '@nestjs/config';
import { CaptchaService } from './captcha.service';

function service(secret: string | undefined, fetchFn?: jest.Mock): CaptchaService {
  const config = { get: jest.fn().mockReturnValue(secret) } as unknown as ConfigService<
    never,
    true
  >;
  return new CaptchaService(config, fetchFn);
}

describe('CaptchaService', () => {
  it('sin clave está desactivado y acepta todo', async () => {
    const captcha = service(undefined);
    expect(captcha.enabled).toBe(false);
    await expect(captcha.verify(undefined)).resolves.toBe(true);
  });

  it('con clave exige token', async () => {
    await expect(service('secret', jest.fn()).verify(undefined)).resolves.toBe(false);
  });

  it('con clave consulta a Turnstile', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ json: () => Promise.resolve({ success: true }) });
    await expect(service('secret', fetchFn).verify('token', '1.2.3.4')).resolves.toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('falla cerrado si Turnstile no responde', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('timeout'));
    const captcha = service('secret', fetchFn);
    jest.spyOn(captcha['logger'], 'error').mockImplementation(() => undefined);
    await expect(captcha.verify('token')).resolves.toBe(false);
  });
});
