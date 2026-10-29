import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional } from 'class-validator';
import {
  CalendarCategory,
  CalendarEventKind,
  SessionStatus,
} from '../../../generated/prisma/client';
import { PortalOfferRefDto, PortalVenueDto } from '../../enrollments/dto/portal-shared.dto';
import { SessionJoinDto, SessionModuleRefDto } from '../../live-sessions/dto/sessions.dto';

const csvArray = Transform(({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  const items = (Array.isArray(value) ? value : [value]).flatMap((v) => String(v).split(','));
  const clean = items.map((v) => v.trim()).filter(Boolean);
  return clean.length ? clean : undefined;
});

export class CalendarQueryDto {
  @ApiProperty({
    example: '2026-10-26T06:00:00.000Z',
    description:
      'Inicio del rango (ISO 8601 con zona). Normalmente el primer día visible de la cuadrícula.',
  })
  @Type(() => Date)
  @IsDate({ message: 'Debe ser una fecha ISO 8601 válida.' })
  from!: Date;

  @ApiProperty({
    example: '2026-12-07T06:00:00.000Z',
    description: 'Fin del rango (exclusivo). Máximo 62 días después de `from`.',
  })
  @Type(() => Date)
  @IsDate({ message: 'Debe ser una fecha ISO 8601 válida.' })
  to!: Date;

  @ApiPropertyOptional({
    enum: CalendarCategory,
    isArray: true,
    example: ['TRAINING', 'IMPORTANT_DATES'],
    description:
      'Categorías (por defecto todas). Los chips de la UI pueden filtrar en cliente sin recargar.',
  })
  @IsOptional()
  @csvArray
  @IsEnum(CalendarCategory, { each: true })
  categories?: CalendarCategory[];
}

export class CalendarLinkDto {
  @ApiProperty({
    enum: ['CLASSROOM', 'OFFER', 'APPLICATION', 'NONE'],
    example: 'CLASSROOM',
    description:
      '`CLASSROOM` → Aula (`offerId`); `OFFER` → ficha `/escuela/oferta/{slug}`; `APPLICATION` ' +
      '(Fase 04, entrevistas) → mi postulación `/postulaciones/{applicationId}`.',
  })
  kind!: 'CLASSROOM' | 'OFFER' | 'APPLICATION' | 'NONE';

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'uuid',
    example: '9d3c6a1e-2b4f-4c8d-9e0a-1b2c3d4e5f60',
  })
  offerId!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'diplomado-en-ecotecnologias-del-agua' })
  slug!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'uuid',
    example: null,
    description: 'Fase 04: postulación de la entrevista (`kind = APPLICATION`).',
  })
  applicationId!: string | null;
}

export class CalendarItemDto {
  @ApiProperty({ format: 'uuid', example: '0b6f2c1e-8d1a-4f7e-9a51-3c2d1e0f9a8b' })
  id!: string;

  @ApiProperty({
    enum: ['SESSION', 'EVENT', 'ACTIVITY', 'APPLICATION'],
    example: 'SESSION',
    description:
      '`SESSION` = clase generada desde el horario (no editable); `EVENT` = evento manual o fecha ' +
      'importante; `ACTIVITY` = fecha de una actividad de módulo (HU-08, "Fecha importante"); ' +
      '`APPLICATION` = entrevista por Zoom de una postulación (Fase 04, "Fecha importante").',
  })
  source!: 'SESSION' | 'EVENT' | 'ACTIVITY' | 'APPLICATION';

  @ApiProperty({
    enum: ['SESSION', 'ACTIVITY_DUE', 'INTERVIEW', ...Object.values(CalendarEventKind)],
    example: 'SESSION',
    description:
      'Tipo: SESSION, ACTIVITY_DUE, INTERVIEW (entrevista de postulación, Fase 04), MANUAL ' +
      '(webinar/encuentro) o fecha importante automática (ENROLLMENT_OPENS, ENROLLMENT_CLOSES, ' +
      'OFFER_STARTS, SCHOLARSHIP_DEADLINE, FINAL_PROJECT).',
  })
  kind!: 'SESSION' | 'ACTIVITY_DUE' | 'INTERVIEW' | CalendarEventKind;

  @ApiProperty({ example: 'Diplomado en Ecotecnologías del Agua' })
  title!: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  description!: string | null;

  @ApiProperty({
    enum: CalendarCategory,
    example: 'TRAINING',
    description:
      'Color: Formación azul, Territorio verde, Comunidad naranja, Eventos morado, Fechas importantes rojo.',
  })
  category!: CalendarCategory;

  @ApiProperty({ example: '2026-11-07T16:00:00.000Z' })
  startsAt!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-11-07T19:00:00.000Z',
  })
  endsAt!: string | null;

  @ApiProperty({ example: false, description: 'Evento de día completo (fechas importantes).' })
  allDay!: boolean;

  @ApiProperty({ example: 'America/Mexico_City' })
  timezone!: string;

  @ApiProperty({
    enum: SessionStatus,
    example: 'SCHEDULED',
    description: '`CANCELLED` → "Cancelada", sin enlace.',
  })
  status!: SessionStatus;

  @ApiProperty({ type: PortalOfferRefDto, nullable: true })
  offer!: PortalOfferRefDto | null;

  @ApiProperty({ type: SessionModuleRefDto, nullable: true })
  module!: SessionModuleRefDto | null;

  @ApiProperty({
    type: PortalVenueDto,
    nullable: true,
    description: 'Presencial (hora local del lugar).',
  })
  venue!: PortalVenueDto | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'Lugar libre de eventos manuales.',
  })
  location!: string | null;

  @ApiProperty({
    type: SessionJoinDto,
    nullable: true,
    description: 'Acceso (HU-12) si la actividad es en línea; null en fechas importantes.',
  })
  join!: SessionJoinDto | null;

  @ApiProperty({ type: CalendarLinkDto })
  link!: CalendarLinkDto;
}

export class CalendarResponseDto {
  @ApiProperty({ type: [CalendarItemDto] })
  data!: CalendarItemDto[];
}
