import { ApiProperty } from '@nestjs/swagger';
import {
  ApplicationKind,
  ApplicationStatus,
  InstallmentPlanStatus,
  InstallmentStatus,
  OfferType,
  PaymentConcept,
  PaymentMethod,
  PaymentStatus,
  TransferRejectionReason,
} from '../../../generated/prisma/client';
import { MoneyDto } from '../../offers/dto/offers.response.dto';
import { ScholarshipTypeSummaryDto } from '../../scholarship-types/dto/scholarship-types.dto';
import { OfferActionReason } from '../../offers/policies/offer-actions.policy';
import { InstallmentOptionReason } from '../policies/payment-amounts.policy';
import { PaymentNotAllowedReason } from '../policies/checkout.policy';
import { TransferUnavailableReason } from '../policies/transfer.policy';

const DATE = { type: String, format: 'date-time' } as const;
const OPTIONAL_DATE = { ...DATE, nullable: true } as const;

export class PaymentOfferRefDto {
  @ApiProperty({ format: 'uuid', example: '9d3c6a1e-2b4f-4c8d-9e0a-1b2c3d4e5f60' })
  id!: string;

  @ApiProperty({ example: 'diplomado-en-ecotecnologias-del-agua' })
  slug!: string;

  @ApiProperty({ example: 'Diplomado en Ecotecnologías del Agua' })
  name!: string;

  @ApiProperty({ enum: OfferType, example: 'DIPLOMA' })
  type!: OfferType;

  @ApiProperty({ type: String, nullable: true, example: 'Generación 2026–2027' })
  cohortLabel!: string | null;

  @ApiProperty({ ...OPTIONAL_DATE, example: '2026-11-07T16:00:00.000Z' })
  startsAt!: string | null;

  @ApiProperty({ ...OPTIONAL_DATE, example: '2027-04-25T19:00:00.000Z' })
  endsAt!: string | null;
}

export class CardDto {
  @ApiProperty({ type: String, nullable: true, example: 'visa' })
  brand!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '4242', description: 'Últimos 4 dígitos.' })
  last4!: string | null;
}

export class InstallmentRefDto {
  @ApiProperty({ example: 2 })
  sequence!: number;

  @ApiProperty({ example: 3 })
  count!: number;
}

export class TransferInfoDto {
  @ApiProperty({ example: 'EIA BEC-000123', description: 'Referencia única (concepto del SPEI).' })
  reference!: string;

  @ApiProperty({ type: MoneyDto, nullable: true, description: 'Monto declarado por la persona.' })
  declaredAmount!: MoneyDto | null;

  @ApiProperty({ type: String, nullable: true, example: '2026-11-03' })
  paidOn!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'MBAN01002611030012345678' })
  trackingKey!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'comprobante-spei.pdf' })
  proofFileName!: string | null;

  @ApiProperty({ ...OPTIONAL_DATE, example: '2026-11-03T18:20:00.000Z' })
  submittedAt!: string | null;

  @ApiProperty({ ...OPTIONAL_DATE, example: null })
  reviewedAt!: string | null;

  @ApiProperty({
    enum: TransferRejectionReason,
    nullable: true,
    example: null,
    description:
      'Si "Rechazada": ILLEGIBLE "Comprobante ilegible" · AMOUNT_MISMATCH "El monto no coincide" · ' +
      'NOT_FOUND "No encontramos la transferencia" · OTHER "Otro motivo" (ver `rejectionNote`).',
  })
  rejectionReason!: TransferRejectionReason | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  rejectionNote!: string | null;
}

export class CheckoutLinkDto {
  @ApiProperty({ example: 'https://checkout.stripe.com/c/pay/cs_test_…' })
  url!: string;

  @ApiProperty({ ...DATE, example: '2026-11-03T18:50:00.000Z' })
  expiresAt!: string;
}

/** Un pago del historial (HU-26) o el resultado de un checkout (HU-22 "Procesando pago…"). */
export class PaymentDto {
  @ApiProperty({ format: 'uuid', example: '5b2c1d0e-9f8a-4b7c-8d6e-5f4a3b2c1d0e' })
  id!: string;

  @ApiProperty({ example: 'PAG-000123', description: 'Folio del recibo.' })
  folio!: string;

  @ApiProperty({
    enum: PaymentConcept,
    example: 'FULL_PRICE',
    description:
      'FULL_PRICE "Pago completo" · BALANCE "Saldo tras beca" (o "Pago de convocatoria") · ' +
      'INSTALLMENT "Cuota n de N" (ver `installment`).',
  })
  concept!: PaymentConcept;

  @ApiProperty({ example: 'Pago completo', description: 'Concepto ya redactado (recibo).' })
  conceptLabel!: string;

  @ApiProperty({ type: InstallmentRefDto, nullable: true })
  installment!: InstallmentRefDto | null;

  @ApiProperty({ enum: PaymentMethod, example: 'CARD' })
  method!: PaymentMethod;

  @ApiProperty({
    enum: PaymentStatus,
    example: 'PAID',
    description: 'Ver tabla de textos en docs/frontend/fase-05-pagos.md.',
  })
  status!: PaymentStatus;

  @ApiProperty({ type: MoneyDto })
  amount!: MoneyDto;

  @ApiProperty({ type: MoneyDto, nullable: true, description: 'Reembolsado (si aplica).' })
  refunded!: MoneyDto | null;

  @ApiProperty({ type: PaymentOfferRefDto })
  offer!: PaymentOfferRefDto;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  applicationId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  planId!: string | null;

  @ApiProperty({ type: CardDto, nullable: true })
  card!: CardDto | null;

  @ApiProperty({ type: TransferInfoDto, nullable: true })
  transfer!: TransferInfoDto | null;

  @ApiProperty({
    example: true,
    description:
      '"Descargar comprobante" (solo Pagado o Validada): `GET /me/payments/{id}/receipt`.',
  })
  receiptAvailable!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'https://pay.stripe.com/receipts/…',
    description: 'Recibo de Stripe (opcional, además del PDF propio).',
  })
  stripeReceiptUrl!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null, description: 'Motivo del rechazo.' })
  failureMessage!: string | null;

  @ApiProperty({
    type: CheckoutLinkDto,
    nullable: true,
    description: 'Solo PENDING con checkout abierto: [Continuar pago] → redirigir a `url`.',
  })
  checkout!: CheckoutLinkDto | null;

  @ApiProperty({ ...DATE, example: '2026-11-03T18:20:00.000Z' })
  createdAt!: string;

  @ApiProperty({ ...OPTIONAL_DATE, example: '2026-11-03T18:22:10.000Z' })
  paidAt!: string | null;

  @ApiProperty({ ...OPTIONAL_DATE, example: null })
  failedAt!: string | null;
}

export class PlanInstallmentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 2 })
  sequence!: number;

  @ApiProperty({ type: MoneyDto })
  amount!: MoneyDto;

  @ApiProperty({ ...DATE, example: '2026-12-03T18:20:00.000Z' })
  dueAt!: string;

  @ApiProperty({
    enum: InstallmentStatus,
    example: 'SCHEDULED',
    description:
      'SCHEDULED "Programada" · PROCESSING "En cobro" · PAID "Pagada" · FAILED "Fallida" · CANCELLED.',
  })
  status!: InstallmentStatus;

  @ApiProperty({ ...OPTIONAL_DATE, example: null })
  paidAt!: string | null;

  @ApiProperty({ example: 0, description: 'Intentos de cobro automático realizados.' })
  attempts!: number;

  @ApiProperty({ ...OPTIONAL_DATE, example: null, description: 'Próximo reintento automático.' })
  nextRetryAt!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  failureMessage!: string | null;
}

/** Plan de cuotas (HU-24 / HU-26). */
export class PaymentPlanDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    enum: InstallmentPlanStatus,
    example: 'CURRENT',
    description:
      'CURRENT "Al día" · PAST_DUE "Cobro fallido" · DELINQUENT "En mora" · COMPLETED "Completado" · ' +
      'CANCELLED "Cancelado" · PENDING_ACTIVATION (checkout de la 1.ª cuota sin completar).',
  })
  status!: InstallmentPlanStatus;

  @ApiProperty({ enum: ['FULL_PRICE', 'BALANCE'], example: 'FULL_PRICE' })
  concept!: PaymentConcept;

  @ApiProperty({ type: PaymentOfferRefDto })
  offer!: PaymentOfferRefDto;

  @ApiProperty({ type: MoneyDto })
  total!: MoneyDto;

  @ApiProperty({ example: 3 })
  installmentCount!: number;

  @ApiProperty({ example: 1, description: '"1 de 3 cuotas pagadas".' })
  paidCount!: number;

  @ApiProperty({ type: MoneyDto })
  paidAmount!: MoneyDto;

  @ApiProperty({ type: MoneyDto, description: 'Pendiente (incluye cuotas fallidas).' })
  pendingAmount!: MoneyDto;

  @ApiProperty({ type: PlanInstallmentDto, nullable: true, description: 'Próximo cobro.' })
  nextCharge!: PlanInstallmentDto | null;

  @ApiProperty({
    type: CardDto,
    nullable: true,
    description: 'Tarjeta asociada (marca y últimos 4).',
  })
  card!: CardDto | null;

  @ApiProperty({
    ...OPTIONAL_DATE,
    example: null,
    description: 'Primer cobro fallido sin regularizar.',
  })
  failedSince!: string | null;

  @ApiProperty({
    ...OPTIONAL_DATE,
    example: null,
    description: 'Cuándo pasa (o pasó) a "En mora" si no se regulariza.',
  })
  delinquencyAt!: string | null;

  @ApiProperty({ type: Number, nullable: true, example: null })
  daysSinceFailure!: number | null;

  @ApiProperty({ example: false, description: 'Acceso al Aula suspendido por mora.' })
  accessSuspended!: boolean;

  @ApiProperty({
    example: false,
    description: '[Pagar ahora]: hay cuotas fallidas (`POST /me/payments/plans/{id}/pay-now`).',
  })
  canPayNow!: boolean;

  @ApiProperty({
    example: true,
    description: '[Actualizar tarjeta]: plan vigente (`POST /me/payments/plans/{id}/card-update`).',
  })
  canUpdateCard!: boolean;

  @ApiProperty({ type: [PlanInstallmentDto] })
  installments!: PlanInstallmentDto[];

  @ApiProperty({ ...OPTIONAL_DATE, example: '2026-11-03T18:22:10.000Z' })
  activatedAt!: string | null;
}

export class PaymentPlansDto {
  @ApiProperty({ type: [PaymentPlanDto] })
  data!: PaymentPlanDto[];
}

export const PaymentAlertType = {
  INSTALLMENT_FAILED: 'INSTALLMENT_FAILED',
  PLAN_DELINQUENT: 'PLAN_DELINQUENT',
  TRANSFER_REJECTED: 'TRANSFER_REJECTED',
  TRANSFER_PENDING: 'TRANSFER_PENDING',
  INSTALLMENT_UPCOMING: 'INSTALLMENT_UPCOMING',
} as const;
export type PaymentAlertType = (typeof PaymentAlertType)[keyof typeof PaymentAlertType];

/** Aviso destacado (Mis pagos, Dashboard, Aula). */
export class PaymentAlertDto {
  @ApiProperty({
    enum: Object.values(PaymentAlertType),
    example: 'INSTALLMENT_FAILED',
    description:
      'INSTALLMENT_FAILED "Cobro fallido" ([Actualizar tarjeta] / [Pagar ahora]) · PLAN_DELINQUENT ' +
      '"En mora" · TRANSFER_REJECTED "Rechazada" ([Subir comprobante]) · TRANSFER_PENDING ' +
      '"Pendiente de validación" · INSTALLMENT_UPCOMING "Próximo cobro" (informativo).',
  })
  type!: PaymentAlertType;

  @ApiProperty({ type: PaymentOfferRefDto })
  offer!: PaymentOfferRefDto;

  @ApiProperty({ type: MoneyDto })
  amount!: MoneyDto;

  @ApiProperty({ ...OPTIONAL_DATE, description: 'Fecha del cobro / fecha límite / fallo.' })
  date!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  planId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  paymentId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  applicationId!: string | null;

  @ApiProperty({ type: CardDto, nullable: true })
  card!: CardDto | null;
}

export class PaymentsSummaryDto {
  @ApiProperty({ type: [PaymentPlanDto], description: 'Planes vigentes (arriba en Mis pagos).' })
  activePlans!: PaymentPlanDto[];

  @ApiProperty({
    type: [PaymentAlertDto],
    description: 'Avisos destacados (fallidos, mora, transferencias).',
  })
  alerts!: PaymentAlertDto[];

  @ApiProperty({ example: true })
  hasPayments!: boolean;

  @ApiProperty({
    example: false,
    description:
      'Sin pagos pero con formaciones Moodle: "Tus formaciones de Moodle se pagaron fuera".',
  })
  moodleOnly!: boolean;
}

// --- Pantalla de pago (quote) ----------------------------------------------------------------------

export class QuoteInstallmentOptionDto {
  @ApiProperty({ example: 3 })
  count!: number;

  @ApiProperty({ example: true })
  available!: boolean;

  @ApiProperty({
    enum: Object.values(InstallmentOptionReason),
    nullable: true,
    example: null,
    description: 'LAST_INSTALLMENT_AFTER_END: la última cuota caería después del fin de la oferta.',
  })
  reason!: InstallmentOptionReason | null;

  @ApiProperty({ type: MoneyDto, description: 'Monto por cuota (la última lleva el ajuste).' })
  perInstallment!: MoneyDto;

  @ApiProperty({
    type: [PlanInstallmentDto],
    description: 'Calendario: la 1.ª "Se cobra al confirmar".',
  })
  schedule!: Array<Pick<PlanInstallmentDto, 'sequence' | 'amount' | 'dueAt'>>;
}

export class QuoteInstallmentsDto {
  @ApiProperty({ example: 4, description: 'Máximo de la oferta.' })
  max!: number;

  @ApiProperty({ type: [QuoteInstallmentOptionDto] })
  options!: QuoteInstallmentOptionDto[];
}

export class QuoteMethodDto {
  @ApiProperty({ enum: PaymentMethod, example: 'CARD' })
  method!: PaymentMethod;

  @ApiProperty({ example: true })
  available!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description:
      'Tarjeta: PAYMENTS_NOT_CONFIGURED. Transferencia: ' +
      Object.values(TransferUnavailableReason).join(' / ') +
      ' (NOT_MEXICO → no mostrar la opción "Solo México").',
  })
  reason!: string | null;
}

export class BankTransferDetailsDto {
  @ApiProperty({ example: 'Escuela Itinerante del Agua A.C.' })
  accountHolder!: string;

  @ApiProperty({ example: 'Banco Ejemplo' })
  bankName!: string;

  @ApiProperty({ example: '012180001234567891' })
  clabe!: string;

  @ApiProperty({
    example: 'EIA BEC-000123',
    description: 'Referencia única (pégala en el concepto).',
  })
  reference!: string;

  @ApiProperty({ type: MoneyDto, description: 'Monto a transferir en MXN.' })
  amount!: MoneyDto;
}

export class QuoteApplicationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'BEC-000123' })
  folio!: string;

  @ApiProperty({ enum: ApplicationKind, example: 'SCHOLARSHIP' })
  kind!: ApplicationKind;

  @ApiProperty({ enum: ApplicationStatus, example: 'APPROVED_PENDING_PAYMENT' })
  status!: ApplicationStatus;

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
    description: '`name` = nombre del tipo al aprobar.',
  })
  assignedScholarshipType!: ScholarshipTypeSummaryDto | null;

  @ApiProperty({ type: Number, nullable: true, example: 50 })
  assignedPercent!: number | null;

  @ApiProperty({ type: MoneyDto, nullable: true, description: 'Monto original.' })
  originalAmount!: MoneyDto | null;

  @ApiProperty({
    ...OPTIONAL_DATE,
    example: '2026-11-14T05:59:00.000Z',
    description: 'Fecha límite.',
  })
  dueAt!: string | null;
}

export class QuoteBlockerDto {
  @ApiProperty({
    example: 'OFFER_SOLD_OUT',
    description:
      'Mismo `code` que respondería `POST /me/payments/checkout`: ENROLLMENT_ALREADY_EXISTS ("Ya ' +
      'estás inscrito · Ir a mi aula"), OFFER_SOLD_OUT ("Cupo agotado"), ENROLLMENT_CLOSED, ' +
      'PAYMENT_NOT_ALLOWED, PAYMENT_BALANCE_NOT_DUE, APPLICATION_DEADLINE_PASSED, ' +
      'PAYMENT_TRANSFER_PENDING.',
  })
  code!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { reason: 'SOLD_OUT' },
    description: `Datos del motivo (p. ej. \`reason\`: ${[
      ...Object.values(OfferActionReason),
      ...Object.values(PaymentNotAllowedReason),
    ].join(' / ')}).`,
  })
  meta!: Record<string, unknown>;
}

/** Resumen de la pantalla de pago (HU-22 paso "Resumen", HU-23 "Pagar saldo", HU-24 chips). */
export class PaymentQuoteDto {
  @ApiProperty({ enum: ['FULL_PRICE', 'BALANCE'], example: 'FULL_PRICE' })
  concept!: 'FULL_PRICE' | 'BALANCE';

  @ApiProperty({ type: PaymentOfferRefDto })
  offer!: PaymentOfferRefDto;

  @ApiProperty({ type: QuoteApplicationDto, nullable: true, description: 'Solo saldo tras beca.' })
  application!: QuoteApplicationDto | null;

  @ApiProperty({
    type: MoneyDto,
    nullable: true,
    description: 'Total a pagar (calculado por el servidor).',
  })
  amount!: MoneyDto | null;

  @ApiProperty({ type: [QuoteMethodDto] })
  methods!: QuoteMethodDto[];

  @ApiProperty({
    type: QuoteInstallmentsDto,
    nullable: true,
    description: 'null si la oferta no tiene cuotas.',
  })
  installments!: QuoteInstallmentsDto | null;

  @ApiProperty({
    type: BankTransferDetailsDto,
    nullable: true,
    description: 'Solo si la transferencia está disponible.',
  })
  bankTransfer!: BankTransferDetailsDto | null;

  @ApiProperty({
    type: QuoteBlockerDto,
    nullable: true,
    description: 'Si no se puede pagar: motivo (botón deshabilitado).',
  })
  blocker!: QuoteBlockerDto | null;

  @ApiProperty({
    type: PaymentDto,
    nullable: true,
    description: 'Checkout abierto → [Continuar pago].',
  })
  openCheckout!: PaymentDto | null;

  @ApiProperty({
    type: PaymentDto,
    nullable: true,
    description: 'Comprobante en validación o el último rechazado.',
  })
  latestTransfer!: PaymentDto | null;
}

export class CheckoutSessionDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Consulta su estado con `GET /me/payments/{paymentId}`.',
  })
  paymentId!: string;

  @ApiProperty({
    example: 'https://checkout.stripe.com/c/pay/cs_test_…',
    description: 'Redirige aquí.',
  })
  checkoutUrl!: string;

  @ApiProperty({ ...DATE, example: '2026-11-03T18:50:00.000Z' })
  expiresAt!: string;

  @ApiProperty({
    example: false,
    description: 'true = se reutilizó el checkout abierto (Continuar pago).',
  })
  reused!: boolean;
}

export class CardUpdateSessionDto {
  @ApiProperty({ example: 'https://checkout.stripe.com/c/pay/cs_test_…' })
  checkoutUrl!: string;

  @ApiProperty({ ...DATE, example: '2026-11-03T18:50:00.000Z' })
  expiresAt!: string;
}

export class TransferUploadUrlDto {
  @ApiProperty({
    example: 'https://storage.example.com/eia-prod/payments/transfers/…?X-Amz-Signature=…',
  })
  uploadUrl!: string;

  @ApiProperty({ example: 'PUT' })
  method!: 'PUT';

  @ApiProperty({ example: { 'Content-Type': 'application/pdf' } })
  headers!: Record<string, string>;

  @ApiProperty({ example: 'payments/transfers/3a1f…/2f0e…-comprobante-spei.pdf' })
  key!: string;

  @ApiProperty({ ...DATE, example: '2026-11-03T18:35:00.000Z' })
  expiresAt!: string;
}

/** Bloque "pagos" del Dashboard (HU-06 aviso de cuota, HU-24 banner de cobro fallido). */
export class DashboardPaymentsDto {
  @ApiProperty({
    type: [PaymentAlertDto],
    description:
      'Cuotas que se cobrarán en los próximos 7 días (monto, fecha y tarjeta): aviso informativo.',
  })
  upcomingInstallments!: PaymentAlertDto[];

  @ApiProperty({
    type: [PaymentAlertDto],
    description: 'Cobro fallido / En mora / transferencia rechazada: banner destacado → Mis pagos.',
  })
  alerts!: PaymentAlertDto[];
}
