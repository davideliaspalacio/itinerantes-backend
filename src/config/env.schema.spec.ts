import { envSchema } from './env.schema';

const BASE = {
  DATABASE_URL: 'postgresql://x:y@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(40),
};

const PEM = '-----BEGIN PRIVATE KEY-----\\nMIIE\\n-----END PRIVATE KEY-----\\n';

describe('envSchema — proveedores de reuniones', () => {
  it('sin variables de Zoom ni Google la configuración es válida (proveedores deshabilitados)', () => {
    const result = envSchema.safeParse(BASE);
    expect(result.success).toBe(true);
    expect(result.data?.ZOOM_ACCOUNT_ID).toBeUndefined();
  });

  it('acepta cada proveedor completo (los opcionales pueden faltar)', () => {
    const result = envSchema.safeParse({
      ...BASE,
      ZOOM_ACCOUNT_ID: 'a',
      ZOOM_CLIENT_ID: 'b',
      ZOOM_CLIENT_SECRET: 'c',
      GOOGLE_MEET_SERVICE_ACCOUNT_EMAIL: 'sa@p.iam.gserviceaccount.com',
      GOOGLE_MEET_PRIVATE_KEY: PEM,
      GOOGLE_MEET_IMPERSONATE_USER: 'agenda@escuela.org',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza un proveedor a medias y señala las variables que faltan', () => {
    const result = envSchema.safeParse({
      ...BASE,
      ZOOM_ACCOUNT_ID: 'a',
      ZOOM_CLIENT_SECRET: '',
      GOOGLE_MEET_IMPERSONATE_USER: 'agenda@escuela.org',
    });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((issue) => issue.path.join('.')).sort();
    expect(paths).toEqual([
      'GOOGLE_MEET_PRIVATE_KEY',
      'GOOGLE_MEET_SERVICE_ACCOUNT_EMAIL',
      'ZOOM_CLIENT_ID',
      'ZOOM_CLIENT_SECRET',
    ]);
  });

  it('la llave de Google debe ser PEM', () => {
    const result = envSchema.safeParse({
      ...BASE,
      GOOGLE_MEET_SERVICE_ACCOUNT_EMAIL: 'sa@p.iam.gserviceaccount.com',
      GOOGLE_MEET_PRIVATE_KEY: 'no-es-una-llave',
      GOOGLE_MEET_IMPERSONATE_USER: 'agenda@escuela.org',
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].path).toEqual(['GOOGLE_MEET_PRIVATE_KEY']);
  });
});
