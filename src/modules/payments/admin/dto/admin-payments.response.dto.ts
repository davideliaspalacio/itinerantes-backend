import { ApiProperty } from '@nestjs/swagger';
import {
  EnrollmentStatus,
  PaymentConcept,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
  TransferRejectionReason,
} from '../../../../generated/prisma/client';
import { MoneyDto } from '../../../offers/dto/offers.response.dto';
import {
  CardDto,
  InstallmentRefDto,
  PaymentOfferRefDto,
  PaymentPlanDto,
} from '../../dto/payments.response.dto';
import { PlanAction } from '../policies/admin-payments.policy';

const DATE = { type: String, format: 'date-time', example: '2026-11-07T16:00:00.000Z' } as const;
const OPTIONAL_DATE = { ...DATE, nullable: true } as const;

export class AdminPayerDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Ana Núñez' })
  fullName!: string;

  @ApiProperty({ example: 'ana@correo.mx' })
  email!: string;

  @ApiProperty({ example: 'MX' })
  countryCode!: string;

  @ApiProperty({
    example: '+52 5512345678',
    nullable: true,
    type: String,
    description: 'Teléfono con indicativo ("Contactar").',
  })
  phone!: string | null;
}

export class AdminUserRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Finanzas Escuela' })
  fullName!: string;
}

export class AdminStripeRefsDto {
  @ApiProperty({
    example: 'pi_3Q…',
    nullable: true,
    type: String,
    description: 'ID de Stripe (HU-33).',
  })
  paymentIntentId!: string | null;

  @ApiProperty({ example: 'cs_test_…', nullable: true, type: String })
  checkoutSessionId!: string | null;

  @ApiProperty({ example: 'ch_3Q…', nullable: true, type: String })
  chargeId!: string | null;

  @ApiProperty({ example: 'https://pay.stripe.com/receipts/…', nullable: true, type: String })
  receiptUrl!: string | null;
}

export class AdminTransferInfoDto {
  @ApiProperty({ example: 'EIA BEC-000123', description: 'Referencia única por postulación.' })
  reference!: string;

  @ApiProperty({ type: MoneyDto, description: 'Saldo esperado (MXN).' })
  expectedAmount!: MoneyDto;

  @ApiProperty({ type: MoneyDto, nullable: true, description: 'Monto que declaró la persona.' })
  declaredAmount!: MoneyDto | null;

  @ApiProperty({
    example: '2026-11-09',
    nullable: true,
    type: String,
    description: 'Fecha declarada.',
  })
  declaredPaidOn!: string | null;

  @ApiProperty({ example: 'MBAN01002611090012345', nullable: true, type: String })
  trackingKey!: string | null;

  @ApiProperty({ example: 'comprobante.pdf', nullable: true, type: String })
  proofFileName!: string | null;

  @ApiProperty({ example: 'application/pdf', nullable: true, type: String })
  proofMimeType!: string | null;

  @ApiProperty({ example: 182044, nullable: true, type: Number })
  proofSizeBytes!: number | null;

  @ApiProperty({ ...OPTIONAL_DATE, description: 'Envío del comprobante.' })
  submittedAt!: string | null;

  @ApiProperty({
    type: MoneyDto,
    nullable: true,
    description: 'Capturado por el equipo al validar.',
  })
  receivedAmount!: MoneyDto | null;

  @ApiProperty({ example: '2026-11-10', nullable: true, type: String })
  receivedOn!: string | null;

  @ApiProperty({ ...OPTIONAL_DATE })
  reviewedAt!: string | null;

  @ApiProperty({ type: AdminUserRefDto, nullable: true })
  reviewedBy!: AdminUserRefDto | null;

  @ApiProperty({ enum: TransferRejectionReason, nullable: true })
  rejectionReason!: TransferRejectionReason | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  rejectionNote!: string | null;
}

export class AdminPaymentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'PAG-000123' })
  folio!: string;

  @ApiProperty({ enum: PaymentConcept, example: 'BALANCE' })
  concept!: PaymentConcept;

  @ApiProperty({
    example: 'Saldo tras beca',
    description: 'Completo / saldo tras beca / cuota n de N.',
  })
  conceptLabel!: string;

  @ApiProperty({ type: InstallmentRefDto, nullable: true })
  installment!: InstallmentRefDto | null;

  @ApiProperty({ enum: PaymentMethod, example: 'CARD' })
  method!: PaymentMethod;

  @ApiProperty({ enum: PaymentStatus, example: 'PAID' })
  status!: PaymentStatus;

  @ApiProperty({ type: MoneyDto })
  amount!: MoneyDto;

  @ApiProperty({ type: MoneyDto, description: 'Reembolsado (confirmado). 0 si no hay.' })
  refunded!: MoneyDto;

  @ApiProperty({
    type: MoneyDto,
    description: 'Aún reembolsable (pagado − reembolsado − en proceso).',
  })
  refundable!: MoneyDto;

  @ApiProperty({ type: AdminPayerDto })
  payer!: AdminPayerDto;

  @ApiProperty({ type: PaymentOfferRefDto })
  offer!: PaymentOfferRefDto;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  applicationId!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  enrollmentId!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  planId!: string | null;

  @ApiProperty({ type: CardDto, nullable: true })
  card!: CardDto | null;

  @ApiProperty({ type: AdminStripeRefsDto })
  stripe!: AdminStripeRefsDto;

  @ApiProperty({ type: AdminTransferInfoDto, nullable: true, description: 'Solo transferencias.' })
  transfer!: AdminTransferInfoDto | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  failureMessage!: string | null;

  @ApiProperty(DATE)
  createdAt!: string;

  @ApiProperty(OPTIONAL_DATE)
  paidAt!: string | null;

  @ApiProperty(OPTIONAL_DATE)
  failedAt!: string | null;

  @ApiProperty(OPTIONAL_DATE)
  refundedAt!: string | null;
}

export class AdminRefundDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  paymentId!: string;

  @ApiProperty({ example: 'PAG-000123' })
  paymentFolio!: string;

  @ApiProperty({ type: MoneyDto })
  amount!: MoneyDto;

  @ApiProperty({
    enum: PaymentMethod,
    description: 'CARD = vía Stripe; BANK_TRANSFER = registrado (hecho fuera).',
  })
  method!: PaymentMethod;

  @ApiProperty({ enum: RefundStatus, example: 'SUCCEEDED' })
  status!: RefundStatus;

  @ApiProperty({ example: 'Baja antes del inicio.' })
  reason!: string;

  @ApiProperty({ example: 're_3Q…', nullable: true, type: String })
  stripeRefundId!: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  failureMessage!: string | null;

  @ApiProperty({ type: AdminUserRefDto, nullable: true })
  createdBy!: AdminUserRefDto | null;

  @ApiProperty({ type: AdminPayerDto })
  payer!: AdminPayerDto;

  @ApiProperty({ type: PaymentOfferRefDto })
  offer!: PaymentOfferRefDto;

  @ApiProperty(DATE)
  createdAt!: string;
}

export class AdminPaymentActionsDto {
  @ApiProperty({ example: true, description: '[Reembolsar] (requiere payments.manage).' })
  canRefund!: boolean;

  @ApiProperty({ example: false, description: '[Validar] / [Rechazar] transferencia pendiente.' })
  canReview!: boolean;
}

export class AdminPaymentDetailDto extends AdminPaymentDto {
  @ApiProperty({ type: [AdminRefundDto] })
  refunds!: AdminRefundDto[];

  @ApiProperty({ type: AdminPaymentActionsDto })
  actions!: AdminPaymentActionsDto;
}

export class CurrencyTotalsDto {
  @ApiProperty({ enum: ['MXN', 'USD'], example: 'MXN' })
  currency!: 'MXN' | 'USD';

  @ApiProperty({
    type: MoneyDto,
    description: 'Pagos con tarjeta pagados + transferencias validadas.',
  })
  collected!: MoneyDto;

  @ApiProperty({ type: MoneyDto })
  refunded!: MoneyDto;

  @ApiProperty({ type: MoneyDto, description: 'Cobrado − reembolsado.' })
  net!: MoneyDto;

  @ApiProperty({ example: 42 })
  paymentCount!: number;
}

export class PendingTransfersSummaryDto {
  @ApiProperty({
    example: 3,
    description: 'Contador de la pestaña "Transferencias por conciliar".',
  })
  count!: number;

  @ApiProperty({ type: MoneyDto })
  amount!: MoneyDto;
}

export class PlansSummaryDto {
  @ApiProperty({ example: 2, description: 'Cobro fallido.' })
  pastDue!: number;

  @ApiProperty({ example: 1, description: 'En mora.' })
  delinquent!: number;

  @ApiProperty({ example: 1, description: 'Con acceso suspendido.' })
  accessSuspended!: number;
}

export class AdminPaymentsSummaryDto {
  @ApiProperty({
    type: [CurrencyTotalsDto],
    description: 'Siempre MXN y USD por separado (nunca se suman).',
  })
  currencies!: CurrencyTotalsDto[];

  @ApiProperty({ type: PendingTransfersSummaryDto })
  pendingTransfers!: PendingTransfersSummaryDto;

  @ApiProperty({ type: PlansSummaryDto })
  plans!: PlansSummaryDto;

  @ApiProperty({ example: 0, description: 'Reembolsos "en proceso" en Stripe.' })
  pendingRefunds!: number;
}

export class AdminPaymentPlanDto extends PaymentPlanDto {
  @ApiProperty({ type: AdminPayerDto })
  payer!: AdminPayerDto;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  enrollmentId!: string | null;

  @ApiProperty({ enum: EnrollmentStatus, nullable: true })
  enrollmentStatus!: EnrollmentStatus | null;

  @ApiProperty({
    ...OPTIONAL_DATE,
    description: 'Acceso suspendido por mora (automática o manual).',
  })
  accessSuspendedAt!: string | null;

  @ApiProperty(OPTIONAL_DATE)
  delinquentAt!: string | null;

  @ApiProperty(OPTIONAL_DATE)
  cancelledAt!: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  cancelReason!: string | null;

  @ApiProperty({
    enum: PlanAction,
    isArray: true,
    example: ['RETRY', 'SUSPEND_ACCESS', 'CANCEL'],
    description:
      'Acciones habilitadas por estado (los botones requieren además `payments.manage`): ' +
      'RETRY (Cobro fallido/En mora), MARK_DELINQUENT (Cobro fallido), SUSPEND_ACCESS (solo En mora), ' +
      'RESTORE_ACCESS (suspendido), CANCEL.',
  })
  availableActions!: PlanAction[];
}
