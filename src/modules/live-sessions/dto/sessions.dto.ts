import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { BUSINESS_RULES } from '../../../config/business-rules';
import {
  AttendanceSource,
  CalendarCategory,
  SessionStatus,
} from '../../../generated/prisma/client';
import {
  PortalOfferRefDto,
  PortalVenueDto,
  ProgressDto,
} from '../../enrollments/dto/portal-shared.dto';
import {
  AttendanceStatus,
  AttendanceWindowState,
  JoinState,
  RecordingState,
} from '../policies/session.policy';

const DATE = { type: String, format: 'date-time' } as const;
const OPTIONAL_DATE = { ...DATE, nullable: true } as const;

export class SessionModuleRefDto {
  @ApiProperty({ format: 'uuid', example: '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f' })
  id!: string;

  @ApiProperty({ example: 3, description: '"Módulo N".' })
  number!: number;

  @ApiProperty({ example: 'Humedales construidos' })
  title!: string;
}

export class SessionJoinDto {
  @ApiProperty({
    enum: Object.values(JoinState),
    example: 'NOT_YET',
    description:
      '`OPEN` → [Entrar a sesión] con `url`; `NOT_YET` → deshabilitado hasta `opensAt` (cuenta ' +
      'regresiva; vuelve a pedir la sesión al llegar); `LINK_PENDING` "Enlace aún no disponible"; ' +
      '`CANCELLED` "Cancelada"; `ENDED`; `IN_PERSON` (sin enlace).',
  })
  state!: JoinState;

  @ApiProperty({
    ...DATE,
    example: '2026-11-07T15:50:00.000Z',
    description: 'Inicio − 10 min (BUSINESS_RULES.SESSION_JOIN_WINDOW_MINUTES_BEFORE).',
  })
  opensAt!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'join_url (Zoom/Meet) SOLO con `state = OPEN`. Nunca el enlace de anfitrión.',
  })
  url!: string | null;
}

export class SessionRecordingDto {
  @ApiProperty({
    enum: Object.values(RecordingState),
    example: 'PENDING',
    description:
      '`AVAILABLE` [Ver grabación]; `AFTER_SESSION` "Disponible después de la sesión"; `PENDING` ' +
      '"Grabación pendiente"; `NOT_APPLICABLE` sin grabación.',
  })
  state!: RecordingState;

  @ApiProperty({ type: String, nullable: true, example: null, description: 'Enlace externo.' })
  url!: string | null;
}

export class SessionAttendanceDto {
  @ApiProperty({
    enum: Object.values(AttendanceStatus),
    example: 'PENDING',
    description: 'Pendiente / Registrada / No registrada (`NOT_APPLICABLE` en canceladas).',
  })
  status!: AttendanceStatus;

  @ApiProperty({
    enum: Object.values(AttendanceWindowState),
    example: 'NOT_OPEN_YET',
    description: 'Ventana de registro: abre al terminar la sesión y dura N h (24 h por defecto).',
  })
  windowState!: AttendanceWindowState;

  @ApiProperty({ ...DATE, example: '2026-11-07T19:00:00.000Z', description: 'Fin de la sesión.' })
  opensAt!: string;

  @ApiProperty({
    ...DATE,
    example: '2026-11-08T19:00:00.000Z',
    description: '"Puedes registrar hasta el …" / "Cierra en 21 h 35 min".',
  })
  closesAt!: string;

  @ApiProperty({ example: 24, description: 'Duración de la ventana (sesión ?? oferta).' })
  windowHours!: number;

  @ApiProperty({ example: false, description: 'Habilita [Registrar asistencia].' })
  canRegister!: boolean;

  @ApiProperty({ ...OPTIONAL_DATE, example: null, description: '"Asistencia registrada el …".' })
  registeredAt!: string | null;

  @ApiProperty({
    enum: AttendanceSource,
    nullable: true,
    example: null,
    description: '`MANUAL` = la marcó el equipo (p. ej. pase de lista en sitio).',
  })
  source!: AttendanceSource | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  comment!: string | null;
}

/** Sesión vista por el participante (HU-10, 12, 17, 18). */
export class SessionCardDto {
  @ApiProperty({ format: 'uuid', example: '0b6f2c1e-8d1a-4f7e-9a51-3c2d1e0f9a8b' })
  id!: string;

  @ApiProperty({ type: PortalOfferRefDto })
  offer!: PortalOfferRefDto;

  @ApiProperty({ type: SessionModuleRefDto, nullable: true })
  module!: SessionModuleRefDto | null;

  @ApiProperty({
    example: ['Ana Solís Ríos'],
    description: 'Docente(s) del módulo o de la oferta.',
  })
  teacherNames!: string[];

  @ApiProperty({ ...DATE, example: '2026-11-07T16:00:00.000Z' })
  startsAt!: string;

  @ApiProperty({ ...DATE, example: '2026-11-07T19:00:00.000Z' })
  endsAt!: string;

  @ApiProperty({
    example: 'America/Mexico_City',
    description: 'Hora oficial de referencia (CDMX).',
  })
  timezone!: string;

  @ApiProperty({ enum: SessionStatus, example: 'SCHEDULED' })
  status!: SessionStatus;

  @ApiProperty({ enum: CalendarCategory, example: 'TRAINING' })
  category!: CalendarCategory;

  @ApiProperty({
    ...OPTIONAL_DATE,
    example: null,
    description: 'Si fue reprogramada: inicio original (HU-29).',
  })
  originalStartsAt!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'Motivo de reprogramación/cancelación.',
  })
  changeReason!: string | null;

  @ApiProperty({
    enum: ['ZOOM', 'GOOGLE_MEET', 'OTHER'],
    nullable: true,
    example: 'ZOOM',
    description: 'Plataforma (ícono), deducida del enlace aunque aún no se entregue.',
  })
  platform!: 'ZOOM' | 'GOOGLE_MEET' | 'OTHER' | null;

  @ApiProperty({ type: PortalVenueDto, nullable: true, description: 'Presencial: lugar.' })
  venue!: PortalVenueDto | null;

  @ApiProperty({ type: SessionJoinDto })
  join!: SessionJoinDto;

  @ApiProperty({ type: SessionRecordingDto })
  recording!: SessionRecordingDto;

  @ApiProperty({ type: SessionAttendanceDto })
  attendance!: SessionAttendanceDto;
}

export const SESSION_SCOPES = ['UPCOMING', 'PAST'] as const;
export type SessionScope = (typeof SESSION_SCOPES)[number];

export class ListSessionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: SESSION_SCOPES,
    default: 'UPCOMING',
    description:
      '`UPCOMING`: próximas y en curso (de la más cercana a la más lejana). `PAST`: historial (de ' +
      'la más reciente a la más antigua).',
  })
  @IsOptional()
  @IsIn(SESSION_SCOPES)
  scope: SessionScope = 'UPCOMING';

  @ApiPropertyOptional({ format: 'uuid', description: 'Solo las sesiones de una oferta.' })
  @IsOptional()
  @IsUUID('4')
  offerId?: string;
}

export class RegisterAttendanceRequestDto {
  @ApiProperty({
    example: true,
    description: 'Checkbox "Asistí a la sesión" (obligatorio, debe ser `true`).',
  })
  @Equals(true, { message: 'Debes confirmar que asististe a la sesión.' })
  attended!: boolean;

  @ApiPropertyOptional({
    example: 'Me llevo cómo dimensionar un humedal para una vivienda.',
    maxLength: BUSINESS_RULES.ATTENDANCE_COMMENT_MAX_LENGTH,
    description: '"¿Qué te llevas de esta sesión?" (opcional, máx. 500).',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(BUSINESS_RULES.ATTENDANCE_COMMENT_MAX_LENGTH, {
    message: `El comentario admite máximo ${BUSINESS_RULES.ATTENDANCE_COMMENT_MAX_LENGTH} caracteres.`,
  })
  comment?: string;
}

export class AttendanceResultDto {
  @ApiProperty({
    type: SessionCardDto,
    description: 'Sesión con `attendance.status = REGISTERED`.',
  })
  session!: SessionCardDto;

  @ApiProperty({ type: ProgressDto, description: 'Progreso recalculado del Aula.' })
  progress!: ProgressDto;
}
