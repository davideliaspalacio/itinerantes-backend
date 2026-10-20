import { hmacSha256Hex, maskEmail, randomNumericCode, safeEqual, sha256Hex } from './crypto';

describe('crypto utils', () => {
  it('randomNumericCode genera solo dígitos con la longitud pedida', () => {
    for (let i = 0; i < 50; i++) {
      expect(randomNumericCode(6)).toMatch(/^\d{6}$/);
    }
  });

  it('hash y hmac son deterministas', () => {
    expect(sha256Hex('a')).toBe(sha256Hex('a'));
    expect(hmacSha256Hex('k', 'a')).not.toBe(hmacSha256Hex('k2', 'a'));
  });

  it('safeEqual compara en tiempo constante', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('maskEmail deja la primera letra y el dominio', () => {
    expect(maskEmail('juana@correo.com')).toBe('j***@correo.com');
  });
});
