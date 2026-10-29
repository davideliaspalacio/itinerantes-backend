import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateBy,
  ValidateNested,
} from 'class-validator';
import { BUSINESS_RULES } from '../../../config/business-rules';
import { OtpPurpose } from '../../../generated/prisma/enums';
import {
  IsFullName,
  IsIanaTimezone,
  IsNewPassword,
  IsUserEmail,
  IsUsername,
  LocationInputDto,
  PhoneDto,
} from '../../users/dto/user-fields';
import { normalizeEmail } from '../auth.policy';

const OTP_PATTERN = new RegExp(`^\\d{${BUSINESS_RULES.OTP_LENGTH}}$`);

function IsOtpCode(): PropertyDecorator {
  return (target: object, key: string | symbol) => {
    ApiProperty({
      example: '482913',
      pattern: OTP_PATTERN.source,
      description: `Código de ${BUSINESS_RULES.OTP_LENGTH} dígitos recibido por correo.`,
    })(target, key);
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.replace(/\s+/g, '') : value,
    )(target, key);
    IsString()(target, key);
    Matches(OTP_PATTERN, {
      message: `El código debe tener ${BUSINESS_RULES.OTP_LENGTH} dígitos.`,
    })(target, key);
  };
}

/** `confirmPassword` debe ser igual a `newPassword` → details[].code = PASSWORD_MISMATCH. */
function MatchesNewPassword(): PropertyDecorator {
  return ValidateBy({
    name: 'passwordMismatch',
    validator: {
      validate: (value: unknown, args) =>
        value === (args?.object as { newPassword?: unknown }).newPassword,
      defaultMessage: () => 'Las contraseñas no coinciden.',
    },
  });
}

/** Contraseña de login: sin reglas de fortaleza (solo presencia), para no filtrar información. */
function IsLoginPassword(): PropertyDecorator {
  return (target: object, key: string | symbol) => {
    ApiProperty({ example: 'Agua2026segura', format: 'password' })(target, key);
    IsString()(target, key);
    IsNotEmpty({ message: 'Escribe tu contraseña.' })(target, key);
    MaxLength(BUSINESS_RULES.PASSWORD_MAX_LENGTH)(target, key);
  };
}

/** HU-02: registro. */
export class RegisterRequestDto {
  @IsFullName()
  fullName!: string;

  @IsUsername()
  username!: string;

  @IsUserEmail()
  email!: string;

  @IsNewPassword()
  password!: string;

  @ApiProperty({ type: PhoneDto })
  @ValidateNested()
  @Type(() => PhoneDto)
  @IsNotEmpty({ message: 'Escribe tu teléfono.' })
  phone!: PhoneDto;

  @ApiProperty({ type: LocationInputDto })
  @ValidateNested()
  @Type(() => LocationInputDto)
  @IsNotEmpty({ message: 'Indica tu ubicación.' })
  location!: LocationInputDto;

  @IsIanaTimezone()
  timezone!: string;
}

/** HU-02: validación en línea de correo/username. */
export class AvailabilityQueryDto {
  @ApiPropertyOptional({ example: 'maria.nunez@example.com' })
  @IsOptional()
  @IsString()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ example: 'mariajose' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  username?: string;
}

/** HU-03: verificar el correo con el OTP. */
export class VerifyEmailRequestDto {
  @IsUserEmail()
  email!: string;

  @IsOtpCode()
  code!: string;

  @ApiPropertyOptional({
    example: true,
    default: false,
    description:
      'true = inicia sesión al verificar (la respuesta trae `session`, igual que el login) y el ' +
      'frontend no tiene que pedir la contraseña otra vez.',
  })
  @IsOptional()
  @IsBoolean()
  startSession?: boolean;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description: '"Recordarme" de la sesión que se inicia (solo con `startSession: true`).',
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

/** HU-03 / HU-05: reenviar el código (invalida el anterior). */
export class ResendOtpRequestDto {
  @IsUserEmail()
  email!: string;

  @ApiProperty({
    enum: OtpPurpose,
    enumName: 'OtpPurpose',
    example: OtpPurpose.EMAIL_VERIFICATION,
    description: '`EMAIL_VERIFICATION` (HU-03) o `PASSWORD_RESET` (HU-05).',
  })
  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;
}

/** HU-04: login. */
export class LoginRequestDto {
  @ApiProperty({ example: 'participante@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Escribe tu correo.' })
  @MaxLength(254)
  email!: string;

  @IsLoginPassword()
  password!: string;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description: '"Recordarme": alarga la vida del refresh token en este dispositivo.',
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class RefreshRequestDto {
  @ApiProperty({ example: 'q5V3n8x1b0pY7mKkz2c4dWJ9eH6tA1sLrUoG3fQ8yZw' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  refreshToken!: string;
}

export class LogoutRequestDto extends RefreshRequestDto {}

/** HU-05 paso 1. */
export class ForgotPasswordRequestDto {
  @IsUserEmail()
  email!: string;
}

/** HU-05 paso 2. */
export class VerifyResetOtpRequestDto {
  @IsUserEmail()
  email!: string;

  @IsOtpCode()
  code!: string;
}

/** HU-05 paso 3. */
export class ResetPasswordRequestDto {
  @ApiProperty({
    example: 'Zr0x9H2bQe4cT7uV1yL3nM8pK5sD6fG0aJ2wE4rT6yU',
    description: 'Token devuelto por POST /auth/password/verify-otp (un solo uso, vida corta).',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  resetToken!: string;

  @IsNewPassword()
  newPassword!: string;

  @ApiProperty({ example: 'Agua2026segura', format: 'password' })
  @IsString()
  @MatchesNewPassword()
  confirmPassword!: string;
}

/** HU-14 pestaña "Seguridad". */
export class ChangePasswordRequestDto {
  @IsLoginPassword()
  currentPassword!: string;

  @IsNewPassword('NuevaClave2027')
  newPassword!: string;

  @ApiProperty({ example: 'NuevaClave2027', format: 'password' })
  @IsString()
  @MatchesNewPassword()
  confirmPassword!: string;
}
