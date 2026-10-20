import { z } from 'zod';

/**
 * Esquema de variables de entorno. Se valida al arrancar (ConfigModule.validate):
 * si falta algo obligatorio la app no inicia y el error lista las variables inválidas.
 *
 * Para agregar una variable: añádela aquí, en `.env.example` (documentada) y, si aplica,
 * en `.env.test`. Léela con `ConfigService<Env, true>`: `config.get('PORT', { infer: true })`.
 */

/** Convierte "a,b , c" en ['a','b','c'] (vacíos descartados). */
const csv = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

/** Booleano desde texto ("true"/"false"/"1"/"0"). */
const bool = (defaultValue: boolean) =>
  z
    .enum(['true', 'false', '1', '0'])
    .default(defaultValue ? 'true' : 'false')
    .transform((value) => value === 'true' || value === '1');

/** Cadena opcional: trata "" como ausente. */
const optionalString = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() !== '' ? value : undefined));

export const envSchema = z
  .object({
    // --- App ---
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    /** URL pública de esta API (enlaces en correos, servidor en OpenAPI). */
    APP_PUBLIC_URL: z.url().default('http://localhost:3000'),
    /** URL del frontend (enlaces en correos: verificar, recuperar contraseña, etc.). */
    FRONTEND_URL: z.url().default('http://localhost:5173'),
    /** Orígenes permitidos por CORS, separados por coma. Vacío = ninguno (solo mismo origen). */
    CORS_ORIGINS: csv,
    /** Activa /docs y /docs/openapi.json. */
    DOCS_ENABLED: bool(true),

    // --- Rate limit global (por IP) ---
    THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),

    // --- Base de datos ---
    /** Conexión de la app (en Supabase puede ser el pooler). */
    DATABASE_URL: z.string().min(1),
    /** Conexión para migraciones (directa / session pooler). Opcional. */
    DIRECT_URL: optionalString,

    // --- Auth (se usa desde la Fase 01) ---
    JWT_ACCESS_SECRET: z.string().min(32, 'Debe tener al menos 32 caracteres'),
    /** Vida del token de acceso: segundos o número con unidad s/m/h/d (`900`, `15m`, `1h`). */
    JWT_ACCESS_TTL: z
      .string()
      .regex(/^\d+[smhd]?$/, 'Formato: número de segundos o con unidad s/m/h/d (p. ej. 15m)')
      .default('15m'),
    /** Vida del refresh token (días) sin / con "recordarme". */
    JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
    JWT_REFRESH_REMEMBER_TTL_DAYS: z.coerce.number().int().positive().default(30),

    // --- Correo ---
    MAIL_DRIVER: z.enum(['console', 'smtp', 'resend']).default('console'),
    MAIL_FROM: z.string().default('Escuela Itinerante del Agua <no-reply@example.com>'),
    /** Buzón del equipo para notificaciones internas generales. */
    MAIL_TEAM_INBOX: optionalString,
    /** Buzón que recibe los mensajes de Contacto (HU-38). Si falta, se usa MAIL_TEAM_INBOX. */
    CONTACT_INBOX_EMAIL: optionalString,

    // --- Anti-spam / privacidad ---
    /** Clave secreta de Cloudflare Turnstile. Si falta, la verificación de captcha está desactivada. */
    TURNSTILE_SECRET_KEY: optionalString,
    /** Secreto para el HMAC de IPs guardadas (Contacto). Si falta, se deriva de JWT_ACCESS_SECRET. */
    IP_HASH_SECRET: optionalString,
    SMTP_HOST: z.string().default('localhost'),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),
    SMTP_SECURE: bool(false),
    SMTP_USER: optionalString,
    SMTP_PASSWORD: optionalString,
    RESEND_API_KEY: optionalString,

    // --- Almacenamiento S3 (MinIO / Supabase Storage / R2) ---
    STORAGE_ENDPOINT: optionalString,
    STORAGE_REGION: z.string().default('us-east-1'),
    STORAGE_BUCKET: z.string().default('eia-dev'),
    STORAGE_ACCESS_KEY_ID: z.string().default(''),
    STORAGE_SECRET_ACCESS_KEY: z.string().default(''),
    /** MinIO y Supabase Storage requieren path-style. */
    STORAGE_FORCE_PATH_STYLE: bool(true),
    STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),

    // --- Stripe (Fase 05; opcionales por ahora) ---
    STRIPE_SECRET_KEY: optionalString,
    STRIPE_WEBHOOK_SECRET: optionalString,
    STRIPE_PUBLISHABLE_KEY: optionalString,
  })
  .superRefine((env, ctx) => {
    if (env.MAIL_DRIVER === 'resend' && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['RESEND_API_KEY'],
        message: 'Obligatoria cuando MAIL_DRIVER=resend',
      });
    }
  });

export type Env = z.output<typeof envSchema>;

/** Validador para ConfigModule.forRoot({ validate }). Lanza un error legible si algo falla. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${issues}`);
  }
  return result.data;
}
