import { ValidationError } from 'class-validator';
import { AppException, ErrorDetail } from './app.exception';
import { FIELD_ERROR_CODES } from './error-codes';

/**
 * Mensajes en español para las restricciones más comunes de class-validator.
 * Se usan cuando el DTO no definió un mensaje propio (los mensajes por defecto de
 * class-validator están en inglés y empiezan con el nombre de la propiedad).
 *
 * Recomendación para DTOs: define el mensaje en el decorador cuando el texto importe
 * (`@MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })`).
 */
const SPANISH_MESSAGES: Record<string, string> = {
  isDefined: 'Este campo es obligatorio.',
  isNotEmpty: 'Este campo es obligatorio.',
  isString: 'Debe ser texto.',
  isEmail: 'Debe ser un correo electrónico válido.',
  isInt: 'Debe ser un número entero.',
  isNumber: 'Debe ser un número.',
  isBoolean: 'Debe ser verdadero o falso.',
  isEnum: 'El valor no es una opción válida.',
  isIn: 'El valor no es una opción válida.',
  isUUID: 'Debe ser un identificador (UUID) válido.',
  isDateString: 'Debe ser una fecha ISO 8601 válida.',
  isISO8601: 'Debe ser una fecha ISO 8601 válida.',
  isDate: 'Debe ser una fecha válida.',
  isUrl: 'Debe ser una URL válida.',
  isArray: 'Debe ser una lista.',
  isObject: 'Debe ser un objeto.',
  isPhoneNumber: 'Debe ser un teléfono válido con indicativo de país.',
  minLength: 'El texto es demasiado corto.',
  maxLength: 'El texto es demasiado largo.',
  length: 'La longitud del texto no es válida.',
  min: 'El valor es menor al mínimo permitido.',
  max: 'El valor es mayor al máximo permitido.',
  arrayMinSize: 'La lista tiene menos elementos de los permitidos.',
  arrayMaxSize: 'La lista tiene más elementos de los permitidos.',
  matches: 'El formato no es válido.',
  isPositive: 'Debe ser un número positivo.',
  whitelistValidation: 'Este campo no está permitido.',
  nestedValidation: 'El valor no es válido.',
};

/** `isEmail` → `IS_EMAIL`; `whitelistValidation` → `UNKNOWN_FIELD`. */
export function constraintToCode(constraint: string): string {
  if (constraint === 'whitelistValidation') return FIELD_ERROR_CODES.UNKNOWN_FIELD;
  if (constraint === 'isDefined' || constraint === 'isNotEmpty') return FIELD_ERROR_CODES.REQUIRED;
  return constraint
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .toUpperCase();
}

function localize(constraint: string, message: string, property: string): string {
  const isDefaultEnglish = message.startsWith(`${property} `) || message.startsWith('property ');
  if (isDefaultEnglish && SPANISH_MESSAGES[constraint]) {
    return SPANISH_MESSAGES[constraint];
  }
  return message;
}

/** Aplana el árbol de ValidationError de class-validator a `details` por campo. */
export function flattenValidationErrors(errors: ValidationError[], parentPath = ''): ErrorDetail[] {
  const details: ErrorDetail[] = [];
  for (const error of errors) {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;
    for (const [constraint, message] of Object.entries(error.constraints ?? {})) {
      details.push({
        field,
        code: constraintToCode(constraint),
        message: localize(constraint, message, error.property),
      });
    }
    if (error.children?.length) {
      details.push(...flattenValidationErrors(error.children, field));
    }
  }
  return details;
}

/** `exceptionFactory` del ValidationPipe global: produce VALIDATION_ERROR con `details`. */
export function validationExceptionFactory(errors: ValidationError[]): AppException {
  return AppException.validation(flattenValidationErrors(errors));
}
