import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination.dto';
import {
  ApplicationKind,
  ApplicationStatus,
  FollowUpNoteKind,
  FollowUpOutcome,
  NotificationEmailStatus,
  OfferType,
} from '../../../../generated/prisma/client';
import { ScholarshipTypeSummaryDto } from '../../../scholarship-types/dto/scholarship-types.dto';
import { FUNNEL_STAGE_LABELS, type FunnelStageKey } from '../policies/admin-applications.policy';
import { AdminPersonRefDto, MoneyAmountDto } from './admin-applications.dto';

const FUNNEL_KEYS = Object.keys(FUNNEL_STAGE_LABELS) as FunnelStageKey[];

// -------------------------------------------------------------------------------------------------
// Embudo
// -------------------------------------------------------------------------------------------------

export class ListFunnelOffersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'Diplomado', description: 'Busca por nombre.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class FunnelOfferDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Diplomado en Ecotecnologías del Agua' })
  name!: string;

  @ApiProperty({ enum: OfferType })
  type!: OfferType;

  @ApiProperty({ type: String, nullable: true, example: '2026-11-07T16:00:00.000Z' })
  startsAt!: string | null;

  @ApiProperty({ example: 40, description: 'Postulaciones enviadas.' })
  applications!: number;

  @ApiProperty({ example: 22, description: 'Inscripciones que ocupan cupo (todas las vías).' })
  enrollments!: number;
}

export class FunnelStageDto {
  @ApiProperty({ enum: FUNNEL_KEYS, example: 'APPROVED' })
  key!: FunnelStageKey;

  @ApiProperty({ example: 'Aprobados' })
  label!: string;

  @ApiProperty({ example: 30 })
  count!: number;

  @ApiProperty({ example: 75, description: '% sobre postulados (entero).' })
  percentOfApplied!: number;

  @ApiProperty({ example: 75, description: '% sobre la etapa anterior (entero).' })
  percentOfPrevious!: number;
}

export class OfferFunnelDto {
  @ApiProperty({ type: FunnelOfferDto })
  offer!: FunnelOfferDto;

  @ApiProperty({
    type: [FunnelStageDto],
    description: 'Postulados → Aprobados → Con pago iniciado → Inscritos.',
  })
  stages!: FunnelStageDto[];

  @ApiProperty({ example: 50, description: 'Inscritos ÷ postulados.' })
  conversionPercent!: number;

  @ApiProperty({ example: 4 })
  inReview!: number;

  @ApiProperty({ example: 7, description: '"Aprobada – pendiente de pago".' })
  pendingPayment!: number;

  @ApiProperty({ example: 0, description: '"Aprobada – confirma tu participación".' })
  pendingConfirmation!: number;

  @ApiProperty({ example: 3, description: 'Vencidas (pérdidas).' })
  expired!: number;

  @ApiProperty({ example: 6 })
  notSelected!: number;

  @ApiProperty({ example: 2, description: 'Plazo ≤ 2 días (alerta).' })
  dueSoon!: number;

  @ApiProperty({
    example: 2,
    description: 'Inscripciones sin postulación (pago directo, Moodle, gratuitas).',
  })
  directEnrollments!: number;
}

export const FOLLOW_UP_TABS = ['PENDING', 'EXPIRED'] as const;
export type FollowUpTab = (typeof FOLLOW_UP_TABS)[number];

export class ListFollowUpsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: FOLLOW_UP_TABS,
    default: 'PENDING',
    description: '`PENDING` = "Aprobados sin pagar" (y sin confirmar); `EXPIRED` = "Vencidas".',
  })
  @IsOptional()
  @IsIn(FOLLOW_UP_TABS)
  tab?: FollowUpTab;

  @ApiPropertyOptional({
    example: true,
    description: 'Filtro de la etapa "Con pago iniciado" (true) o sin iniciar (false).',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  paymentStarted?: boolean;
}

export class FollowUpPhoneDto {
  @ApiProperty({ example: '+52' })
  countryCode!: string;

  @ApiProperty({ example: '5512345678' })
  number!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'https://wa.me/525512345678',
    description: 'null = sin teléfono válido con indicativo (botón WhatsApp deshabilitado).',
  })
  whatsappUrl!: string | null;
}

export class FollowUpItemDto {
  @ApiProperty({ format: 'uuid' })
  applicationId!: string;

  @ApiProperty({ example: 'BEC-000123' })
  folio!: string;

  @ApiProperty({ enum: ApplicationKind })
  kind!: ApplicationKind;

  @ApiProperty({ enum: ApplicationStatus })
  status!: ApplicationStatus;

  @ApiProperty({ example: 'María José Núñez' })
  name!: string;

  @ApiProperty({ example: 'maria@example.com' })
  email!: string;

  @ApiProperty({ type: FollowUpPhoneDto })
  phone!: FollowUpPhoneDto;

  @ApiProperty({ example: 'MX' })
  countryCode!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Tipo de beca asignado (antes `assignedLevel`).',
  })
  assignedScholarshipTypeId!: string | null;

  @ApiProperty({ type: ScholarshipTypeSummaryDto, nullable: true })
  assignedScholarshipType!: ScholarshipTypeSummaryDto | null;

  @ApiProperty({ type: Number, nullable: true, example: 50 })
  assignedPercent!: number | null;

  @ApiProperty({ type: MoneyAmountDto, nullable: true })
  balance!: MoneyAmountDto | null;

  @ApiProperty({ type: String, nullable: true })
  responseDueAt!: string | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 2,
    description: 'Días restantes (negativo = vencida).',
  })
  remainingDays!: number | null;

  @ApiProperty({ example: true, description: 'Vence en 2 días o menos (destacar arriba).' })
  dueSoon!: boolean;

  @ApiProperty({
    example: false,
    description: 'Comprobante de transferencia "Pendiente de validación".',
  })
  pendingTransfer!: boolean;

  @ApiProperty({ example: true, description: '"Con pago iniciado".' })
  paymentStarted!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Último contacto (recordatorio, WhatsApp o nota).',
  })
  lastContactAt!: string | null;

  @ApiProperty({ enum: FollowUpOutcome, nullable: true })
  lastOutcome!: FollowUpOutcome | null;

  @ApiProperty({ example: true, description: 'Se puede enviar recordatorio (máx. 1 cada 24 h).' })
  canRemind!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Cuándo vuelve a habilitarse el recordatorio.',
  })
  remindAvailableAt!: string | null;
}

// -------------------------------------------------------------------------------------------------
// Línea de tiempo y notas
// -------------------------------------------------------------------------------------------------

export const TIMELINE_KINDS = [
  'STATUS_CHANGE',
  'NOTE',
  'REMINDER_SENT',
  'WHATSAPP_CONTACT',
  'PAYMENT',
] as const;
export type FollowUpTimelineKind = (typeof TIMELINE_KINDS)[number];

export class FollowUpTimelineItemDto {
  @ApiProperty({ enum: TIMELINE_KINDS })
  kind!: FollowUpTimelineKind;

  @ApiProperty({ example: '2026-11-08T16:00:00.000Z' })
  at!: string;

  @ApiProperty({ example: 'Aprobada – pendiente de pago' })
  title!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Pagará el viernes.' })
  detail!: string | null;

  @ApiProperty({ enum: FollowUpOutcome, nullable: true })
  outcome!: FollowUpOutcome | null;

  @ApiProperty({ type: AdminPersonRefDto, nullable: true, description: 'Autor (equipo).' })
  author!: AdminPersonRefDto | null;
}

export class FollowUpDetailDto extends FollowUpItemDto {
  @ApiProperty({ type: [FollowUpTimelineItemDto], description: 'Más reciente primero.' })
  timeline!: FollowUpTimelineItemDto[];
}

export class FollowUpNoteDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: FollowUpNoteKind })
  kind!: FollowUpNoteKind;

  @ApiProperty({ enum: FollowUpOutcome, nullable: true })
  outcome!: FollowUpOutcome | null;

  @ApiProperty({ example: 'Pagará el viernes.' })
  body!: string;

  @ApiProperty({ type: AdminPersonRefDto, nullable: true })
  author!: AdminPersonRefDto | null;

  @ApiProperty({ example: '2026-11-08T16:00:00.000Z' })
  createdAt!: string;
}

export class FollowUpNotesDto {
  @ApiProperty({ type: [FollowUpNoteDto], description: 'Más reciente primero.' })
  data!: FollowUpNoteDto[];
}

export class CreateFollowUpNoteRequestDto {
  @ApiProperty({ example: 'Pagará el viernes.', maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  body!: string;

  @ApiPropertyOptional({
    enum: FollowUpOutcome,
    description: 'Sin respuesta / Pagará pronto / Solicita cuotas / Desiste.',
  })
  @IsOptional()
  @IsIn(Object.values(FollowUpOutcome))
  outcome?: FollowUpOutcome;
}

export class ReminderResultDto {
  @ApiProperty({ example: '2026-11-08T16:00:00.000Z' })
  sentAt!: string;

  @ApiProperty({
    example: '2026-11-09T16:00:00.000Z',
    description: 'Próximo recordatorio posible.',
  })
  nextAvailableAt!: string;

  @ApiProperty({ enum: NotificationEmailStatus, nullable: true, example: 'SENT' })
  emailStatus!: NotificationEmailStatus | null;

  @ApiProperty({ type: FollowUpNoteDto, description: 'Nota automática registrada.' })
  note!: FollowUpNoteDto;
}

export class WhatsappRequestDto {
  @ApiPropertyOptional({
    maxLength: 1000,
    example: 'Hola {nombre}, tu saldo es {saldo}. Paga aquí: {link_pago}',
    description:
      'Plantilla editable con {nombre}, {saldo}, {link_pago}. Omitir = plantilla por defecto.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  template?: string;
}

export class WhatsappResultDto {
  @ApiProperty({
    example: 'https://wa.me/525512345678?text=Hola%20Mar%C3%ADa…',
    description: 'Abrir en otra pestaña.',
  })
  url!: string;

  @ApiProperty({ example: 'Hola María, tu saldo pendiente es de $5,100.00 MXN…' })
  text!: string;

  @ApiProperty({ type: FollowUpNoteDto, description: 'Nota automática registrada.' })
  note!: FollowUpNoteDto;
}

export class ExtendDeadlineRequestDto {
  @ApiProperty({
    example: '2026-11-20T23:59:00.000Z',
    description: 'Nueva fecha límite (futura, ≤ inicio de clases).',
  })
  @IsDateString()
  responseDueAt!: string;

  @ApiProperty({ example: 'Solicitó una semana más para reunir el pago.', maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}

export class CloseEnrollmentRequestDto {
  @ApiPropertyOptional({ example: 'Cupo completo con las personas aprobadas.', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CloseEnrollmentResultDto {
  @ApiProperty({ format: 'uuid' })
  offerId!: string;

  @ApiProperty({ example: '2026-11-08T16:00:00.000Z' })
  enrollmentClosesAt!: string;
}
