import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination.dto';
import {
  CalendarAudience,
  CalendarCategory,
  CalendarEventKind,
  SessionStatus,
} from '../../../../generated/prisma/client';

export class AdminCalendarQueryDto {
  @ApiProperty({ example: '2026-10-26T06:00:00.000Z', description: 'Inicio del rango (ISO 8601).' })
  @Type(() => Date)
  @IsDate({ message: 'Debe ser una fecha ISO 8601 válida.' })
  from!: Date;

  @ApiProperty({
    example: '2026-12-07T06:00:00.000Z',
    description: 'Fin (exclusivo). Máximo 62 días después de `from`.',
  })
  @Type(() => Date)
  @IsDate({ message: 'Debe ser una fecha ISO 8601 válida.' })
  to!: Date;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrar por oferta.' })
  @IsOptional()
  @IsUUID('all')
  offerId?: string;

  @ApiPropertyOptional({ enum: CalendarCategory, description: 'Filtrar por categoría de color.' })
  @IsOptional()
  @IsEnum(CalendarCategory)
  category?: CalendarCategory;
}

export class AdminCalendarOfferRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Diplomado en Ecotecnologías del Agua' })
  name!: string;
}

export class AdminCalendarItemDto {
  @ApiProperty({ enum: ['SESSION', 'EVENT'], example: 'SESSION' })
  source!: 'SESSION' | 'EVENT';

  @ApiProperty({ format: 'uuid', description: 'Id de la sesión o del evento.' })
  id!: string;

  @ApiProperty({ enum: ['SESSION', ...Object.values(CalendarEventKind)], example: 'SESSION' })
  kind!: string;

  @ApiProperty({ example: 'Diplomado en Ecotecnologías del Agua — Módulo 3' })
  title!: string;

  @ApiProperty({
    enum: CalendarCategory,
    example: 'TRAINING',
    description:
      'Formación (azul), Territorio (verde), Comunidad (naranja), Eventos (morado), Fechas importantes (rojo).',
  })
  category!: CalendarCategory;

  @ApiProperty({ example: '2026-11-07T16:00:00.000Z' })
  startsAt!: string;

  @ApiProperty({ example: '2026-11-07T19:00:00.000Z', nullable: true, type: String })
  endsAt!: string | null;

  @ApiProperty({ example: false })
  allDay!: boolean;

  @ApiProperty({ enum: SessionStatus, example: 'SCHEDULED' })
  status!: SessionStatus;

  @ApiProperty({ type: AdminCalendarOfferRefDto, nullable: true })
  offer!: AdminCalendarOfferRefDto | null;

  @ApiProperty({
    enum: CalendarAudience,
    nullable: true,
    example: null,
    description: 'Solo eventos.',
  })
  audience!: CalendarAudience | null;

  @ApiProperty({ example: false, description: 'Sesión reprogramada (ícono "editada").' })
  edited!: boolean;

  @ApiProperty({ example: false, description: 'En línea sin enlace (ícono "sin enlace").' })
  missingLink!: boolean;
}

export class AdminCalendarDto {
  @ApiProperty({ type: [AdminCalendarItemDto] })
  data!: AdminCalendarItemDto[];
}

export class ListCalendarEventsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all')
  offerId?: string;

  @ApiPropertyOptional({
    enum: CalendarEventKind,
    description: 'MANUAL = eventos manuales; el resto son fechas importantes.',
  })
  @IsOptional()
  @IsEnum(CalendarEventKind)
  kind?: CalendarEventKind;

  @ApiPropertyOptional({ enum: CalendarCategory })
  @IsOptional()
  @IsEnum(CalendarCategory)
  category?: CalendarCategory;

  @ApiPropertyOptional({ enum: SessionStatus })
  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;

  @ApiPropertyOptional({ example: '2026-11-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: ['STARTS_AT_ASC', 'STARTS_AT_DESC'], default: 'STARTS_AT_ASC' })
  @IsOptional()
  @IsIn(['STARTS_AT_ASC', 'STARTS_AT_DESC'])
  sort?: 'STARTS_AT_ASC' | 'STARTS_AT_DESC';
}

export class AdminCalendarEventDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CalendarEventKind, example: 'MANUAL' })
  kind!: CalendarEventKind;

  @ApiProperty({ example: 'Webinar: cosecha de agua de lluvia' })
  title!: string;

  @ApiProperty({ example: 'Charla abierta con la comunidad.', nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ enum: CalendarCategory, example: 'EVENTS' })
  category!: CalendarCategory;

  @ApiProperty({ enum: CalendarAudience, example: 'ALL_REGISTERED' })
  audience!: CalendarAudience;

  @ApiProperty({ type: AdminCalendarOfferRefDto, nullable: true })
  offer!: AdminCalendarOfferRefDto | null;

  @ApiProperty({ example: '2026-11-20T00:00:00.000Z' })
  startsAt!: string;

  @ApiProperty({ example: '2026-11-20T01:30:00.000Z', nullable: true, type: String })
  endsAt!: string | null;

  @ApiProperty({ example: false })
  allDay!: boolean;

  @ApiProperty({ example: null, nullable: true, type: String })
  location!: string | null;

  @ApiProperty({ example: 'https://zoom.us/j/1', nullable: true, type: String })
  joinUrl!: string | null;

  @ApiProperty({ enum: SessionStatus, example: 'SCHEDULED' })
  status!: SessionStatus;

  @ApiProperty({ example: '2026-11-01T16:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-11-01T16:00:00.000Z' })
  updatedAt!: string;
}

export class CreateCalendarEventRequestDto {
  @ApiProperty({ example: 'Webinar: cosecha de agua de lluvia' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ example: 'Charla abierta con la comunidad.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({
    enum: CalendarCategory,
    default: 'EVENTS',
    description: 'Default Eventos (morado).',
  })
  @IsOptional()
  @IsEnum(CalendarCategory)
  category?: CalendarCategory;

  @ApiProperty({
    enum: CalendarAudience,
    example: 'ALL_REGISTERED',
    description: 'Todas las personas registradas o solo inscritos de `offerId`.',
  })
  @IsEnum(CalendarAudience)
  audience!: CalendarAudience;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Obligatoria con OFFER_ENROLLED; opcional ("Ver oferta") con ALL_REGISTERED.',
  })
  @IsOptional()
  @IsUUID('all')
  offerId?: string;

  @ApiProperty({ example: '2026-11-20T00:00:00.000Z' })
  @IsDateString()
  startsAt!: string;

  @ApiPropertyOptional({ example: '2026-11-20T01:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiPropertyOptional({ example: 'Sede Xochimilco' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string;

  @ApiPropertyOptional({
    example: 'https://zoom.us/j/123',
    description: 'Enlace https (solo lo ve la audiencia).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  joinUrl?: string;
}

export class UpdateCalendarEventRequestDto {
  @ApiPropertyOptional({ example: 'Webinar: cosecha de agua de lluvia' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({ enum: CalendarCategory })
  @IsOptional()
  @IsEnum(CalendarCategory)
  category?: CalendarCategory;

  @ApiPropertyOptional({ enum: CalendarAudience })
  @IsOptional()
  @IsEnum(CalendarAudience)
  audience?: CalendarAudience;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  @IsOptional()
  @IsUUID('all')
  offerId?: string | null;

  @ApiPropertyOptional({ example: '2026-11-20T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  joinUrl?: string | null;
}
