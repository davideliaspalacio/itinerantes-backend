import { ApiProperty } from '@nestjs/swagger';
import { BUSINESS_RULES } from '../../../config/business-rules';
import {
  ApplicationKind,
  ApplicationStatus,
  InterviewStatus,
} from '../../../generated/prisma/client';
import { PortalOfferRefDto } from '../../enrollments/dto/portal-shared.dto';
import { SessionJoinDto } from '../../live-sessions/dto/sessions.dto';
import { OfferActionReason } from '../../offers/policies/offer-actions.policy';
import {
  EligibleCountryDto,
  MoneyDto,
  OfferScholarshipTypeDto,
} from '../../offers/dto/offers.response.dto';
import { ScholarshipTypeSummaryDto } from '../../scholarship-types/dto/scholarship-types.dto';
import { PhoneDto } from '../../users/dto/user-fields';
import {
  ApplicationActionReason,
  ApplicationActionType,
  TimelineStepKey,
  TimelineStepState,
} from '../policies/application-status.policy';
import { ApplicationFieldCode, IneligibilityReason } from '../policies/application-rules.policy';

const DATE = { type: String, format: 'date-time' } as const;
const OPTIONAL_DATE = { ...DATE, nullable: true } as const;
const R = BUSINESS_RULES;

export class ApplicationOfferVenueDto {
  @ApiProperty({ example: 'Ecoaldea Río Vivo' })
  name!: string;

  @ApiProperty({ type: String, nullable: true, example: 'San José del Pacífico, Oaxaca' })
  city!: string | null;
}

/** Oferta de la postulación (tarjeta y resumen lateral). */
export class ApplicationOfferDto extends PortalOfferRefDto {
  @ApiProperty({ type: String, nullable: true, example: 'Convocatoria 2027' })
  cohortLabel!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'https://placehold.co/1200x630.png' })
  coverImageUrl!: string | null;

  @ApiProperty({ ...OPTIONAL_DATE, example: '2027-02-15T15:00:00.000Z' })
  startsAt!: string | null;

  @ApiProperty({ ...OPTIONAL_DATE, example: '2027-02-20T00:00:00.000Z' })
  endsAt!: string | null;

  @ApiProperty({
    type: ApplicationOfferVenueDto,
    nullable: true,
    description: 'Presencial ("Presencial" en la tarjeta).',
  })
  venue!: ApplicationOfferVenueDto | null;
}

export class ApplicationWindowDto {
  @ApiProperty({
    enum: ['OPEN', 'UPCOMING', 'CLOSED'],
    example: 'OPEN',
    description:
      'Ventana de postulación: OPEN "Abierta", UPCOMING "Próximamente", CLOSED "Cerrada".',
  })
  state!: 'OPEN' | 'UPCOMING' | 'CLOSED';

  @ApiProperty({ ...OPTIONAL_DATE, example: '2026-10-01T06:00:00.000Z' })
  opensAt!: string | null;

  @ApiProperty({
    ...OPTIONAL_DATE,
    example: '2026-12-01T05:59:00.000Z',
    description: 'Cierre (cuenta regresiva "Cierra en 5 días", en la zona del usuario).',
  })
  closesAt!: string | null;

  @ApiProperty({
    enum: Object.values(OfferActionReason),
    nullable: true,
    example: null,
    description:
      'Motivo si no está abierta (mismos textos que la ficha): SCHOLARSHIP_NOT_OPEN_YET, ' +
      'SCHOLARSHIP_CLOSED, ENROLLMENT_NOT_OPEN_YET, ENROLLMENT_CLOSED ("Convocatoria cerrada"), OFFER_FINISHED.',
  })
  reason!: OfferActionReason | null;
}

export class ApplicationEligibilityDto {
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Dirigida a mujeres lideresas de Centroamérica y México.',
    description: 'Texto destacado al inicio del formulario.',
  })
  text!: string | null;

  @ApiProperty({ type: [EligibleCountryDto], description: 'Vacío = cualquier país.' })
  countries!: EligibleCountryDto[];

  @ApiProperty({ example: true, description: 'Exige disponibilidad para viajar.' })
  requiresTravel!: boolean;

  @ApiProperty({
    example: true,
    description: '¿Cumple hoy? (país del perfil y respuesta de viaje). false → envío bloqueado.',
  })
  eligible!: boolean;

  @ApiProperty({
    enum: Object.values(IneligibilityReason),
    isArray: true,
    example: [],
    description:
      '`COUNTRY_NOT_ELIGIBLE` → muestra `text` ("dirigida a …"); `TRAVEL_REQUIRED` → "Debes poder ' +
      'asistir de forma presencial".',
  })
  reasons!: IneligibilityReason[];
}

export class TimelineStepDto {
  @ApiProperty({
    enum: Object.values(TimelineStepKey),
    example: 'SUBMITTED',
    description:
      'SUBMITTED Enviada · IN_REVIEW En revisión · INTERVIEW Entrevista · RESULT Resultado · ' +
      'PAYMENT Pago del saldo · CONFIRMATION Confirmación · ENROLLED Inscrita.',
  })
  key!: TimelineStepKey;

  @ApiProperty({
    enum: Object.values(TimelineStepState),
    example: 'DONE',
    description:
      'DONE (con fecha), CURRENT (etapa actual), UPCOMING, SKIPPED (no aplicó) o FAILED (No ' +
      'seleccionada / Vencida).',
  })
  state!: TimelineStepState;

  @ApiProperty({ ...OPTIONAL_DATE, example: '2026-10-21T17:30:00.000Z' })
  at!: string | null;
}

export class ApplicationActionDto {
  @ApiProperty({
    enum: Object.values(ApplicationActionType),
    example: 'PAY_BALANCE',
    description:
      'CONTINUE_DRAFT [Continuar] · JOIN_INTERVIEW [Entrar a la entrevista] (abre `interview.join.url`) ' +
      '· PAY_BALANCE [Pagar saldo] (Fase 05: `/postulaciones/{id}/pago`) · CONTINUE_PAYMENT ' +
      '[Continuar pago] (ya inició un pago: misma pantalla) · UPLOAD_TRANSFER_PROOF [Subir ' +
      'comprobante] (transferencia rechazada) · PAYMENT_IN_VALIDATION "Pago en validación" ' +
      '(deshabilitado, comprobante en revisión) · ' +
      'CONFIRM_PARTICIPATION [Confirmar mi participación] (`POST …/confirm`) · GO_TO_CLASSROOM [Ir a ' +
      'mi aula] · VIEW [Ver mi postulación].',
  })
  type!: ApplicationActionType;

  @ApiProperty({ example: true })
  enabled!: boolean;

  @ApiProperty({
    enum: Object.values(ApplicationActionReason),
    nullable: true,
    example: null,
    description:
      'Si `enabled = false`: WINDOW_CLOSED (borrador en solo lectura), INTERVIEW_NOT_OPEN_YET ' +
      '("Disponible 10 min antes"), INTERVIEW_LINK_PENDING, INTERVIEW_ENDED, ' +
      'TRANSFER_PENDING_VALIDATION ("El equipo valida tu comprobante en 1–2 días hábiles").',
  })
  reason!: ApplicationActionReason | null;

  @ApiProperty({
    ...OPTIONAL_DATE,
    example: '2026-11-14T05:59:00.000Z',
    description: 'Cuenta regresiva: inicio de la entrevista o fecha límite de pago/confirmación.',
  })
  dueAt!: string | null;
}

export class InterviewDto {
  @ApiProperty({ format: 'uuid', example: '7c1e2d3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f' })
  id!: string;

  @ApiProperty({ ...DATE, example: '2026-11-12T16:00:00.000Z' })
  startsAt!: string;

  @ApiProperty({ ...DATE, example: '2026-11-12T16:30:00.000Z' })
  endsAt!: string;

  @ApiProperty({
    example: 'America/Mexico_City',
    description: 'Referencia CDMX: muestra "11:00 tu hora · 10:00 hora CDMX" (HU-11).',
  })
  timezone!: string;

  @ApiProperty({
    enum: InterviewStatus,
    example: 'SCHEDULED',
    description: 'SCHEDULED Agendada · COMPLETED Realizada · CANCELLED · NO_SHOW No asistió.',
  })
  status!: InterviewStatus;

  @ApiProperty({
    type: SessionJoinDto,
    description:
      'Enlace de Zoom: `url` solo con `state = OPEN` (10 minutos antes y hasta el fin). Mismas reglas ' +
      'que las sesiones (HU-12).',
  })
  join!: SessionJoinDto;
}

export class ScholarshipResultDto {
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  requestedScholarshipTypeId!: string | null;

  @ApiProperty({ type: ScholarshipTypeSummaryDto, nullable: true })
  requestedScholarshipType!: ScholarshipTypeSummaryDto | null;

  @ApiProperty({ type: String, format: 'uuid' })
  assignedScholarshipTypeId!: string;

  @ApiProperty({
    type: ScholarshipTypeSummaryDto,
    description:
      'Tipo asignado. `name` es el nombre que tenía al aprobar (no cambia si luego se renombra).',
  })
  assignedScholarshipType!: ScholarshipTypeSummaryDto;

  @ApiProperty({ example: 50, description: '% asignado (dentro del rango del tipo en la oferta).' })
  assignedPercent!: number;

  @ApiProperty({ type: MoneyDto, nullable: true, description: 'Monto original de la oferta.' })
  originalAmount!: MoneyDto | null;

  @ApiProperty({ type: MoneyDto, description: 'Saldo a pagar en tu moneda (HU-23).' })
  balance!: MoneyDto;

  @ApiProperty({
    ...OPTIONAL_DATE,
    example: '2026-11-14T05:59:00.000Z',
    description: `Fecha límite de pago (${R.PAYMENT_DEADLINE_AFTER_APPROVAL_DAYS} días naturales).`,
  })
  dueAt!: string | null;
}

export class ApplicationResponseDeadlineDto {
  @ApiProperty({
    enum: ['PAYMENT', 'CONFIRMATION'],
    example: 'CONFIRMATION',
    description: 'Qué debe hacer la persona: pagar (saldo / costo) o confirmar su participación.',
  })
  kind!: 'PAYMENT' | 'CONFIRMATION';

  @ApiProperty({ ...OPTIONAL_DATE, example: '2026-11-14T05:59:00.000Z' })
  dueAt!: string | null;

  @ApiProperty({
    type: MoneyDto,
    nullable: true,
    description: 'Monto a pagar (null en confirmación).',
  })
  amount!: MoneyDto | null;

  @ApiProperty({
    example: false,
    description:
      'Comprobante de transferencia "Pendiente de validación" (Fase 05): la postulación no vence.',
  })
  transferPendingValidation!: boolean;

  @ApiProperty({
    example: false,
    description:
      'Fase 05: el último comprobante fue "Rechazado" (ver motivo en Mis pagos) y puede subir otro.',
  })
  transferRejected!: boolean;

  @ApiProperty({
    example: false,
    description:
      'Fase 05: ya inició un pago (abrió Stripe o subió comprobante): "Con pago iniciado".',
  })
  paymentStarted!: boolean;
}

/** Tarjeta de "Mis postulaciones" (HU-21) y widgets del Dashboard (HU-06). */
export class ApplicationCardDto {
  @ApiProperty({ format: 'uuid', example: '3a1f5c2e-7b9d-4e8a-9c1b-2d3e4f5a6b7c' })
  id!: string;

  @ApiProperty({
    example: 'BEC-000123',
    description: 'Folio (BEC-… beca, CONV-… convocatoria). Se muestra desde el envío.',
  })
  folio!: string;

  @ApiProperty({ enum: ApplicationKind, example: 'SCHOLARSHIP' })
  kind!: ApplicationKind;

  @ApiProperty({
    enum: ApplicationStatus,
    example: 'APPROVED_PENDING_PAYMENT',
    description: 'Estado global (tabla enum → texto en la guía de la Fase 04).',
  })
  status!: ApplicationStatus;

  @ApiProperty({ ...DATE, example: '2026-10-30T18:00:00.000Z' })
  statusChangedAt!: string;

  @ApiProperty({ type: ApplicationOfferDto })
  offer!: ApplicationOfferDto;

  @ApiProperty({ ...OPTIONAL_DATE, example: '2026-10-21T17:30:00.000Z', description: 'Envío.' })
  submittedAt!: string | null;

  @ApiProperty({
    ...DATE,
    example: '2026-10-21T17:29:10.000Z',
    description: 'Último guardado ("Borrador guardado · hh:mm").',
  })
  updatedAt!: string;

  @ApiProperty({
    example: true,
    description:
      'Requiere acción (entrevista, pago o confirmación): destácala arriba con cuenta regresiva.',
  })
  requiresAction!: boolean;

  @ApiProperty({ type: ApplicationActionDto, description: 'Acción contextual (un botón).' })
  action!: ApplicationActionDto;

  @ApiProperty({ type: [TimelineStepDto], description: 'Línea de tiempo (vertical en mobile).' })
  timeline!: TimelineStepDto[];

  @ApiProperty({
    type: InterviewDto,
    nullable: true,
    description: 'Solo en "Entrevista agendada" (y como referencia después).',
  })
  interview!: InterviewDto | null;

  @ApiProperty({
    type: ScholarshipResultDto,
    nullable: true,
    description: 'Solo becas aprobadas: tipo solicitado y asignado, saldo y fecha límite.',
  })
  scholarshipResult!: ScholarshipResultDto | null;

  @ApiProperty({
    type: ApplicationResponseDeadlineDto,
    nullable: true,
    description: 'Solo en "Aprobada – …": qué hacer y hasta cuándo.',
  })
  response!: ApplicationResponseDeadlineDto | null;
}

export class ApplicantDto {
  @ApiProperty({ example: 'María José Núñez' })
  fullName!: string;

  @ApiProperty({ example: 'maria@example.com', description: 'No editable.' })
  email!: string;

  @ApiProperty({ type: PhoneDto, description: 'WhatsApp con indicativo.' })
  phone!: PhoneDto;

  @ApiProperty({ example: 'MX' })
  countryCode!: string;

  @ApiProperty({ example: 'México' })
  countryName!: string;

  @ApiProperty({ example: 'Oaxaca', description: 'Territorio: estado/departamento.' })
  divisionName!: string;

  @ApiProperty({ example: 'San José del Pacífico' })
  municipalityName!: string;

  @ApiProperty({
    enum: ['MXN', 'USD'],
    example: 'MXN',
    description: 'Moneda de cobro (país del perfil).',
  })
  currency!: 'MXN' | 'USD';
}

export class ApplicationAnswersDto {
  @ApiProperty({ type: Number, nullable: true, example: 29 })
  age!: number | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  partnerCode!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Colectivo Agua Viva' })
  organization!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Coordinadora' })
  organizationRole!: string | null;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Tipo de beca solicitado (antes `requestedLevel`).',
  })
  requestedScholarshipTypeId!: string | null;

  @ApiProperty({ type: ScholarshipTypeSummaryDto, nullable: true })
  requestedScholarshipType!: ScholarshipTypeSummaryDto | null;

  @ApiProperty({ type: String, nullable: true, example: 'Necesito la beca porque…' })
  intentLetter!: string | null;

  @ApiProperty({ example: false })
  eligibilityConfirmed!: boolean;

  @ApiProperty({ type: String, nullable: true, example: null })
  experience!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  motivation!: string | null;

  @ApiProperty({ type: Boolean, nullable: true, example: null })
  canTravel!: boolean | null;

  @ApiProperty({ type: [String], example: ['https://www.youtube.com/watch?v=abc123'] })
  evidenceLinks!: string[];

  @ApiProperty({ example: true })
  termsAccepted!: boolean;

  @ApiProperty({ ...OPTIONAL_DATE, example: '2026-10-21T17:29:10.000Z' })
  termsAcceptedAt!: string | null;
}

export class ApplicationDocumentDto {
  @ApiProperty({ format: 'uuid', example: '5b2c3d4e-6f70-4a81-92b3-c4d5e6f70812' })
  id!: string;

  @ApiProperty({ example: 'huerto-comunitario.jpg' })
  fileName!: string;

  @ApiProperty({ example: 'image/jpeg' })
  mimeType!: string;

  @ApiProperty({ example: 2400000 })
  sizeBytes!: number;

  @ApiProperty({
    enum: ['IMAGE', 'VIDEO'],
    example: 'IMAGE',
    description: 'Ícono / previsualización.',
  })
  mediaType!: 'IMAGE' | 'VIDEO';

  @ApiProperty({ ...DATE, example: '2026-10-21T17:20:00.000Z' })
  createdAt!: string;
}

export class StatusHistoryItemDto {
  @ApiProperty({ enum: ApplicationStatus, example: 'SUBMITTED' })
  status!: ApplicationStatus;

  @ApiProperty({ ...DATE, example: '2026-10-21T17:30:00.000Z' })
  at!: string;
}

export class FieldIssueDto {
  @ApiProperty({ example: 'intentLetter', description: 'Campo del formulario (o `documents`).' })
  field!: string;

  @ApiProperty({ enum: Object.values(ApplicationFieldCode), example: 'MIN_LENGTH' })
  code!: ApplicationFieldCode;

  @ApiProperty({
    example: 'La carta de intención debe tener al menos 800 caracteres (llevas 120).',
  })
  message!: string;
}

export class FileLimitDto {
  @ApiProperty({ type: [String], example: ['image/jpeg', 'image/png', 'image/heic'] })
  mimeTypes!: string[];

  @ApiProperty({ example: 10485760 })
  maxBytes!: number;
}

export class ApplicationFormLimitsDto {
  @ApiProperty({ example: R.SCHOLARSHIP_LETTER_MIN_LENGTH })
  letterMinLength!: number;

  @ApiProperty({ example: R.SCHOLARSHIP_LETTER_MAX_LENGTH })
  letterMaxLength!: number;

  @ApiProperty({ example: R.OPEN_CALL_ANSWER_MIN_LENGTH })
  answerMinLength!: number;

  @ApiProperty({ example: R.OPEN_CALL_ANSWER_MAX_LENGTH })
  answerMaxLength!: number;

  @ApiProperty({
    example: R.FILE_LIMITS.EVIDENCE_MIN_FILES,
    description: 'Mínimo de archivos (0 en convocatorias: evidencia opcional).',
  })
  minFiles!: number;

  @ApiProperty({ example: R.FILE_LIMITS.EVIDENCE_MAX_FILES })
  maxFiles!: number;

  @ApiProperty({ example: R.EVIDENCE_MAX_LINKS })
  maxLinks!: number;

  @ApiProperty({ type: FileLimitDto })
  image!: FileLimitDto;

  @ApiProperty({ type: FileLimitDto })
  video!: FileLimitDto;
}

export class ApplicationFormDto {
  @ApiProperty({ type: ApplicationWindowDto })
  window!: ApplicationWindowDto;

  @ApiProperty({
    type: [OfferScholarshipTypeDto],
    description:
      'Beca: tipos de beca activos del diplomado con monto estimado en tu moneda ("el tipo final ' +
      'lo asigna el equipo"; antes `levels`). Vacío en convocatorias.',
  })
  scholarshipTypes!: OfferScholarshipTypeDto[];

  @ApiProperty({ type: MoneyDto, nullable: true, description: 'Costo de la oferta en tu moneda.' })
  price!: MoneyDto | null;

  @ApiProperty({ type: ApplicationEligibilityDto, nullable: true })
  eligibility!: ApplicationEligibilityDto | null;

  @ApiProperty({
    example: false,
    description:
      'Mostrar aviso de entrevista por Zoom: siempre en convocatorias; en becas si el tipo solicitado tiene `requiresInterview`.',
  })
  interviewNotice!: boolean;

  @ApiProperty({ type: ApplicationFormLimitsDto })
  limits!: ApplicationFormLimitsDto;
}

/** Detalle / formulario de una postulación ("Ver mi postulación" y edición del borrador). */
export class ApplicationDetailDto extends ApplicationCardDto {
  @ApiProperty({
    example: true,
    description: 'Borrador editable (ventana abierta y estado DRAFT).',
  })
  editable!: boolean;

  @ApiProperty({ type: ApplicantDto, description: 'Datos precargados del perfil (HU-14).' })
  applicant!: ApplicantDto;

  @ApiProperty({ type: ApplicationAnswersDto })
  answers!: ApplicationAnswersDto;

  @ApiProperty({ type: [ApplicationDocumentDto] })
  documents!: ApplicationDocumentDto[];

  @ApiProperty({
    type: [FieldIssueDto],
    description:
      'Pendientes para poder enviar (solo en borrador): validaciones en línea; mientras no esté ' +
      'vacío, "Enviar postulación" sigue deshabilitado.',
  })
  missingRequirements!: FieldIssueDto[];

  @ApiProperty({
    type: [StatusHistoryItemDto],
    description: 'Historial de estados con fecha y hora.',
  })
  history!: StatusHistoryItemDto[];

  @ApiProperty({ type: ApplicationFormDto })
  form!: ApplicationFormDto;
}

export class MyApplicationRefDto {
  @ApiProperty({ format: 'uuid', example: '3a1f5c2e-7b9d-4e8a-9c1b-2d3e4f5a6b7c' })
  id!: string;

  @ApiProperty({ enum: ApplicationStatus, example: 'SUBMITTED' })
  status!: ApplicationStatus;

  @ApiProperty({ example: 'CONV-000045' })
  folio!: string;
}

/** Tarjeta de "Becas disponibles" / "Convocatorias abiertas" (HU-19 / HU-20). */
export class ApplicationOpportunityDto {
  @ApiProperty({ enum: ApplicationKind, example: 'OPEN_CALL' })
  kind!: ApplicationKind;

  @ApiProperty({ type: ApplicationOfferDto })
  offer!: ApplicationOfferDto;

  @ApiProperty({ type: ApplicationWindowDto })
  window!: ApplicationWindowDto;

  @ApiProperty({
    type: MoneyDto,
    nullable: true,
    description: 'Costo en tu moneda; null = "Gratuito".',
  })
  price!: MoneyDto | null;

  @ApiProperty({
    type: [OfferScholarshipTypeDto],
    description: 'Beca: tipos de beca y monto estimado (antes `levels`). Vacío en convocatorias.',
  })
  scholarshipTypes!: OfferScholarshipTypeDto[];

  @ApiProperty({ type: ApplicationEligibilityDto, nullable: true })
  eligibility!: ApplicationEligibilityDto | null;

  @ApiProperty({
    type: MyApplicationRefDto,
    nullable: true,
    description: 'Mi postulación (una por cohorte): en vez de [Postular] → [Ver mi postulación].',
  })
  myApplication!: MyApplicationRefDto | null;

  @ApiProperty({
    example: true,
    description: '[Postular] habilitado (ventana abierta, sin postulación previa ni inscripción).',
  })
  canApply!: boolean;

  @ApiProperty({
    example: false,
    description: 'Ya inscrito en la oferta (no se postula).',
  })
  enrolled!: boolean;
}

export class ApplicationOpportunitiesDto {
  @ApiProperty({
    type: [ApplicationOpportunityDto],
    description: 'Abiertas primero, ordenadas por cierre más próximo; luego las próximas.',
  })
  data!: ApplicationOpportunityDto[];
}

export class ApplicationUploadUrlDto {
  @ApiProperty({ example: 'https://storage.example.com/eia-prod/applications/…?X-Amz-Signature=…' })
  uploadUrl!: string;

  @ApiProperty({ example: 'PUT', enum: ['PUT'] })
  method!: 'PUT';

  @ApiProperty({
    example: { 'Content-Type': 'image/jpeg' },
    description: 'Headers obligatorios del PUT.',
  })
  headers!: Record<string, string>;

  @ApiProperty({
    example: 'applications/3a1f…/evidence/2f0e…-huerto-comunitario.jpg',
    description: 'Envíala a `POST …/documents` para confirmar el archivo.',
  })
  key!: string;

  @ApiProperty({ ...DATE, example: '2026-10-21T18:00:00.000Z' })
  expiresAt!: string;
}

/** Widget Becas / Convocatorias del Dashboard (HU-06). */
export class ApplicationsWidgetDto {
  @ApiProperty({
    type: ApplicationCardDto,
    nullable: true,
    description:
      'Postulación más reciente de este tipo (mismo estado que "Mis postulaciones"). null → ' +
      'invitar a postular (enlace a Becas / Convocatorias).',
  })
  latest!: ApplicationCardDto | null;

  @ApiProperty({ example: 1, description: 'Postulaciones de este tipo que requieren acción.' })
  actionRequired!: number;

  @ApiProperty({ example: 2, description: 'Becas / convocatorias con postulación abierta ahora.' })
  openCount!: number;

  @ApiProperty({
    example: 1,
    description:
      'Convocatorias abiertas publicadas desde tu última visita a "Convocatorias abiertas" (todas si ' +
      'nunca la abriste). En Becas siempre 0.',
  })
  newCount!: number;
}
