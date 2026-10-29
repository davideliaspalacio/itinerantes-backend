import { generateKeyPairSync, verify } from 'node:crypto';
import {
  GOOGLE_CALENDAR_EVENTS_SCOPE,
  GOOGLE_TOKEN_URL,
  normalizePrivateKey,
  signServiceAccountJwt,
} from './google-jwt';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const decode = (part: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;

describe('google-jwt', () => {
  it('firma RS256 verificable con la llave pública y con los claims de la cuenta de servicio', () => {
    const jwt = signServiceAccountJwt({
      clientEmail: 'eia@proyecto.iam.gserviceaccount.com',
      privateKey: PEM,
      subject: 'agenda@escuela.org',
      scope: GOOGLE_CALENDAR_EVENTS_SCOPE,
      nowSeconds: 1_800_000_000,
    });
    const [header, claims, signature] = jwt.split('.');
    expect(decode(header)).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(decode(claims)).toEqual({
      iss: 'eia@proyecto.iam.gserviceaccount.com',
      sub: 'agenda@escuela.org',
      scope: GOOGLE_CALENDAR_EVENTS_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: 1_800_000_000,
      exp: 1_800_003_600,
    });
    const ok = verify(
      'sha256',
      Buffer.from(`${header}.${claims}`),
      publicKey,
      Buffer.from(signature, 'base64url'),
    );
    expect(ok).toBe(true);
    // Una firma alterada no verifica.
    expect(
      verify(
        'sha256',
        Buffer.from(`${header}.${claims}x`),
        publicKey,
        Buffer.from(signature, 'base64url'),
      ),
    ).toBe(false);
  });

  it('acepta la llave con \\n literales y comillas (como se pega en una variable de entorno)', () => {
    const inEnv = `"${PEM.trim().replace(/\n/g, '\\n')}"`;
    const normalized = normalizePrivateKey(inEnv);
    expect(normalized).toBe(PEM);
    expect(() =>
      signServiceAccountJwt({
        clientEmail: 'a@b.iam.gserviceaccount.com',
        privateKey: normalized,
        scope: 's',
        nowSeconds: 1,
      }),
    ).not.toThrow();
  });

  it('lanza con una llave inválida', () => {
    expect(() =>
      signServiceAccountJwt({
        clientEmail: 'a@b.iam.gserviceaccount.com',
        privateKey: '-----BEGIN PRIVATE KEY-----\nnope\n-----END PRIVATE KEY-----\n',
        scope: 's',
        nowSeconds: 1,
      }),
    ).toThrow();
  });
});
