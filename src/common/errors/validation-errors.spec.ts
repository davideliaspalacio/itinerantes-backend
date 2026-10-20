import { ValidationError } from 'class-validator';
import {
  constraintToCode,
  flattenValidationErrors,
  validationExceptionFactory,
} from './validation-errors';

function error(
  property: string,
  constraints?: Record<string, string>,
  children: ValidationError[] = [],
): ValidationError {
  return Object.assign(new ValidationError(), { property, constraints, children });
}

describe('validation-errors', () => {
  it('constraintToCode convierte camelCase a SCREAMING_SNAKE_CASE', () => {
    expect(constraintToCode('isEmail')).toBe('IS_EMAIL');
    expect(constraintToCode('minLength')).toBe('MIN_LENGTH');
    expect(constraintToCode('isUUID')).toBe('IS_UUID');
    expect(constraintToCode('whitelistValidation')).toBe('UNKNOWN_FIELD');
    expect(constraintToCode('isNotEmpty')).toBe('REQUIRED');
  });

  it('aplana errores anidados con ruta por puntos y traduce mensajes por defecto', () => {
    const details = flattenValidationErrors([
      error('email', { isEmail: 'email must be an email' }),
      error('address', undefined, [error('zipCode', { isString: 'zipCode must be a string' })]),
      error('password', { minLength: 'La contraseña debe tener al menos 8 caracteres.' }),
    ]);
    expect(details).toEqual([
      { field: 'email', code: 'IS_EMAIL', message: 'Debe ser un correo electrónico válido.' },
      { field: 'address.zipCode', code: 'IS_STRING', message: 'Debe ser texto.' },
      {
        field: 'password',
        code: 'MIN_LENGTH',
        message: 'La contraseña debe tener al menos 8 caracteres.',
      },
    ]);
  });

  it('validationExceptionFactory produce AppException VALIDATION_ERROR (400)', () => {
    const exception = validationExceptionFactory([
      error('name', { isString: 'name must be a string' }),
    ]);
    expect(exception.code).toBe('VALIDATION_ERROR');
    expect(exception.getStatus()).toBe(400);
    expect(exception.details).toHaveLength(1);
  });
});
