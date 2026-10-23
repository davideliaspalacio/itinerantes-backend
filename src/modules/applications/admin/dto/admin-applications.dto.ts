import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination.dto';
import {
  ApplicationKind,
  ApplicationStatus,
  EvaluationRecommendation,
  InterviewStatus,
  NotificationEmailStatus,
  NotificationType,
} from '../../../../generated/prisma/client';
import {
  OfferScholarshipQuotaDto,
  ScholarshipTypeSummaryDto,
} from '../../../scholarship-types/dto/scholarship-types.dto';

const toBool = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1'
    ? true
    : value === false || value === 'false' || value === '0'
      ? false
      : value;
const toArray = ({ value }: { value: unknown }) =>
  typeof value === 'string'
    ? value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    : value;

export const ADMIN_APPLICATION_SORTS = ['SUBMITTED_ASC', 'SUBMITTED_DESC', 'DUE_ASC'] as const;
export type AdminApplicationSort = (typeof ADMIN_APPLICATION_SORTS)[number];

/** Estados visibles en el panel (nunca borradores). */
export const SENT_STATUSES = Object.values(ApplicationStatus).filter((s) => s !== 'DRAFT');

// -------------------------------------------------------------------------------------------------
// Filtros
// -------------------------------------------------------------------------------------------------

export class ListAdminApplicationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ApplicationKind })
  @IsOptional()
  @IsIn(Object.values(ApplicationKind))
  kind?: ApplicationKind;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all')
  offerId?: string;

  @ApiPropertyOptional({
    enum: SENT_STATUSES,
    isArray: true,
    example: ['SUBMITTED', 'IN_REVIEW'],
    description: 'Estados separados por coma. Por defecto todos menos `DRAFT`.',
  })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsIn(SENT_STATUSES, { each: true })
  status?: ApplicationStatus[];

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Tipo de beca solicitado (antes `level`). Ids de `GET /admin/scholarship-types`.',
  })
  @IsOptional()
  @IsUUID()
  scholarshipTypeId?: string;

  @ApiPropertyOptional({ example: 'MX' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @ApiPropertyOptional({ example: true, description: '"Requiere entrevista".' })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  requiresInterview?: boolean;

  @ApiPropertyOptional({ example: true, description: '"Sin mi evaluación".' })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  withoutMyEvaluation?: boolean;

  @ApiPropertyOptional({ example: 'María', description: 'Nombre, correo o folio.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: ADMIN_APPLICATION_SORTS, default: 'SUBMITTED_ASC' })
  @IsOptional()
  @IsIn(ADMIN_APPLICATION_SORTS)
  sort?: AdminApplicationSort;
}

// -------------------------------------------------------------------------------------------------
// Bandeja
// -------------------------------------------------------------------------------------------------

export class AdminApplicantDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ example: 'María José Núñez' })
  name!: string;

  @ApiProperty({ example: 'maria@example.com' })
  email!: string;

  @ApiProperty({ example: 'MX' })
  countryCode!: string;
}

export class AdminOfferRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Diplomado en Ecotecnologías del Agua' })
  name!: string;

  @ApiProperty({ example: 'diplomado-ecotecnologias-del-agua' })
  slug!: string;
}

export class AdminInterviewRefDto {
  @ApiProperty({ enum: InterviewStatus, example: 'SCHEDULED' })
  status!: InterviewStatus;

  @ApiProperty({ example: '2026-11-12T17:00:00.000Z' })
  startsAt!: string;
}

export class AdminApplicationListItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'BEC-000123' })
  folio!: string;

  @ApiProperty({ enum: ApplicationKind })
  kind!: ApplicationKind;

  @ApiProperty({ enum: ApplicationStatus, example: 'IN_REVIEW' })
  status!: ApplicationStatus;

  @ApiProperty({ type: AdminApplicantDto })
  applicant!: AdminApplicantDto;

  @ApiProperty({ type: AdminOfferRefDto })
  offer!: AdminOfferRefDto;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Tipo de beca solicitado (antes `requestedLevel`).',
  })
  requestedScholarshipTypeId!: string | null;

  @ApiProperty({ type: ScholarshipTypeSummaryDto, nullable: true })
  requestedScholarshipType!: ScholarshipTypeSummaryDto | null;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Tipo de beca asignado (antes `assignedLevel`).',
  })
  assignedScholarshipTypeId!: string | null;

  @ApiProperty({
    type: ScholarshipTypeSummaryDto,
    nullable: true,
    description: '`name` = nombre que tenía el tipo al aprobar.',
  })
  assignedScholarshipType!: ScholarshipTypeSummaryDto | null;

  @ApiProperty({ type: Number, nullable: true, example: null })
  assignedPercent!: number | null;

  @ApiProperty({ type: String, nullable: true, example: '2026-11-03T15:20:00.000Z' })
  submittedAt!: string | null;

  @ApiProperty({ example: false, description: 'Insignia "Requiere entrevista".' })
  requiresInterview!: boolean;

  @ApiProperty({ type: AdminInterviewRefDto, nullable: true, description: 'Entrevista vigente.' })
  interview!: AdminInterviewRefDto | null;

  @ApiProperty({ example: 2, description: 'Número de evaluaciones del comité.' })
  evaluationCount!: number;

  @ApiProperty({
    enum: EvaluationRecommendation,
    nullable: true,
    description: 'Mi evaluación (null = insignia "Sin mi evaluación").',
  })
  myEvaluation!: EvaluationRecommendation | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'Plazo de pago/confirmación.',
  })
  responseDueAt!: string | null;
}

// -------------------------------------------------------------------------------------------------
// Detalle
// -------------------------------------------------------------------------------------------------

export class MoneyAmountDto {
  @ApiProperty({ example: 510000 })
  amountCents!: number;

  @ApiProperty({ enum: ['MXN', 'USD'], example: 'MXN' })
  currency!: 'MXN' | 'USD';
}

export class AdminApplicationContactDto {
  @ApiProperty({ example: 'María José Núñez' })
  name!: string;

  @ApiProperty({ example: 'maria@example.com' })
  email!: string;

  @ApiProperty({ example: '+52' })
  phoneCountryCode!: string;

  @ApiProperty({ example: '5512345678' })
  phoneNumber!: string;

  @ApiProperty({ example: 'MX' })
  countryCode!: string;

  @ApiProperty({ example: 'Ciudad de México' })
  divisionName!: string;

  @ApiProperty({ example: 'Coyoacán' })
  municipalityName!: string;

  @ApiProperty({ type: Number, nullable: true, example: 29 })
  age!: number | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  organization!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  organizationRole!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'ALIADA-01' })
  partnerCode!: string | null;
}

export class AdminApplicationAnswersDto {
  @ApiProperty({ type: String, nullable: true, description: 'Beca: carta de intención.' })
  intentLetter!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Convocatoria: experiencia.' })
  experience!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Convocatoria: motivación.' })
  motivation!: string | null;

  @ApiProperty({ type: Boolean, nullable: true, description: 'Convocatoria: puede viajar.' })
  canTravel!: boolean | null;

  @ApiProperty({ example: true })
  eligibilityConfirmed!: boolean;

  @ApiProperty({ type: [String], example: ['https://youtu.be/abc'] })
  evidenceLinks!: string[];
}

export class AdminApplicationDocumentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'humedal.jpg' })
  fileName!: string;

  @ApiProperty({ example: 'image/jpeg' })
  mimeType!: string;

  @ApiProperty({ example: 2400000 })
  sizeBytes!: number;

  @ApiProperty({ description: 'URL firmada de descarga (~10 min).' })
  url!: string;

  @ApiProperty({ example: '2026-11-07T16:10:00.000Z' })
  expiresAt!: string;
}

export class AdminPersonRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Laura Coordinación' })
  fullName!: string;
}

export class AdminStatusEventDto {
  @ApiProperty({ enum: ApplicationStatus, nullable: true })
  fromStatus!: ApplicationStatus | null;

  @ApiProperty({ enum: ApplicationStatus })
  toStatus!: ApplicationStatus;

  @ApiProperty({ enum: ['PARTICIPANT', 'STAFF', 'SYSTEM'] })
  actorType!: 'PARTICIPANT' | 'STAFF' | 'SYSTEM';

  @ApiProperty({ type: AdminPersonRefDto, nullable: true })
  actor!: AdminPersonRefDto | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Nota interna (nunca visible al postulante).',
  })
  note!: string | null;

  @ApiProperty({ example: '2026-11-07T16:00:00.000Z' })
  at!: string;
}

export class AdminInterviewDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: InterviewStatus })
  status!: InterviewStatus;

  @ApiProperty({ example: '2026-11-12T17:00:00.000Z' })
  startsAt!: string;

  @ApiProperty({ example: '2026-11-12T17:30:00.000Z' })
  endsAt!: string;

  @ApiProperty({ example: 'https://us02web.zoom.us/j/123456789' })
  joinUrl!: string;

  @ApiProperty({ type: String, nullable: true })
  completedAt!: string | null;

  @ApiProperty({ type: AdminPersonRefDto, nullable: true })
  scheduledBy!: AdminPersonRefDto | null;
}

export class AdminEvaluationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: AdminPersonRefDto })
  evaluator!: AdminPersonRefDto;

  @ApiProperty({ enum: EvaluationRecommendation })
  recommendation!: EvaluationRecommendation;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Tipo de beca sugerido (antes `suggestedLevel`).',
  })
  suggestedScholarshipTypeId!: string | null;

  @ApiProperty({ type: ScholarshipTypeSummaryDto, nullable: true })
  suggestedScholarshipType!: ScholarshipTypeSummaryDto | null;

  @ApiProperty({ type: String, nullable: true, example: 'Experiencia territorial sólida.' })
  comment!: string | null;

  @ApiProperty({ example: '2026-11-08T16:00:00.000Z' })
  updatedAt!: string;
}

export class EvaluationSummaryDto {
  @ApiProperty({ example: 2 })
  approve!: number;

  @ApiProperty({ example: 0 })
  notSelect!: number;

  @ApiProperty({ example: 1 })
  unsure!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Tipo más sugerido (empate → el de menor %).',
  })
  mostSuggestedScholarshipTypeId!: string | null;

  @ApiProperty({
    type: ScholarshipTypeSummaryDto,
    nullable: true,
    description: 'Antes `mostSuggestedLevel`.',
  })
  mostSuggestedScholarshipType!: ScholarshipTypeSummaryDto | null;

  @ApiProperty({ example: '2 aprobar · 1 con dudas · tipo más sugerido: Aguas Libres 50%' })
  label!: string;
}

export class AdminScholarshipTypeOptionDto {
  @ApiProperty({ format: 'uuid' })
  scholarshipTypeId!: string;

  @ApiProperty({
    type: ScholarshipTypeSummaryDto,
    description:
      'Con el rango EFECTIVO en la oferta. `requiresInterview` exige entrevista "Realizada".',
  })
  scholarshipType!: ScholarshipTypeSummaryDto;

  @ApiProperty({
    example: true,
    description: 'false = tipo desactivado (se puede asignar si la oferta ya lo tenía).',
  })
  active!: boolean;

  @ApiProperty({
    type: OfferScholarshipQuotaDto,
    description:
      'Cupo global del tipo y propio de la oferta; `isFull` → no se puede asignar (409).',
  })
  quota!: OfferScholarshipQuotaDto;

  @ApiProperty({
    type: MoneyAmountDto,
    nullable: true,
    description: 'Saldo con el % máximo del tipo en la moneda del postulante.',
  })
  balanceAtMaxPercent!: MoneyAmountDto | null;
}

export class AdminDecisionDto {
  @ApiProperty({ example: true, description: 'Puedo registrar la decisión (permiso + estado).' })
  canDecide!: boolean;

  @ApiProperty({ example: false })
  interviewRequired!: boolean;

  @ApiProperty({ example: false, description: 'Hay una entrevista "Realizada".' })
  hasCompletedInterview!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description:
      '`APPLICATION_INTERVIEW_REQUIRED` = "Esta postulación requiere entrevista por Zoom" (aplica a ' +
      'convocatorias siempre y a becas cuyo tipo asignado/solicitado tiene `requiresInterview`).',
  })
  blockedReason!: string | null;

  @ApiProperty({
    type: MoneyAmountDto,
    nullable: true,
    description: 'Precio en la moneda del postulante.',
  })
  price!: MoneyAmountDto | null;

  @ApiProperty({
    type: [AdminScholarshipTypeOptionDto],
    description: 'Tipos de beca habilitados en la oferta (antes `levels`).',
  })
  scholarshipTypes!: AdminScholarshipTypeOptionDto[];

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  assignedScholarshipTypeId!: string | null;

  @ApiProperty({ type: ScholarshipTypeSummaryDto, nullable: true })
  assignedScholarshipType!: ScholarshipTypeSummaryDto | null;

  @ApiProperty({ type: Number, nullable: true })
  assignedPercent!: number | null;

  @ApiProperty({ type: MoneyAmountDto, nullable: true })
  balance!: MoneyAmountDto | null;

  @ApiProperty({ type: String, nullable: true })
  responseDueAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  decidedAt!: string | null;

  @ApiProperty({ type: AdminPersonRefDto, nullable: true })
  decidedBy!: AdminPersonRefDto | null;

  @ApiProperty({ type: String, nullable: true, description: 'Nota interna de la decisión.' })
  decisionNote!: string | null;

  @ApiProperty({
    enum: NotificationEmailStatus,
    nullable: true,
    description:
      'Estado del correo de la decisión: `FAILED` → "Correo no enviado" + [Reintentar envío].',
  })
  emailStatus!: NotificationEmailStatus | null;
}

export class AdminApplicationEmailDto {
  @ApiProperty({ format: 'uuid', description: 'Id de la notificación (para reintentar).' })
  notificationId!: string;

  @ApiProperty({ enum: NotificationType })
  type!: NotificationType;

  @ApiProperty({ example: 'Tu beca fue aprobada: Diplomado en Ecotecnologías del Agua' })
  title!: string;

  @ApiProperty({ enum: NotificationEmailStatus })
  emailStatus!: NotificationEmailStatus;

  @ApiProperty({ type: String, nullable: true })
  emailSentAt!: string | null;

  @ApiProperty({ example: '2026-11-08T16:00:00.000Z' })
  createdAt!: string;
}

export class AdminApplicationDetailDto extends AdminApplicationListItemDto {
  @ApiProperty({ type: AdminApplicationContactDto })
  contact!: AdminApplicationContactDto;

  @ApiProperty({ type: AdminApplicationAnswersDto })
  answers!: AdminApplicationAnswersDto;

  @ApiProperty({ type: [AdminApplicationDocumentDto], description: 'Fotos/videos de evidencia.' })
  documents!: AdminApplicationDocumentDto[];

  @ApiProperty({ type: [AdminStatusEventDto], description: 'Historial (más antiguo primero).' })
  history!: AdminStatusEventDto[];

  @ApiProperty({ type: [AdminInterviewDto], description: 'Entrevistas (más reciente primero).' })
  interviews!: AdminInterviewDto[];

  @ApiProperty({ type: [AdminEvaluationDto] })
  evaluations!: AdminEvaluationDto[];

  @ApiProperty({ type: EvaluationSummaryDto })
  evaluationSummary!: EvaluationSummaryDto;

  @ApiProperty({ type: AdminEvaluationDto, nullable: true })
  myEvaluationDetail!: AdminEvaluationDto | null;

  @ApiProperty({ type: AdminDecisionDto })
  decision!: AdminDecisionDto;

  @ApiProperty({ type: [AdminApplicationEmailDto], description: 'Avisos enviados al postulante.' })
  emails!: AdminApplicationEmailDto[];

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'uuid',
    description: '[Anterior] en la bandeja.',
  })
  prevId!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'uuid',
    description: '[Siguiente] en la bandeja.',
  })
  nextId!: string | null;

  @ApiProperty({
    example: true,
    description: 'Se pasó a "En revisión" al abrir el detalle en esta petición.',
  })
  reviewStarted!: boolean;
}

// -------------------------------------------------------------------------------------------------
// Acciones
// -------------------------------------------------------------------------------------------------

export class UpsertEvaluationRequestDto {
  @ApiProperty({
    enum: EvaluationRecommendation,
    example: 'APPROVE',
    description: 'Aprobar / No seleccionar / Tengo dudas.',
  })
  @IsIn(Object.values(EvaluationRecommendation))
  recommendation!: EvaluationRecommendation;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'Solo becas: tipo de beca sugerido, habilitado en la oferta (antes `suggestedLevel`). Otro → ' +
      '400 `SCHOLARSHIP_TYPE_NOT_ENABLED`.',
  })
  @IsOptional()
  @IsUUID()
  suggestedScholarshipTypeId?: string | null;

  @ApiPropertyOptional({ example: 'Experiencia territorial sólida.', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string | null;
}

export class ScheduleInterviewRequestDto {
  @ApiProperty({ example: '2026-11-12T17:00:00.000Z' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ example: '2026-11-12T17:30:00.000Z' })
  @IsDateString()
  endsAt!: string;

  @ApiProperty({
    example: 'https://us02web.zoom.us/j/123456789',
    description: 'URL https de zoom.us.',
  })
  @IsString()
  @MaxLength(1000)
  joinUrl!: string;
}

export class CompleteInterviewRequestDto {
  @ApiPropertyOptional({
    enum: ['COMPLETED', 'NO_SHOW'],
    default: 'COMPLETED',
    description: '"Realizada" o "No asistió".',
  })
  @IsOptional()
  @IsIn(['COMPLETED', 'NO_SHOW'])
  outcome?: 'COMPLETED' | 'NO_SHOW';
}

export class CancelInterviewRequestDto {
  @ApiPropertyOptional({ example: 'La postulante pidió cambiar de fecha.', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class DecisionPreviewQueryDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'], example: 'APPROVE' })
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';

  @ApiPropertyOptional({ format: 'uuid', description: 'Beca: tipo a asignar.' })
  @IsOptional()
  @IsUUID()
  assignedScholarshipTypeId?: string;

  @ApiPropertyOptional({
    example: 75,
    description: 'Beca: % dentro del rango del tipo en la oferta (opcional si es fijo).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  assignedPercent?: number;

  @ApiPropertyOptional({
    maxLength: 1000,
    description: 'Párrafo editable que se agregaría al correo.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}

export class DecisionPreviewDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  decision!: 'APPROVE' | 'REJECT';

  @ApiProperty({
    enum: ApplicationStatus,
    example: 'APPROVED_PENDING_PAYMENT',
    description: 'Estado resultante.',
  })
  status!: ApplicationStatus;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  assignedScholarshipTypeId!: string | null;

  @ApiProperty({ type: ScholarshipTypeSummaryDto, nullable: true })
  assignedScholarshipType!: ScholarshipTypeSummaryDto | null;

  @ApiProperty({ type: Number, nullable: true, example: 50 })
  assignedPercent!: number | null;

  @ApiProperty({
    type: MoneyAmountDto,
    nullable: true,
    description: 'Saldo a pagar (5,100 MXN con 50% sobre 10,200).',
  })
  balance!: MoneyAmountDto | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Plazo (7 días, sin superar el inicio).',
  })
  responseDueAt!: string | null;

  @ApiProperty({ example: false })
  interviewRequired!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description:
      '`SCHOLARSHIP_TYPE_FULL` si el tipo ya no tiene cupo (global o de la oferta); ' +
      '`APPLICATION_INTERVIEW_REQUIRED` si falta la entrevista.',
  })
  blockedReason!: string | null;

  @ApiProperty({
    example: {
      subject: 'Tu beca fue aprobada: Diplomado en Ecotecnologías del Agua',
      body: 'Estado: Aprobada – pendiente de pago. Beca asignada: Aguas Libres (50%). Saldo a pagar: $5,100.00 MXN…',
    },
    description: 'Vista previa del correo/notificación (asunto y cuerpo).',
  })
  email!: { subject: string; body: string };
}

export class ApproveApplicationRequestDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Obligatorio en becas (antes `assignedLevel`): tipo habilitado en la oferta (otro → 400 ' +
      '`SCHOLARSHIP_TYPE_NOT_ENABLED`).',
  })
  @IsOptional()
  @IsUUID()
  assignedScholarshipTypeId?: string;

  @ApiPropertyOptional({
    example: 75,
    description:
      'Beca: % final, entero dentro del rango EFECTIVO del tipo en la oferta (fuera → 400 ' +
      '`INVALID`). Si el rango es fijo se toma solo.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  assignedPercent?: number;

  @ApiPropertyOptional({ maxLength: 1000, description: 'Nota interna (historial; nunca visible).' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({
    maxLength: 1000,
    example: '¡Felicidades! Te esperamos el 7 de noviembre.',
    description: 'Párrafo editable que se agrega al correo y a la notificación del postulante.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiProperty({
    example: true,
    description: 'Confirmación de la vista previa del correo (debe ser true).',
  })
  @Equals(true, { message: 'Confirma la vista previa del correo.' })
  emailPreviewConfirmed!: boolean;
}

export class RejectApplicationRequestDto {
  @ApiPropertyOptional({ maxLength: 1000, description: 'Nota interna.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({ maxLength: 1000, description: 'Párrafo editable del correo.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiProperty({ example: true })
  @Equals(true, { message: 'Confirma la vista previa del correo.' })
  emailPreviewConfirmed!: boolean;
}

export class RetryEmailRequestDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Notificación a reenviar (por defecto, el último correo fallido de la postulación).',
  })
  @IsOptional()
  @IsUUID('all')
  notificationId?: string;
}

export class RetryEmailResultDto {
  @ApiProperty({ format: 'uuid' })
  notificationId!: string;

  @ApiProperty({ enum: NotificationEmailStatus, example: 'SENT' })
  emailStatus!: NotificationEmailStatus;

  @ApiProperty({ type: String, nullable: true })
  emailSentAt!: string | null;
}
