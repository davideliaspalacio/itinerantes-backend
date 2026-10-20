import { ApiProperty } from '@nestjs/swagger';
import { Role, UserStatus } from '../../../generated/prisma/enums';

export class PhoneResponseDto {
  @ApiProperty({ example: '+52' })
  countryCode!: string;

  @ApiProperty({ example: '5512345678' })
  number!: string;
}

export class LocationResponseDto {
  @ApiProperty({ example: 'MX' })
  countryCode!: string;

  @ApiProperty({ example: 'México' })
  countryName!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '3f6c1f0e-8a7b-4c1e-9f0a-2d8b6e4c1a7f',
    description: 'Id de catálogo; null si se capturó como texto libre.',
  })
  divisionId!: string | null;

  @ApiProperty({ example: 'Ciudad de México' })
  divisionName!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '9b2d4c1e-5b7d-4c1e-9f0a-2d8b6e4c1a7f',
    description: 'Id de catálogo; null si se capturó como texto libre.',
  })
  municipalityId!: string | null;

  @ApiProperty({ example: 'Coyoacán' })
  municipalityName!: string;
}

/** Perfil del usuario autenticado (HU-14). */
export class UserProfileDto {
  @ApiProperty({ example: 'a3c1e2f4-5b6d-4e7f-8a9b-0c1d2e3f4a5b' })
  id!: string;

  @ApiProperty({ example: 'María José Núñez' })
  fullName!: string;

  @ApiProperty({ example: 'mariajose', description: 'No editable.' })
  username!: string;

  @ApiProperty({ example: 'maria.nunez@example.com', description: 'No editable.' })
  email!: string;

  @ApiProperty({ type: PhoneResponseDto })
  phone!: PhoneResponseDto;

  @ApiProperty({ type: LocationResponseDto })
  location!: LocationResponseDto;

  @ApiProperty({ example: 'America/Mexico_City', description: 'Zona IANA (HU-11).' })
  timezone!: string;

  @ApiProperty({
    enum: ['MXN', 'USD'],
    example: 'MXN',
    description: 'Calculado: moneda de los pagos nuevos según el país (MX → MXN; resto → USD).',
  })
  currency!: 'MXN' | 'USD';

  @ApiProperty({ enum: Role, enumName: 'Role', isArray: true, example: [Role.PARTICIPANT] })
  roles!: Role[];

  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus', example: UserStatus.ACTIVE })
  status!: UserStatus;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-11-07T16:00:00.000Z',
  })
  emailVerifiedAt!: Date | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-11-07T16:00:00.000Z',
  })
  lastLoginAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-11-07T16:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-11-07T16:00:00.000Z' })
  updatedAt!: Date;
}
