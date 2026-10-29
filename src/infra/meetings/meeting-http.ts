import { Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { BUSINESS_RULES } from '../../config/business-rules';
import type { MeetingProvider } from './meeting-gateway';

/**
 * Cliente HTTP mínimo para los proveedores de reuniones: `fetch` nativo con tiempo límite
 * (`AbortSignal.timeout`) y errores traducidos a `AppException`. Nunca registra cuerpos de
 * peticiones, encabezados ni tokens: solo método, ruta, status y el mensaje de error del proveedor.
 */

export type FetchFn = typeof fetch;

/** Dependencias inyectables (las pruebas pasan `now` y `sleep` controlados). */
export interface MeetingProviderDeps {
  /** Por defecto `globalThis.fetch` (resuelto en cada llamada: las pruebas lo pueden simular). */
  fetch?: FetchFn;
  /** Reloj en milisegundos (por defecto `Date.now`). */
  now?: () => number;
  /** Espera entre reintentos (por defecto `setTimeout`). */
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
}

export interface HttpResult {
  status: number;
  ok: boolean;
  /** JSON del cuerpo, o `null` si viene vacío o no es JSON. */
  body: unknown;
}

const logger = new Logger('MeetingProviderHttp');

export const DEFAULT_MEETING_TIMEOUT_MS = BUSINESS_RULES.MEETING_PROVIDER_TIMEOUT_SECONDS * 1000;

export const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** 502 `MEETING_PROVIDER_ERROR` (mensaje para la UI fijo; el detalle va a los logs). */
export function meetingProviderError(provider: MeetingProvider, reason: string): AppException {
  return new AppException('MEETING_PROVIDER_ERROR', {
    meta: { provider },
    cause: new Error(`${provider}: ${reason}`),
  });
}

/** Ruta sin query (la query de los tokens no es secreta, pero no aporta al log). */
function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return '(url inválida)';
  }
}

/** Mensaje de error que devuelven Zoom (`message`) o Google (`error.message` / `error_description`). */
export function providerErrorMessage(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const record = body as Record<string, unknown>;
  if (typeof record.message === 'string') return record.message;
  if (typeof record.error_description === 'string') return record.error_description;
  const error = record.error;
  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === 'string') return message;
  }
  if (typeof error === 'string') return error;
  return undefined;
}

export async function requestJson(
  provider: MeetingProvider,
  url: string,
  init: RequestInit,
  deps: MeetingProviderDeps,
): Promise<HttpResult> {
  const fetchFn = deps.fetch ?? globalThis.fetch;
  const method = init.method ?? 'GET';
  let response: Response;
  try {
    response = await fetchFn(url, {
      ...init,
      signal: AbortSignal.timeout(deps.timeoutMs ?? DEFAULT_MEETING_TIMEOUT_MS),
    });
  } catch (error) {
    const timeout = error instanceof Error && error.name === 'TimeoutError';
    logger.error(
      { provider, method, path: safePath(url), reason: timeout ? 'timeout' : 'network' },
      'Sin respuesta del proveedor de reuniones',
    );
    throw meetingProviderError(provider, timeout ? 'timeout' : 'network error');
  }
  const text = await response.text().catch(() => '');
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  return { status: response.status, ok: response.ok, body };
}

/** Registra y lanza 502 para una respuesta inesperada del proveedor. */
export function unexpectedResponse(
  provider: MeetingProvider,
  action: string,
  result: HttpResult,
): AppException {
  logger.error(
    { provider, action, status: result.status, providerMessage: providerErrorMessage(result.body) },
    'Respuesta inesperada del proveedor de reuniones',
  );
  return meetingProviderError(provider, `${action}: HTTP ${result.status}`);
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function stringOrNull(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

/** ISO 8601 UTC sin milisegundos (`2026-11-12T17:00:00Z`), formato que aceptan Zoom y Google. */
export function toProviderIso(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
