import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';
import type { Env } from './env.schema';

export const REQUEST_ID_HEADER = 'x-request-id';
const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

/**
 * Configuración de nestjs-pino:
 * - requestId: reutiliza `X-Request-Id` entrante si es válido; si no, genera un UUID. Se devuelve
 *   en el header `X-Request-Id` y en el cuerpo de los errores (`requestId`).
 * - Logs JSON en producción; legibles (pino-pretty) en desarrollo.
 * - Nunca registra headers de autorización ni cookies.
 */
export function buildLoggerParams(env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>): Params {
  const isDev = env.NODE_ENV === 'development';
  return {
    pinoHttp: {
      level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const incoming = req.headers[REQUEST_ID_HEADER];
        const id =
          typeof incoming === 'string' && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      customProps: (req: IncomingMessage) => ({ requestId: (req as { id?: unknown }).id }),
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        censor: '[REDACTED]',
      },
      serializers: {
        req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      transport: isDev
        ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' } }
        : undefined,
    },
  };
}
