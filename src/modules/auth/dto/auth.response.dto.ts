import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '../../../generated/prisma/enums';
import { UserProfileDto } from '../../users/dto/user-profile.response.dto';

/** Datos del código enviado, para la cuenta regresiva de la UI (HU-03 / HU-05). */
export class OtpDeliveryDto {
  @ApiProperty({ example: 'm***@example.com', description: 'Correo de destino enmascarado.' })
  maskedEmail!: string;

  @ApiProperty({ example: 6, description: 'Número de dígitos (casillas).' })
  codeLength!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-11-07T16:10:00.000Z',
    description: 'Vencimiento del código.',
  })
  expiresAt!: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-11-07T16:00:30.000Z',
    description: 'Desde cuándo se puede pedir otro código ("Reenviar en 00:30").',
  })
  resendAvailableAt!: Date;
}

export class RegisterResponseDto {
  @ApiProperty({ example: 'a3c1e2f4-5b6d-4e7f-8a9b-0c1d2e3f4a5b' })
  userId!: string;

  @ApiProperty({ example: 'maria.nunez@example.com' })
  email!: string;

  @ApiProperty({
    enum: UserStatus,
    enumName: 'UserStatus',
    example: UserStatus.PENDING_VERIFICATION,
  })
  status!: UserStatus;

  @ApiProperty({ type: OtpDeliveryDto })
  otp!: OtpDeliveryDto;
}

export class FieldAvailabilityDto {
  @ApiProperty({ example: 'mariajose', description: 'Valor normalizado que se evaluó.' })
  value!: string;

  @ApiProperty({ example: true, description: 'Formato válido.' })
  valid!: boolean;

  @ApiProperty({ example: true, description: 'Formato válido y no registrado.' })
  available!: boolean;
}

export class AvailabilityResponseDto {
  @ApiPropertyOptional({ type: FieldAvailabilityDto })
  email?: FieldAvailabilityDto;

  @ApiPropertyOptional({ type: FieldAvailabilityDto })
  username?: FieldAvailabilityDto;
}

/** Par de tokens. Guarda SIEMPRE el último refreshToken (rotación). */
export class TokenPairDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({ example: 900, description: 'Segundos de vida del accessToken.' })
  expiresIn!: number;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-11-07T16:15:00.000Z' })
  accessTokenExpiresAt!: Date;

  @ApiProperty({ example: 'q5V3n8x1b0pY7mKkz2c4dWJ9eH6tA1sLrUoG3fQ8yZw' })
  refreshToken!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-11-14T16:00:00.000Z',
    description: '7 días (30 con "Recordarme"). Cada refresh lo renueva.',
  })
  refreshTokenExpiresAt!: Date;
}

export class LoginResponseDto extends TokenPairDto {
  @ApiProperty({ type: UserProfileDto })
  user!: UserProfileDto;
}

export class VerifyEmailResponseDto {
  @ApiProperty({ example: true })
  verified!: boolean;

  @ApiProperty({ example: 'maria.nunez@example.com' })
  email!: string;

  @ApiPropertyOptional({
    type: LoginResponseDto,
    description:
      'Solo si se pidió `startSession: true`: tokens y perfil, igual que POST /auth/login.',
  })
  session?: LoginResponseDto;
}

export class ResetTokenResponseDto {
  @ApiProperty({
    example: 'Zr0x9H2bQe4cT7uV1yL3nM8pK5sD6fG0aJ2wE4rT6yU',
    description: 'Envíalo en POST /auth/password/reset. Un solo uso.',
  })
  resetToken!: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-11-07T16:10:00.000Z' })
  expiresAt!: Date;
}
