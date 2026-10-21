import { ApiProperty } from '@nestjs/swagger';
import { EnrollmentOrigin, EnrollmentStatus } from '../../../generated/prisma/client';
import { PortalOfferRefDto, PortalVenueDto, ProgressDto } from './portal-shared.dto';

export class FormationOfferDto extends PortalOfferRefDto {
  @ApiProperty({ type: String, nullable: true, example: 'https://placehold.co/1200x630/png' })
  coverImageUrl!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Generación 2026–2027' })
  cohortLabel!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-11-07T16:00:00.000Z',
  })
  startsAt!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2027-01-31T19:00:00.000Z',
  })
  endsAt!: string | null;

  @ApiProperty({ type: PortalVenueDto, nullable: true, description: 'Solo presenciales.' })
  venue!: PortalVenueDto | null;
}

export class NextSessionRefDto {
  @ApiProperty({ format: 'uuid', example: '0b6f2c1e-8d1a-4f7e-9a51-3c2d1e0f9a8b' })
  id!: string;

  @ApiProperty({ example: '2026-11-07T16:00:00.000Z', description: 'UTC; muestra tu hora + CDMX.' })
  startsAt!: string;

  @ApiProperty({ example: '2026-11-07T19:00:00.000Z' })
  endsAt!: string;
}

export const SCHEDULE_STATUS_VALUES = [
  'HAS_NEXT_SESSION',
  'NO_UPCOMING_SESSIONS',
  'FINISHED',
] as const;
export type ScheduleStatus = (typeof SCHEDULE_STATUS_VALUES)[number];

/** Tarjeta de "Mi formación" (HU-07) y del Dashboard (HU-06). */
export class FormationCardDto {
  @ApiProperty({ format: 'uuid', example: '1f2e3d4c-5b6a-4798-8a7b-6c5d4e3f2a1b' })
  enrollmentId!: string;

  @ApiProperty({ enum: EnrollmentStatus, example: 'ACTIVE' })
  status!: EnrollmentStatus;

  @ApiProperty({
    enum: ['ACTIVE', 'COMPLETED'],
    example: 'ACTIVE',
    description: 'Pestaña: Activos / Completados (completada si la oferta ya terminó).',
  })
  phase!: 'ACTIVE' | 'COMPLETED';

  @ApiProperty({
    enum: EnrollmentOrigin,
    example: 'NAS',
    description: '`MOODLE` → badge "Vía Moodle".',
  })
  origin!: EnrollmentOrigin;

  @ApiProperty({
    example: true,
    description: '[Continuar] habilitado (acceso al Aula). `false` si está suspendida.',
  })
  canContinue!: boolean;

  @ApiProperty({ type: FormationOfferDto })
  offer!: FormationOfferDto;

  @ApiProperty({ type: ProgressDto })
  progress!: ProgressDto;

  @ApiProperty({ type: NextSessionRefDto, nullable: true })
  nextSession!: NextSessionRefDto | null;

  @ApiProperty({
    enum: SCHEDULE_STATUS_VALUES,
    example: 'HAS_NEXT_SESSION',
    description: 'Sin próxima sesión: `FINISHED` ("Finalizado") o `NO_UPCOMING_SESSIONS`.',
  })
  scheduleStatus!: ScheduleStatus;

  @ApiProperty({ example: '2026-10-20T18:00:00.000Z' })
  enrolledAt!: string;
}
