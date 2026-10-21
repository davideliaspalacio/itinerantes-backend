import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  AttendanceSource,
  EnrollmentOrigin,
  EnrollmentStatus,
} from '../../../../generated/prisma/client';
import { AttendanceStatus } from '../../policies/session.policy';
import { AdminSessionState } from '../policies/session-admin.policy';

const STATUSES = Object.values(AttendanceStatus);

export class SessionAttendanceQueryDto {
  @ApiPropertyOptional({ enum: STATUSES, description: 'Registrada / Pendiente / No registrada.' })
  @IsOptional()
  @IsIn(STATUSES)
  status?: AttendanceStatus;

  @ApiPropertyOptional({ example: 'MX', description: 'País del perfil (ISO-3166 alpha-2).' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @Length(2, 2)
  countryCode?: string;

  @ApiPropertyOptional({
    example: 'maría',
    description: 'Nombre o correo (sin distinguir mayúsculas).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class ParticipantAttendanceQueryDto {
  @ApiPropertyOptional({ example: 'MX' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @Length(2, 2)
  countryCode?: string;

  @ApiPropertyOptional({ example: 'maría' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Solo personas bajo el umbral de alerta (80%).',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  belowThreshold?: boolean;
}

export class AttendanceSessionChipDto {
  @ApiProperty({ format: 'uuid' })
  sessionId!: string;

  @ApiProperty({ example: '2026-11-07T16:00:00.000Z' })
  startsAt!: string;

  @ApiProperty({ example: '2026-11-07T19:00:00.000Z' })
  endsAt!: string;

  @ApiProperty({ enum: AdminSessionState, example: 'REGISTRATION_OPEN' })
  state!: AdminSessionState;

  @ApiProperty({
    example: '2026-11-07T19:00:00.000Z',
    description: 'Apertura del registro (fin de la sesión).',
  })
  opensAt!: string;

  @ApiProperty({ example: '2026-11-08T19:00:00.000Z', description: 'Cierre del registro.' })
  closesAt!: string;

  @ApiProperty({ example: 18 })
  registered!: number;

  @ApiProperty({ example: 25 })
  total!: number;

  @ApiProperty({ example: 72 })
  percent!: number;
}

export class AttendanceSessionChipsDto {
  @ApiProperty({ type: [AttendanceSessionChipDto] })
  data!: AttendanceSessionChipDto[];
}

export class AttendanceSummaryDto {
  @ApiProperty({ example: 18 })
  registered!: number;

  @ApiProperty({ example: 25, description: 'Inscritos vigentes (sin filtros).' })
  total!: number;

  @ApiProperty({ example: 72 })
  percent!: number;

  @ApiProperty({ example: '18 de 25 registraron asistencia (72%)' })
  label!: string;
}

export class AttendancePersonRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Laura Coordinación' })
  fullName!: string;
}

export class SessionAttendanceRowDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ example: 'María José Núñez' })
  fullName!: string;

  @ApiProperty({ example: 'maria@example.com' })
  email!: string;

  @ApiProperty({ example: 'MX' })
  countryCode!: string;

  @ApiProperty({ enum: EnrollmentOrigin, example: 'NAS', description: 'NAS o "Vía Moodle".' })
  origin!: EnrollmentOrigin;

  @ApiProperty({ enum: EnrollmentStatus, example: 'ACTIVE' })
  enrollmentStatus!: EnrollmentStatus;

  @ApiProperty({ enum: STATUSES, example: 'REGISTERED' })
  status!: AttendanceStatus;

  @ApiProperty({ example: '2026-11-07T19:12:00.000Z', nullable: true, type: String })
  registeredAt!: string | null;

  @ApiProperty({
    enum: AttendanceSource,
    nullable: true,
    example: 'PARTICIPANT',
    description: 'Participante / Manual.',
  })
  source!: AttendanceSource | null;

  @ApiProperty({ example: 'Me llevo el diseño del humedal.', nullable: true, type: String })
  comment!: string | null;

  @ApiProperty({
    type: AttendancePersonRefDto,
    nullable: true,
    description: 'Quién la marcó (manual).',
  })
  recordedBy!: AttendancePersonRefDto | null;

  @ApiProperty({
    example: null,
    nullable: true,
    type: String,
    description: 'Motivo de la marca manual.',
  })
  manualReason!: string | null;
}

export class SessionAttendanceDto {
  @ApiProperty({ type: AttendanceSessionChipDto })
  session!: AttendanceSessionChipDto;

  @ApiProperty({ type: AttendanceSummaryDto })
  summary!: AttendanceSummaryDto;

  @ApiProperty({
    type: [SessionAttendanceRowDto],
    description: 'Filas filtradas (status, countryCode, q).',
  })
  rows!: SessionAttendanceRowDto[];
}

export class ParticipantAttendanceRowDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ example: 'María José Núñez' })
  fullName!: string;

  @ApiProperty({ example: 'maria@example.com' })
  email!: string;

  @ApiProperty({ example: 'MX' })
  countryCode!: string;

  @ApiProperty({ enum: EnrollmentOrigin, example: 'NAS' })
  origin!: EnrollmentOrigin;

  @ApiProperty({ enum: EnrollmentStatus, example: 'ACTIVE' })
  enrollmentStatus!: EnrollmentStatus;

  @ApiProperty({ example: 8 })
  attended!: number;

  @ApiProperty({ example: 10, description: 'Sesiones ya realizadas (no canceladas).' })
  heldSessions!: number;

  @ApiProperty({
    example: 80,
    nullable: true,
    type: Number,
    description: 'null si aún no hay sesiones realizadas.',
  })
  percent!: number | null;

  @ApiProperty({ example: false, description: 'Alerta bajo 80% (solo visual).' })
  belowThreshold!: boolean;
}

export class ParticipantAttendanceDto {
  @ApiProperty({ example: 10 })
  heldSessions!: number;

  @ApiProperty({ example: 80, description: 'Umbral de alerta (%).' })
  thresholdPercent!: number;

  @ApiProperty({ type: [ParticipantAttendanceRowDto] })
  rows!: ParticipantAttendanceRowDto[];
}

export class MarkAttendanceRequestDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    example: ['5f0c…'],
    description: 'Personas (1–200). Selección múltiple o "Pasar lista en sitio".',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  userIds!: string[];

  @ApiProperty({
    example: 'Pasó lista en sitio (taller presencial).',
    description: 'Motivo obligatorio.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class MarkAttendanceResultDto {
  @ApiProperty({ example: 3 })
  marked!: number;

  @ApiProperty({ example: 1, description: 'Ya estaban registradas (se omiten).' })
  alreadyRegistered!: number;
}

export class UnmarkAttendanceResultDto {
  @ApiProperty({ example: 1 })
  unmarked!: number;
}

export class RemindAttendanceResultDto {
  @ApiProperty({
    example: 7,
    description: 'Personas pendientes notificadas (máx. un recordatorio por día).',
  })
  notified!: number;
}
