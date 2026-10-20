import { HttpStatus } from '@nestjs/common';

/**
 * Catálogo de códigos de error de la API.
 *
 * - `code` es ESTABLE: el frontend decide qué mostrar con él. No renombres un código existente.
 * - `message` es el texto por defecto en español (se puede sobreescribir al lanzar).
 * - Convención: códigos genéricos sin prefijo; los de dominio con prefijo del módulo
 *   (`AUTH_EMAIL_ALREADY_REGISTERED`, `OFFER_SOLD_OUT`, `PAYMENT_...`).
 * - Al agregar códigos, actualiza también `docs/frontend/errores.md`.
 */
export interface ErrorDefinition {
  status: HttpStatus;
  message: string;
}

export const ERROR_CODES = {
  // --- Genéricos (Fase 00) ---
  VALIDATION_ERROR: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Los datos enviados no son válidos.',
  },
  BAD_REQUEST: {
    status: HttpStatus.BAD_REQUEST,
    message: 'La solicitud no es válida.',
  },
  UNAUTHORIZED: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Necesitas iniciar sesión para continuar.',
  },
  FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    message: 'No tienes permiso para realizar esta acción.',
  },
  NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'El recurso solicitado no existe.',
  },
  CONFLICT: {
    status: HttpStatus.CONFLICT,
    message: 'La operación entra en conflicto con el estado actual del recurso.',
  },
  PAYLOAD_TOO_LARGE: {
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    message: 'El contenido enviado excede el tamaño permitido.',
  },
  BUSINESS_RULE_VIOLATION: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'La operación no cumple una regla de negocio.',
  },
  RATE_LIMITED: {
    status: HttpStatus.TOO_MANY_REQUESTS,
    message: 'Demasiadas solicitudes. Intenta de nuevo en unos momentos.',
  },
  INTERNAL_ERROR: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Ocurrió un error inesperado. Intenta de nuevo más tarde.',
  },
  SERVICE_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'El servicio no está disponible temporalmente.',
  },

  // --- Fase 01 (Identidad) agrega aquí sus códigos AUTH_* / USER_* ---
} as const satisfies Record<string, ErrorDefinition>;

export type ErrorCode = keyof typeof ERROR_CODES;

/**
 * Códigos de `details[].code` (errores por campo). Se derivan de las restricciones de
 * class-validator (`isEmail` → `IS_EMAIL`) o se definen a mano (`ALREADY_EXISTS`).
 */
export const FIELD_ERROR_CODES = {
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  INVALID: 'INVALID',
  REQUIRED: 'REQUIRED',
  UNKNOWN_FIELD: 'UNKNOWN_FIELD',
} as const;

export function getErrorDefinition(code: ErrorCode): ErrorDefinition {
  return ERROR_CODES[code];
}
