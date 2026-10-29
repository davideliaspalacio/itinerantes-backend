import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { BUSINESS_RULES } from '../../../config/business-rules';
import {
  ContactOrigin,
  ContactProjectType,
  ContactService,
  ContactStatus,
  ContactSubject,
} from '../../../generated/prisma/enums';

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);

/** Textos en español de los estados de la bandeja (HU-38). */
export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  NEW: 'Nuevo',
  IN_PROGRESS: 'En atención',
  ANSWERED: 'Respondido',
  ARCHIVED: 'Archivado',
};

export class ListContactMessagesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'lucia',
    description: 'Busca en nombre, correo, organización y texto del mensaje.',
  })
  @IsOptional()
  @trim
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ enum: ContactStatus, enumName: 'ContactStatus' })
  @IsOptional()
  @IsEnum(ContactStatus)
  status?: ContactStatus;

  @ApiPropertyOptional({ enum: ContactSubject, enumName: 'ContactSubject' })
  @IsOptional()
  @IsEnum(ContactSubject)
  subject?: ContactSubject;

  @ApiPropertyOptional({ enum: ContactOrigin, enumName: 'ContactOrigin' })
  @IsOptional()
  @IsEnum(ContactOrigin)
  origin?: ContactOrigin;

  @ApiPropertyOptional({ example: '2026-11-01T00:00:00.000Z', description: 'Desde (ISO 8601).' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-11-30T23:59:59.999Z', description: 'Hasta (ISO 8601).' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    enum: ['CREATED_DESC', 'CREATED_ASC'],
    default: 'CREATED_DESC',
    description: 'Orden por fecha de recepción.',
  })
  @IsOptional()
  @IsIn(['CREATED_DESC', 'CREATED_ASC'])
  sort?: 'CREATED_DESC' | 'CREATED_ASC';
}

export class ContactHandlerDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Laura Coordinación', nullable: true, type: String })
  fullName!: string | null;

  @ApiProperty({ example: 'coordinacion@escuelaitinerante.org' })
  email!: string;
}

export class AdminContactPhoneDto {
  @ApiProperty({ example: '+52', nullable: true, type: String })
  countryCode!: string | null;

  @ApiProperty({ example: '5512345678' })
  number!: string;
}

export class AdminContactMessageDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Lucía Hernández' })
  name!: string;

  @ApiProperty({ example: 'lucia@example.com' })
  email!: string;

  @ApiProperty({ example: 'Cooperativa Agua Viva', nullable: true, type: String })
  organization!: string | null;

  @ApiProperty({ type: AdminContactPhoneDto, nullable: true })
  phone!: AdminContactPhoneDto | null;

  @ApiProperty({ enum: ContactSubject, enumName: 'ContactSubject' })
  subject!: ContactSubject;

  @ApiProperty({ example: 'Escuela', description: 'Asunto en español.' })
  subjectLabel!: string;

  @ApiProperty({ enum: ContactOrigin, enumName: 'ContactOrigin' })
  origin!: ContactOrigin;

  @ApiProperty({ example: 'Página de Contacto', description: 'Origen en español.' })
  originLabel!: string;

  @ApiProperty({
    enum: ContactProjectType,
    enumName: 'ContactProjectType',
    nullable: true,
    description: 'Solo con subject = DESIGN_CONSULTING.',
  })
  projectType!: ContactProjectType | null;

  @ApiProperty({ example: 'San Cristóbal de las Casas, Chiapas', nullable: true, type: String })
  projectLocation!: string | null;

  @ApiProperty({ enum: ContactService, enumName: 'ContactService', nullable: true })
  service!: ContactService | null;

  @ApiProperty({ example: 'Hola, quisiera información sobre el próximo diplomado.' })
  message!: string;

  @ApiProperty({ enum: ContactStatus, enumName: 'ContactStatus' })
  status!: ContactStatus;

  @ApiProperty({ example: 'Nuevo', description: 'Estado en español.' })
  statusLabel!: string;

  @ApiProperty({ example: 'Se le envió el temario por correo.', nullable: true, type: String })
  internalNote!: string | null;

  @ApiProperty({
    type: ContactHandlerDto,
    nullable: true,
    description: 'Último integrante que cambió el estado o la nota.',
  })
  handledBy!: ContactHandlerDto | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  handledAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class ContactStatusCountDto {
  @ApiProperty({ enum: ContactStatus, enumName: 'ContactStatus' })
  status!: ContactStatus;

  @ApiProperty({ example: 'Nuevo' })
  label!: string;

  @ApiProperty({ example: 4 })
  count!: number;
}

export class ContactInboxSummaryDto {
  @ApiProperty({ example: 4, description: 'Mensajes en NEW (para el contador del menú).' })
  unread!: number;

  @ApiProperty({
    type: [ContactStatusCountDto],
    description: 'Un elemento por estado (incluye 0).',
  })
  byStatus!: ContactStatusCountDto[];
}

/** PATCH: al menos uno de los dos campos. */
export class UpdateContactMessageRequestDto {
  @ApiPropertyOptional({ enum: ContactStatus, enumName: 'ContactStatus' })
  @IsOptional()
  @IsEnum(ContactStatus, { message: 'Elige un estado de la lista.' })
  status?: ContactStatus;

  @ApiPropertyOptional({
    example: 'Se le envió el temario por correo.',
    nullable: true,
    type: String,
    maxLength: BUSINESS_RULES.CONTACT_INTERNAL_NOTE_MAX_LENGTH,
    description: 'Nota interna; `null` o "" la borra.',
  })
  @IsOptional()
  @trim
  @IsString()
  @MaxLength(BUSINESS_RULES.CONTACT_INTERNAL_NOTE_MAX_LENGTH, {
    message: `La nota admite hasta ${BUSINESS_RULES.CONTACT_INTERNAL_NOTE_MAX_LENGTH} caracteres.`,
  })
  internalNote?: string | null;
}
