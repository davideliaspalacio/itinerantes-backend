import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { BUSINESS_RULES } from '../../../config/business-rules';
import {
  ContactOrigin,
  ContactProjectType,
  ContactService,
  ContactStatus,
  ContactSubject,
} from '../../../generated/prisma/enums';
import { normalizeEmail } from '../../auth/auth.policy';
import { PhoneDto } from '../../users/dto/user-fields';

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);
const isDesign = (dto: CreateContactMessageRequestDto) =>
  dto.subject === ContactSubject.DESIGN_CONSULTING;

/** HU-38 / HU-01: formulario único de Contacto. */
export class CreateContactMessageRequestDto {
  @ApiProperty({ example: 'Lucía Hernández', minLength: BUSINESS_RULES.CONTACT_NAME_MIN_LENGTH })
  @trim
  @IsString()
  @Length(BUSINESS_RULES.CONTACT_NAME_MIN_LENGTH, 120, {
    message: `El nombre debe tener al menos ${BUSINESS_RULES.CONTACT_NAME_MIN_LENGTH} caracteres.`,
  })
  name!: string;

  @ApiProperty({ example: 'lucia@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsString()
  @MaxLength(254)
  @IsEmail({}, { message: 'Escribe un correo electrónico válido.' })
  email!: string;

  @ApiPropertyOptional({ example: 'Cooperativa Agua Viva' })
  @IsOptional()
  @trim
  @IsString()
  @MaxLength(150)
  organization?: string;

  @ApiPropertyOptional({ type: PhoneDto, description: 'Teléfono / WhatsApp con indicativo.' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PhoneDto)
  phone?: PhoneDto;

  @ApiProperty({ enum: ContactSubject, enumName: 'ContactSubject', example: ContactSubject.SCHOOL })
  @IsEnum(ContactSubject, { message: 'Elige un asunto de la lista.' })
  subject!: ContactSubject;

  @ApiPropertyOptional({
    enum: ContactProjectType,
    enumName: 'ContactProjectType',
    description: 'Obligatorio si subject = DESIGN_CONSULTING (se ignora con otro asunto).',
  })
  @ValidateIf(isDesign)
  @IsNotEmpty({ message: 'Elige el tipo de proyecto.' })
  @IsEnum(ContactProjectType, { message: 'Elige un tipo de proyecto de la lista.' })
  projectType?: ContactProjectType;

  @ApiPropertyOptional({
    example: 'San Cristóbal de las Casas, Chiapas',
    description: 'Ubicación del proyecto. Obligatorio si subject = DESIGN_CONSULTING.',
  })
  @ValidateIf(isDesign)
  @trim
  @IsString()
  @Length(2, 150, { message: 'Escribe la ubicación del proyecto (2 a 150 caracteres).' })
  projectLocation?: string;

  @ApiPropertyOptional({
    enum: ContactService,
    enumName: 'ContactService',
    description: 'Servicio de interés (o NOT_SURE). Obligatorio si subject = DESIGN_CONSULTING.',
  })
  @ValidateIf(isDesign)
  @IsNotEmpty({ message: 'Elige el servicio de interés.' })
  @IsEnum(ContactService, { message: 'Elige un servicio de la lista.' })
  service?: ContactService;

  @ApiProperty({
    example: 'Hola, quisiera información sobre el próximo Diplomado en Ecotecnologías del Agua.',
    minLength: BUSINESS_RULES.CONTACT_MESSAGE_MIN_LENGTH,
    maxLength: BUSINESS_RULES.CONTACT_MESSAGE_MAX_LENGTH,
  })
  @trim
  @IsString()
  @Length(BUSINESS_RULES.CONTACT_MESSAGE_MIN_LENGTH, BUSINESS_RULES.CONTACT_MESSAGE_MAX_LENGTH, {
    message: `El mensaje debe tener entre ${BUSINESS_RULES.CONTACT_MESSAGE_MIN_LENGTH} y ${BUSINESS_RULES.CONTACT_MESSAGE_MAX_LENGTH} caracteres.`,
  })
  message!: string;

  @ApiProperty({ example: true, description: 'Debe ser true (política de datos aceptada).' })
  @IsBoolean()
  @Equals(true, { message: 'Debes aceptar la política de datos.' })
  privacyAccepted!: boolean;

  @ApiProperty({
    enum: ContactOrigin,
    enumName: 'ContactOrigin',
    example: ContactOrigin.CONTACT_PAGE,
    description: 'Canal de origen (LANDING desde la landing HU-01).',
  })
  @IsEnum(ContactOrigin, { message: 'Origen no válido.' })
  origin!: ContactOrigin;

  @ApiPropertyOptional({
    example: '',
    description:
      'Honeypot: campo oculto que debe ir vacío o ausente. Si viene con texto el mensaje se ' +
      'descarta en silencio (la respuesta es igual a la de éxito).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;

  @ApiPropertyOptional({
    example: '0.AAAAAAAAAAAAAAAAAAAAAA...',
    description:
      'Token de Cloudflare Turnstile. Obligatorio solo si el backend tiene el captcha activo.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  captchaToken?: string;
}

export class ContactMessageResponseDto {
  @ApiProperty({ example: 'c1d2e3f4-5b6d-4e7f-8a9b-0c1d2e3f4a5b' })
  id!: string;

  @ApiProperty({ enum: ContactStatus, enumName: 'ContactStatus', example: ContactStatus.NEW })
  status!: ContactStatus;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-11-07T16:00:00.000Z' })
  createdAt!: Date;
}
