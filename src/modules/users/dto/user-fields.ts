import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateBy,
} from 'class-validator';
import { BUSINESS_RULES } from '../../../config/business-rules';
import { isValidTimezone } from '../../../common/utils/time';
import {
  normalizeEmail,
  normalizeFullName,
  normalizeUsername,
  PASSWORD_HAS_DIGIT,
  PASSWORD_HAS_LETTER,
} from '../../auth/auth.policy';

/**
 * Decoradores de validación de los campos de identidad, compartidos por registro (HU-02),
 * recuperación (HU-05) y perfil (HU-14). Así las reglas son idénticas en todos los formularios.
 */

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);

/** Solo letras (incluye tildes y ñ) separadas por un espacio. */
export const FULL_NAME_PATTERN = /^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u;
/** Letras, números, punto y guion bajo (se guarda en minúsculas). */
export const USERNAME_PATTERN = new RegExp(
  `^[a-z0-9._]{${BUSINESS_RULES.USERNAME_MIN_LENGTH},${BUSINESS_RULES.USERNAME_MAX_LENGTH}}$`,
);

interface FieldOptions {
  /** Documenta el campo como opcional en OpenAPI (combínalo con @IsOptional()). */
  optional?: boolean;
}

const apiProp = (options: FieldOptions) => (options.optional ? ApiPropertyOptional : ApiProperty);

export function IsFullName(options: FieldOptions = {}): PropertyDecorator {
  return applyDecorators(
    apiProp(options)({
      example: 'María José Núñez',
      maxLength: BUSINESS_RULES.FULL_NAME_MAX_LENGTH,
      description: 'Solo letras (con tildes o ñ) y espacios.',
    }),
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? normalizeFullName(value) : value,
    ),
    IsString(),
    IsNotEmpty({ message: 'Escribe tu nombre completo.' }),
    MaxLength(BUSINESS_RULES.FULL_NAME_MAX_LENGTH, { message: 'El nombre es demasiado largo.' }),
    Matches(FULL_NAME_PATTERN, { message: 'Usa solo letras (con tildes o ñ) y espacios.' }),
  );
}

export function IsUsername(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      example: 'mariajose',
      pattern: USERNAME_PATTERN.source,
      description: `De ${BUSINESS_RULES.USERNAME_MIN_LENGTH} a ${BUSINESS_RULES.USERNAME_MAX_LENGTH} caracteres: letras, números, punto o guion bajo. Se guarda en minúsculas. Único y no editable.`,
    }),
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? normalizeUsername(value) : value,
    ),
    IsString(),
    Matches(USERNAME_PATTERN, {
      message: `Usa de ${BUSINESS_RULES.USERNAME_MIN_LENGTH} a ${BUSINESS_RULES.USERNAME_MAX_LENGTH} caracteres: letras, números, punto o guion bajo.`,
    }),
  );
}

export function IsUserEmail(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      example: 'maria.nunez@example.com',
      description: 'Se normaliza a minúsculas y sin espacios.',
    }),
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? normalizeEmail(value) : value,
    ),
    IsString(),
    MaxLength(254),
    IsEmail({}, { message: 'Escribe un correo electrónico válido.' }),
  );
}

/** Contraseña nueva: mínimo 8, al menos una letra y un número (HU-02). */
export function IsNewPassword(example = 'Agua2026segura'): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      example,
      minLength: BUSINESS_RULES.PASSWORD_MIN_LENGTH,
      maxLength: BUSINESS_RULES.PASSWORD_MAX_LENGTH,
      format: 'password',
      description: `Mínimo ${BUSINESS_RULES.PASSWORD_MIN_LENGTH} caracteres, al menos una letra y un número.`,
    }),
    IsString(),
    MinLength(BUSINESS_RULES.PASSWORD_MIN_LENGTH, {
      message: `La contraseña debe tener al menos ${BUSINESS_RULES.PASSWORD_MIN_LENGTH} caracteres.`,
    }),
    MaxLength(BUSINESS_RULES.PASSWORD_MAX_LENGTH, { message: 'La contraseña es demasiado larga.' }),
    ValidateBy({
      name: 'passwordHasLetter',
      validator: {
        validate: (value: unknown) => typeof value === 'string' && PASSWORD_HAS_LETTER.test(value),
        defaultMessage: () => 'La contraseña debe incluir al menos una letra.',
      },
    }),
    ValidateBy({
      name: 'passwordHasDigit',
      validator: {
        validate: (value: unknown) => typeof value === 'string' && PASSWORD_HAS_DIGIT.test(value),
        defaultMessage: () => 'La contraseña debe incluir al menos un número.',
      },
    }),
  );
}

export function IsIanaTimezone(options: FieldOptions = {}): PropertyDecorator {
  return applyDecorators(
    apiProp(options)({
      example: 'America/Mexico_City',
      description: 'Zona horaria IANA (ver GET /timezones). Por defecto America/Mexico_City.',
    }),
    IsString(),
    ValidateBy({
      name: 'isIanaTimezone',
      validator: {
        validate: (value: unknown) => typeof value === 'string' && isValidTimezone(value),
        defaultMessage: () => 'Elige una zona horaria válida.',
      },
    }),
  );
}

// --- Objetos anidados ---------------------------------------------------------------------------

/** Teléfono con indicativo y número por separado (HU-02). */
export class PhoneDto {
  @ApiProperty({ example: '+52', description: 'Indicativo con "+" (ver `phoneCode` del país).' })
  @trim
  @IsString()
  @Matches(/^\+\d{1,4}$/, { message: 'El indicativo debe tener el formato +52.' })
  countryCode!: string;

  @ApiProperty({
    example: '5512345678',
    description:
      'Solo dígitos, sin indicativo. Se ignoran espacios y guiones. La longitud se valida contra el país del indicativo (`phoneMinLength`/`phoneMaxLength`).',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/[\s\-().]/g, '') : value,
  )
  @IsString()
  @Matches(/^\d{4,15}$/, { message: 'El teléfono debe contener solo dígitos.' })
  number!: string;
}

/**
 * Ubicación en cascada (HU-02 / HU-14).
 * - Si el país tiene lista (`hasDivisions`), envía `divisionId`; si no, `divisionName` (texto libre).
 * - Si el estado tiene municipios (`hasMunicipalities`), envía `municipalityId`; si no,
 *   `municipalityName` (texto libre).
 */
export class LocationInputDto {
  @ApiProperty({ example: 'MX', description: 'ISO-3166 alpha-2 (ver GET /locations/countries).' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'Elige un país válido.' })
  countryCode!: string;

  @ApiPropertyOptional({
    example: '3f6c1f0e-8a7b-4c1e-9f0a-2d8b6e4c1a7f',
    description: 'Id del estado/departamento (países con lista).',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Elige un estado válido.' })
  divisionId?: string;

  @ApiPropertyOptional({
    example: 'Antioquia',
    description: 'Estado/departamento/provincia en texto libre (países sin lista).',
  })
  @IsOptional()
  @trim
  @IsString()
  @Length(2, 100, { message: 'Escribe entre 2 y 100 caracteres.' })
  divisionName?: string;

  @ApiPropertyOptional({
    example: '9b2d4c1e-5b7d-4c1e-9f0a-2d8b6e4c1a7f',
    description: 'Id del municipio (estados con lista).',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Elige un municipio válido.' })
  municipalityId?: string;

  @ApiPropertyOptional({
    example: 'Medellín',
    description: 'Municipio/ciudad en texto libre (cuando no hay lista).',
  })
  @IsOptional()
  @trim
  @IsString()
  @Length(2, 100, { message: 'Escribe entre 2 y 100 caracteres.' })
  municipalityName?: string;
}
