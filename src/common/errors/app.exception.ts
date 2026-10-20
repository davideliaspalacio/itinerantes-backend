import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_CODES, ErrorCode } from './error-codes';

/** Error asociado a un campo concreto (aparece en `details` de la respuesta). */
export interface ErrorDetail {
  /** Ruta del campo en el cuerpo/query, con puntos para anidados: `address.zipCode`, `items.0.qty`. */
  field: string;
  /** Código estable del error de campo (`IS_EMAIL`, `ALREADY_EXISTS`, ...). */
  code: string;
  /** Mensaje legible en español. */
  message: string;
}

export interface AppExceptionOptions {
  /** Sobrescribe el mensaje por defecto del catálogo. */
  message?: string;
  details?: ErrorDetail[];
  /** Sobrescribe el status HTTP del catálogo (raro; prefiere definir otro código). */
  status?: HttpStatus;
  /** Causa original (se registra en logs, nunca se expone). */
  cause?: unknown;
}

/**
 * Excepción de la aplicación. Úsala en servicios para cualquier error esperado:
 *
 * ```ts
 * throw new AppException('CONFLICT', {
 *   message: 'El correo ya está registrado.',
 *   details: [{ field: 'email', code: 'ALREADY_EXISTS', message: 'Ya existe una cuenta con este correo.' }],
 * });
 * ```
 *
 * El filtro global la convierte al formato de error único de la API.
 */
export class AppException extends HttpException {
  readonly code: ErrorCode;
  readonly details?: ErrorDetail[];

  constructor(code: ErrorCode, options: AppExceptionOptions = {}) {
    const definition = ERROR_CODES[code];
    const status = options.status ?? definition.status;
    const message = options.message ?? definition.message;
    super({ code, message, details: options.details }, status, { cause: options.cause });
    this.code = code;
    this.details = options.details;
  }

  // Atajos para los casos más comunes.
  static notFound(message?: string): AppException {
    return new AppException('NOT_FOUND', { message });
  }

  static forbidden(message?: string): AppException {
    return new AppException('FORBIDDEN', { message });
  }

  static conflict(message?: string, details?: ErrorDetail[]): AppException {
    return new AppException('CONFLICT', { message, details });
  }

  static validation(details: ErrorDetail[], message?: string): AppException {
    return new AppException('VALIDATION_ERROR', { message, details });
  }
}
