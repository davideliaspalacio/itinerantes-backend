import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { AppException, ErrorDetail } from '../errors/app.exception';
import { ERROR_CODES, ErrorCode, FIELD_ERROR_CODES } from '../errors/error-codes';

/** Cuerpo de error único de la API (ver docs/ARCHITECTURE.md → "Formato de error"). */
export interface ErrorResponseBody {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: ErrorDetail[];
  requestId: string;
}

interface NormalizedError {
  status: number;
  code: ErrorCode;
  message: string;
  details?: ErrorDetail[];
}

/** Status HTTP → código genérico del catálogo (para HttpException que no son AppException). */
const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'BUSINESS_RULE_VIOLATION',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

/** Forma mínima de un PrismaClientKnownRequestError (duck typing: no acopla el filtro al cliente generado). */
interface PrismaKnownError {
  name: 'PrismaClientKnownRequestError';
  code: string;
  meta?: Record<string, unknown>;
}

function isPrismaKnownError(error: unknown): error is PrismaKnownError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'PrismaClientKnownRequestError' &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}

/** Extrae los campos de una violación de unicidad (P2002) en Prisma clásico y con driver adapters. */
function prismaUniqueFields(meta: Record<string, unknown> | undefined): string[] {
  if (!meta) return [];
  const target = meta.target;
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === 'string') return [target];
  const adapterFields = (
    meta.driverAdapterError as { cause?: { constraint?: { fields?: unknown } } } | undefined
  )?.cause?.constraint?.fields;
  if (Array.isArray(adapterFields)) return adapterFields.map(String);
  return [];
}

/**
 * Filtro global: convierte CUALQUIER excepción al formato de error único.
 *
 * - AppException → su `code`, `message` y `details`.
 * - Errores de class-validator (vía ValidationPipe) → 400 VALIDATION_ERROR con `details`.
 * - Throttler → 429 RATE_LIMITED.
 * - HttpException de Nest/Express (404 de ruta, JSON mal formado, 413, ...) → código genérico por status.
 * - Prisma: P2002 → 409 CONFLICT (con campos), P2025 → 404 NOT_FOUND, P2003 → 409 CONFLICT.
 * - Cualquier otra cosa → 500 INTERNAL_ERROR (se registra en el log; nunca se expone el detalle).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { id?: string | number }>();
    const response = ctx.getResponse<Response>();

    const normalized = this.normalize(exception);
    const requestId = this.resolveRequestId(request, response);

    if (normalized.status >= 500) {
      this.logger.error(
        { err: exception, requestId },
        exception instanceof Error ? exception.message : 'Unhandled exception',
      );
    }

    const body: ErrorResponseBody = {
      statusCode: normalized.status,
      code: normalized.code,
      message: normalized.message,
      ...(normalized.details?.length ? { details: normalized.details } : {}),
      requestId,
    };

    if (response.headersSent) return;
    response.status(normalized.status).json(body);
  }

  /**
   * requestId asignado por pino-http (req.id). Algunos errores ocurren antes de ese middleware
   * (p. ej. JSON mal formado en body-parser): entonces se usa el header entrante o se genera uno.
   */
  private resolveRequestId(
    request: Request & { id?: string | number },
    response: Response,
  ): string {
    if (request?.id !== undefined) return String(request.id);
    const fromHeader = response.getHeader?.('X-Request-Id') ?? request?.headers?.['x-request-id'];
    const requestId =
      typeof fromHeader === 'string' && /^[A-Za-z0-9._-]{8,128}$/.test(fromHeader)
        ? fromHeader
        : randomUUID();
    if (!response.headersSent) response.setHeader?.('X-Request-Id', requestId);
    return requestId;
  }

  normalize(exception: unknown): NormalizedError {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        code: exception.code,
        message: (exception.getResponse() as { message: string }).message,
        details: exception.details,
      };
    }

    if (exception instanceof ThrottlerException) {
      return this.fromCode('RATE_LIMITED');
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    if (isPrismaKnownError(exception)) {
      return this.fromPrisma(exception);
    }

    // Errores de body-parser (JSON mal formado, cuerpo demasiado grande) que no llegan como HttpException.
    const status = (exception as { status?: unknown } | null)?.status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return this.fromCode(STATUS_TO_CODE[status] ?? 'BAD_REQUEST', status);
    }

    return this.fromCode('INTERNAL_ERROR');
  }

  private fromCode(code: ErrorCode, status?: number, message?: string): NormalizedError {
    const definition = ERROR_CODES[code];
    return { status: status ?? definition.status, code, message: message ?? definition.message };
  }

  private fromHttpException(exception: HttpException): NormalizedError {
    const status = exception.getStatus();
    const code: ErrorCode =
      STATUS_TO_CODE[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
    const response = exception.getResponse();

    // ValidationPipe sin exceptionFactory propio (p. ej. pipes locales): message es string[].
    if (
      status === 400 &&
      typeof response === 'object' &&
      response !== null &&
      Array.isArray((response as { message?: unknown }).message)
    ) {
      const messages = (response as { message: string[] }).message;
      return {
        ...this.fromCode('VALIDATION_ERROR'),
        details: messages.map((message) => ({
          field: message.split(' ')[0] ?? '',
          code: FIELD_ERROR_CODES.INVALID,
          message,
        })),
      };
    }

    // JSON mal formado (body-parser).
    if (status === 400 && /JSON/i.test(exception.message)) {
      return this.fromCode('BAD_REQUEST', 400, 'El cuerpo de la solicitud no es un JSON válido.');
    }

    // Ruta inexistente: Nest lanza NotFoundException("Cannot GET /x").
    if (status === 404 && /^Cannot [A-Z]+ /.test(exception.message)) {
      return this.fromCode('NOT_FOUND', 404, 'La ruta solicitada no existe.');
    }

    // Mensajes por defecto de Nest (inglés) → mensaje del catálogo en español.
    return this.fromCode(code, status);
  }

  private fromPrisma(error: PrismaKnownError): NormalizedError {
    switch (error.code) {
      case 'P2002': {
        const fields = prismaUniqueFields(error.meta);
        return {
          ...this.fromCode('CONFLICT', 409, 'Ya existe un registro con esos datos.'),
          details: fields.map((field) => ({
            field,
            code: FIELD_ERROR_CODES.ALREADY_EXISTS,
            message: 'Este valor ya está registrado.',
          })),
        };
      }
      case 'P2025':
        return this.fromCode('NOT_FOUND');
      case 'P2003':
        return this.fromCode('CONFLICT', 409, 'La operación viola una relación entre registros.');
      case 'P2000':
        return this.fromCode('VALIDATION_ERROR', 400, 'Un valor excede la longitud permitida.');
      default:
        return this.fromCode('INTERNAL_ERROR');
    }
  }
}
