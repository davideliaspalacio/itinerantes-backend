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

  // --- Fase 01: Identidad (HU-02, 03, 04, 05, 14) ---
  AUTH_EMAIL_ALREADY_REGISTERED: {
    status: HttpStatus.CONFLICT,
    message: 'Ya existe una cuenta con este correo.',
  },
  AUTH_USERNAME_TAKEN: {
    status: HttpStatus.CONFLICT,
    message: 'Ese nombre de usuario ya está en uso.',
  },
  AUTH_INVALID_CREDENTIALS: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Correo o contraseña incorrectos.',
  },
  AUTH_EMAIL_NOT_VERIFIED: {
    status: HttpStatus.FORBIDDEN,
    message: 'Debes verificar tu correo antes de iniciar sesión.',
  },
  AUTH_ACCOUNT_DISABLED: {
    status: HttpStatus.FORBIDDEN,
    message: 'Tu cuenta está deshabilitada. Contacta al equipo de la Escuela.',
  },
  AUTH_LOGIN_LOCKED: {
    status: HttpStatus.TOO_MANY_REQUESTS,
    message: 'Demasiados intentos fallidos. Intenta de nuevo más tarde.',
  },
  AUTH_ACCOUNT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'No existe una cuenta con ese correo.',
  },
  AUTH_ALREADY_VERIFIED: {
    status: HttpStatus.CONFLICT,
    message: 'Tu correo ya está verificado. Inicia sesión.',
  },
  AUTH_OTP_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    message: 'El código es incorrecto.',
  },
  AUTH_OTP_EXPIRED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'El código expiró o ya no es válido. Solicita uno nuevo.',
  },
  AUTH_OTP_LOCKED: {
    status: HttpStatus.TOO_MANY_REQUESTS,
    message: 'Demasiados intentos con el código. Espera antes de intentarlo de nuevo.',
  },
  AUTH_OTP_COOLDOWN: {
    status: HttpStatus.TOO_MANY_REQUESTS,
    message: 'Espera un momento antes de solicitar un nuevo código.',
  },
  AUTH_REFRESH_INVALID: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Tu sesión expiró. Inicia sesión de nuevo.',
  },
  AUTH_RESET_TOKEN_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    message: 'El enlace de recuperación expiró o ya se usó. Solicita un nuevo código.',
  },
  AUTH_CURRENT_PASSWORD_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    message: 'La contraseña actual es incorrecta.',
  },

  // --- Fase 01: Contacto (HU-38) ---
  CONTACT_CAPTCHA_FAILED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'No pudimos verificar que no eres un robot. Intenta de nuevo más tarde.',
  },

  // --- Fase 02: Oferta formativa (HU-15, 16, 34) ---
  OFFER_NOT_AVAILABLE: {
    status: HttpStatus.NOT_FOUND,
    message: 'Esta oferta ya no está disponible.',
  },

  // --- Fase 03: Portal del participante (HU-06–10, 12, 13, 17, 18) ---
  ENROLLMENT_REQUIRED: {
    status: HttpStatus.FORBIDDEN,
    message: 'No estás inscrito en esta formación.',
  },
  ENROLLMENT_SUSPENDED: {
    status: HttpStatus.FORBIDDEN,
    message: 'Tu acceso a esta formación está suspendido. Regulariza tu pago para recuperarlo.',
  },
  ENROLLMENT_ALREADY_EXISTS: {
    status: HttpStatus.CONFLICT,
    message: 'Ya estás inscrito en esta formación.',
  },
  ENROLLMENT_NOT_FREE: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'Esta oferta no admite inscripción directa gratuita.',
  },
  ENROLLMENT_CLOSED: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'Las inscripciones para esta oferta no están abiertas.',
  },
  OFFER_SOLD_OUT: {
    status: HttpStatus.CONFLICT,
    message: 'Cupo agotado.',
  },
  SESSION_CANCELLED: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'Esta sesión fue cancelada.',
  },
  ATTENDANCE_NOT_OPEN_YET: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'El registro de asistencia se abre al terminar la sesión.',
  },
  ATTENDANCE_WINDOW_CLOSED: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'El registro de asistencia para esta sesión está cerrado.',
  },
  ATTENDANCE_ALREADY_REGISTERED: {
    status: HttpStatus.CONFLICT,
    message: 'Tu asistencia a esta sesión ya está registrada.',
  },
  RESOURCE_FILE_UNAVAILABLE: {
    status: HttpStatus.NOT_FOUND,
    message: 'El archivo no está disponible. Intenta de nuevo más tarde.',
  },
  FINAL_PROJECT_NOT_AVAILABLE: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'Esta formación no recibe entregas de proyecto final.',
  },
  FINAL_PROJECT_DEADLINE_PASSED: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'La fecha límite de entrega del proyecto final ya pasó.',
  },
  FINAL_PROJECT_INVALID_FILE: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'El archivo debe ser PDF, DOCX, PPTX o ZIP de máximo 20 MB.',
  },
  FINAL_PROJECT_UPLOAD_NOT_FOUND: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'No encontramos el archivo subido. Vuelve a subirlo.',
  },

  // --- Fase 04: Postulaciones (HU-19, 20, 21) ---
  APPLICATION_NOT_ALLOWED: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'Esta oferta no recibe postulaciones.',
  },
  APPLICATION_WINDOW_CLOSED: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'La convocatoria no está abierta.',
  },
  APPLICATION_ALREADY_EXISTS: {
    status: HttpStatus.CONFLICT,
    message: 'Ya tienes una postulación para esta oferta.',
  },
  APPLICATION_NOT_EDITABLE: {
    status: HttpStatus.CONFLICT,
    message: 'Tu postulación ya fue enviada y no se puede modificar.',
  },
  APPLICATION_INCOMPLETE: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'Completa los campos obligatorios para enviar tu postulación.',
  },
  APPLICATION_NOT_ELIGIBLE: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'No cumples con la elegibilidad de esta convocatoria.',
  },
  APPLICATION_INVALID_FILE: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'El archivo debe ser JPG, PNG o HEIC de máximo 10 MB, o MP4/MOV de máximo 100 MB.',
  },
  APPLICATION_TOO_MANY_FILES: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'Puedes adjuntar como máximo 10 archivos.',
  },
  APPLICATION_UPLOAD_NOT_FOUND: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'No encontramos el archivo subido. Vuelve a subirlo.',
  },
  APPLICATION_INVALID_TRANSITION: {
    status: HttpStatus.CONFLICT,
    message: 'Tu postulación no está en un estado que permita esta acción.',
  },
  APPLICATION_DEADLINE_PASSED: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'El plazo para responder ya venció.',
  },
  APPLICATION_INTERVIEW_REQUIRED: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'Esta postulación requiere entrevista por Zoom.',
  },
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
  /** La confirmación no coincide con la nueva contraseña. */
  PASSWORD_MISMATCH: 'PASSWORD_MISMATCH',
  /** País / estado / municipio que no existe o no corresponde al nivel superior. */
  INVALID_LOCATION: 'INVALID_LOCATION',
  /** Longitud del teléfono no válida para el indicativo. */
  INVALID_PHONE: 'INVALID_PHONE',
  /** Fase 04: faltan archivos de evidencia (mínimo 1 en becas). */
  MIN_FILES: 'MIN_FILES',
  /** Fase 04: casilla obligatoria sin marcar (términos, elegibilidad). */
  MUST_ACCEPT: 'MUST_ACCEPT',
  /** Fase 04: nivel de beca no habilitado en la oferta. */
  LEVEL_NOT_ENABLED: 'LEVEL_NOT_ENABLED',
  /** Fase 04: campo que no corresponde al tipo de postulación (beca / convocatoria). */
  NOT_APPLICABLE: 'NOT_APPLICABLE',
} as const;

export function getErrorDefinition(code: ErrorCode): ErrorDefinition {
  return ERROR_CODES[code];
}
