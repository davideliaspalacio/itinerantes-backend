import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  ApplicationKind,
  ApplicationStatus,
  EnrollmentSource,
  OfferType,
} from '../../../generated/prisma/enums';
import { CurrencyTotalsDto } from '../../payments/admin/dto/admin-payments.response.dto';

export class AdminDashboardQueryDto {
  @ApiPropertyOptional({
    example: '2026-10-01T00:00:00.000Z',
    description: 'Inicio del periodo (ISO 8601). Por defecto: 30 días antes de `to`.',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-31T23:59:59.999Z',
    description: 'Fin del periodo (ISO 8601). Por defecto: ahora.',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class AdminDashboardTrendsQueryDto {
  @ApiPropertyOptional({ example: 6, default: 6, minimum: 1, maximum: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number;
}

export class DashboardPeriodDto {
  @ApiProperty({ type: String, format: 'date-time' })
  from!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  to!: string;
}

export class CountryCountDto {
  @ApiProperty({ example: 'MX' })
  countryCode!: string;

  @ApiProperty({ example: 42 })
  count!: number;
}

export class DashboardPeopleDto {
  @ApiProperty({ example: 120, description: 'Cuentas de participantes (sin el equipo).' })
  total!: number;

  @ApiProperty({ example: 110 })
  active!: number;

  @ApiProperty({ example: 8, description: 'Registradas sin verificar el correo.' })
  pendingVerification!: number;

  @ApiProperty({ example: 2 })
  disabled!: number;

  @ApiProperty({ example: 15, description: 'Registradas dentro del periodo.' })
  newInPeriod!: number;

  @ApiProperty({ type: [CountryCountDto], description: 'Los 5 países con más personas.' })
  topCountries!: CountryCountDto[];
}

export class EnrollmentStatusCountsDto {
  @ApiProperty({ example: 60 })
  active!: number;

  @ApiProperty({ example: 3 })
  pendingPayment!: number;

  @ApiProperty({ example: 20 })
  completed!: number;

  @ApiProperty({ example: 1 })
  suspended!: number;

  @ApiProperty({ example: 0 })
  cancelled!: number;
}

export class EnrollmentSourceCountDto {
  @ApiProperty({ enum: EnrollmentSource, enumName: 'EnrollmentSource' })
  source!: EnrollmentSource;

  @ApiProperty({ example: 12 })
  count!: number;
}

export class TopOfferDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Diplomado en Ecotecnologías' })
  name!: string;

  @ApiProperty({ enum: OfferType, enumName: 'OfferType' })
  type!: OfferType;

  @ApiProperty({ example: 25, description: 'Inscripciones activas + completadas.' })
  enrolled!: number;

  @ApiProperty({ example: 30, nullable: true, type: Number, description: 'null = sin cupo.' })
  capacity!: number | null;
}

export class DashboardTrainingDto {
  @ApiProperty({ example: 6 })
  publishedOffers!: number;

  @ApiProperty({ example: 3, description: 'Publicadas que ya empezaron y no han terminado.' })
  offersInProgress!: number;

  @ApiProperty({ type: EnrollmentStatusCountsDto })
  enrollments!: EnrollmentStatusCountsDto;

  @ApiProperty({ example: 18, description: 'Inscripciones creadas dentro del periodo.' })
  newEnrollmentsInPeriod!: number;

  @ApiProperty({ type: [EnrollmentSourceCountDto], description: 'Inscripciones por origen.' })
  bySource!: EnrollmentSourceCountDto[];

  @ApiProperty({ example: 4, description: 'Sesiones programadas en los próximos 7 días.' })
  upcomingSessions7d!: number;

  @ApiProperty({ type: [TopOfferDto], description: 'Las 5 ofertas con más inscripciones.' })
  topOffers!: TopOfferDto[];
}

export class ApplicationStatusCountDto {
  @ApiProperty({ enum: ApplicationStatus, enumName: 'ApplicationStatus' })
  status!: ApplicationStatus;

  @ApiProperty({ example: 5 })
  count!: number;
}

export class ApplicationKindCountDto {
  @ApiProperty({ enum: ApplicationKind, enumName: 'ApplicationKind' })
  kind!: ApplicationKind;

  @ApiProperty({ example: 20 })
  count!: number;
}

export class DashboardApplicationsDto {
  @ApiProperty({
    type: [ApplicationStatusCountDto],
    description: 'Un elemento por estado (incluye 0, sin DRAFT).',
  })
  byStatus!: ApplicationStatusCountDto[];

  @ApiProperty({ type: [ApplicationKindCountDto], description: 'Enviadas, por tipo (sin DRAFT).' })
  byKind!: ApplicationKindCountDto[];

  @ApiProperty({ example: 7, description: 'SUBMITTED + IN_REVIEW: esperan revisión.' })
  toReview!: number;

  @ApiProperty({ example: 2 })
  interviewsScheduled!: number;

  @ApiProperty({ example: 3, description: 'Aprobadas que aún no pagan o no confirman.' })
  approvedPending!: number;

  @ApiProperty({ example: 9, description: 'Enviadas dentro del periodo.' })
  submittedInPeriod!: number;
}

export class DashboardPlansDto {
  @ApiProperty({ example: 1, description: 'Planes con cobro fallido (en reintento).' })
  pastDue!: number;

  @ApiProperty({ example: 1, description: 'Planes en mora.' })
  delinquent!: number;
}

export class DashboardPaymentsDto {
  @ApiProperty({
    type: [CurrencyTotalsDto],
    description: 'Cobrado, reembolsado y neto dentro del periodo, por moneda (nunca se suman).',
  })
  currencies!: CurrencyTotalsDto[];

  @ApiProperty({ example: 2, description: 'Transferencias esperando validación.' })
  pendingTransfers!: number;

  @ApiProperty({ type: DashboardPlansDto })
  plans!: DashboardPlansDto;

  @ApiProperty({ example: 0 })
  pendingRefunds!: number;
}

export class DashboardContactDto {
  @ApiProperty({ example: 4, description: 'Mensajes de Contacto nuevos (NEW).' })
  unread!: number;
}

export const DASHBOARD_TASK_KEYS = [
  'APPLICATIONS_TO_REVIEW',
  'INTERVIEWS_SCHEDULED',
  'APPROVED_PENDING',
  'TRANSFERS_TO_VALIDATE',
  'PLANS_DELINQUENT',
  'REFUNDS_PENDING',
  'CONTACT_UNREAD',
  'SESSIONS_NEXT_7_DAYS',
] as const;
export type DashboardTaskKey = (typeof DASHBOARD_TASK_KEYS)[number];

export class DashboardTaskDto {
  @ApiProperty({ enum: DASHBOARD_TASK_KEYS, example: 'TRANSFERS_TO_VALIDATE' })
  key!: DashboardTaskKey;

  @ApiProperty({ example: 'Transferencias por validar' })
  label!: string;

  @ApiProperty({ example: 2 })
  count!: number;
}

export class AdminDashboardDto {
  @ApiProperty({ type: DashboardPeriodDto })
  period!: DashboardPeriodDto;

  @ApiProperty({ type: DashboardPeopleDto, description: 'Cualquier integrante del equipo.' })
  people!: DashboardPeopleDto;

  @ApiProperty({ type: DashboardTrainingDto, nullable: true, description: '`offers.read`.' })
  training!: DashboardTrainingDto | null;

  @ApiProperty({
    type: DashboardApplicationsDto,
    nullable: true,
    description: '`applications.read`; null sin ese permiso.',
  })
  applications!: DashboardApplicationsDto | null;

  @ApiProperty({
    type: DashboardPaymentsDto,
    nullable: true,
    description: '`payments.read`; null sin ese permiso.',
  })
  payments!: DashboardPaymentsDto | null;

  @ApiProperty({
    type: DashboardContactDto,
    nullable: true,
    description: '`contact.read`; null sin ese permiso.',
  })
  contact!: DashboardContactDto | null;

  @ApiProperty({
    type: [DashboardTaskDto],
    description:
      'Pendientes con count > 0 según los permisos de quien consulta (no dependen del periodo).',
  })
  tasks!: DashboardTaskDto[];
}

export class TrendMonthDto {
  @ApiProperty({ example: '2026-10', description: 'Mes (hora de Ciudad de México).' })
  month!: string;

  @ApiProperty({ example: 12 })
  newParticipants!: number;

  @ApiProperty({ example: 9, nullable: true, type: Number, description: 'null sin `offers.read`.' })
  newEnrollments!: number | null;

  @ApiProperty({
    example: 5,
    nullable: true,
    type: Number,
    description: 'null sin `applications.read`.',
  })
  submittedApplications!: number | null;

  @ApiProperty({
    example: 4500000,
    nullable: true,
    type: Number,
    description: 'Neto cobrado en MXN (centavos); null sin `payments.read`.',
  })
  netMxnCents!: number | null;

  @ApiProperty({
    example: 25000,
    nullable: true,
    type: Number,
    description: 'Neto cobrado en USD (centavos); null sin `payments.read`.',
  })
  netUsdCents!: number | null;
}

export class AdminDashboardTrendsDto {
  @ApiProperty({ type: [TrendMonthDto], description: 'Del mes más antiguo al actual.' })
  months!: TrendMonthDto[];
}
