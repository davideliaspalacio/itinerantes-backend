import { createPrivateKey, sign } from 'node:crypto';

/**
 * JWT de cuenta de servicio de Google (flujo "JWT bearer", RFC 7523) firmado con RS256 usando solo
 * `node:crypto` (sin SDK de Google). Funciones PURAS: la hora se recibe como parámetro.
 *
 * https://developers.google.com/identity/protocols/oauth2/service-account#httprest
 */

export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_CALENDAR_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
/** Vida máxima que Google acepta para la aserción. */
export const GOOGLE_ASSERTION_TTL_SECONDS = 3600;

export function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

/**
 * Normaliza la llave PEM de una variable de entorno: acepta `\n` literales (como viene en el JSON de
 * la cuenta de servicio pegado en una sola línea), comillas envolventes y `\r\n`.
 */
export function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return `${key.replace(/\\r/g, '').replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim()}\n`;
}

export interface ServiceAccountJwtInput {
  /** Correo de la cuenta de servicio (`iss`). */
  clientEmail: string;
  /** Llave PEM (PKCS#8 o PKCS#1). */
  privateKey: string;
  /** Usuario suplantado con delegación de dominio (`sub`). */
  subject?: string;
  scope: string;
  audience?: string;
  /** Hora actual en segundos UNIX (`iat`). */
  nowSeconds: number;
  ttlSeconds?: number;
}

/** Firma la aserción `header.claims.signature` (RS256). Lanza si la llave no es válida. */
export function signServiceAccountJwt(input: ServiceAccountJwtInput): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims: Record<string, string | number> = {
    iss: input.clientEmail,
    scope: input.scope,
    aud: input.audience ?? GOOGLE_TOKEN_URL,
    iat: input.nowSeconds,
    exp: input.nowSeconds + (input.ttlSeconds ?? GOOGLE_ASSERTION_TTL_SECONDS),
  };
  if (input.subject) claims.sub = input.subject;
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const key = createPrivateKey(input.privateKey);
  const signature = sign('sha256', Buffer.from(unsigned), key);
  return `${unsigned}.${base64url(signature)}`;
}
