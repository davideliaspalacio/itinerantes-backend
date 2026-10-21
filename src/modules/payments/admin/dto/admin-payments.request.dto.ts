import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination.dto';
import {
  Currency,
  InstallmentPlanStatus,
  PaymentConcept,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
  TransferRejectionReason,
} from '../../../../generated/prisma/client';

/** Acepta `?x=A,B` y `?x=A&x=B` → ['A', 'B']. */
const csvArray = Transform(({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  const items = (Array.isArray(value) ? value : [value]).flatMap((v) => String(v).split(','));
  const clean = items.map((v) => v.trim()).filter(Boolean);
  return clean.length ? clean : undefined;
});

const Q_DESCRIPTION =
  'Busca por folio (`PAG-000123`), nombre o correo de quien paga, o nombre de la oferta.';

export const ADMIN_PAYMENTS_SORT = [
  'CREATED_DESC',
  'CREATED_ASC',
  'PAID_DESC',
  'AMOUNT_DESC',
] as const;
export type AdminPaymentsSort = (typeof ADMIN_PAYMENTS_SORT)[number];

export class ListAdminPaymentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: PaymentStatus,
    isArray: true,
    example: ['PAID', 'VALIDATED'],
    description:
      'Estados (`?status=PAID,FAILED`). Por defecto todos menos `CANCELLED` (checkouts abandonados: ' +
      'no son pagos).',
  })
  @IsOptional()
  @csvArray
  @IsIn(Object.values(PaymentStatus), { each: true })
  status?: PaymentStatus[];

  @ApiPropertyOptional({ enum: PaymentMethod, example: 'CARD' })
  @IsOptional()
  @IsIn(Object.values(PaymentMethod))
  method?: PaymentMethod;

  @ApiPropertyOptional({ enum: PaymentConcept, example: 'INSTALLMENT' })
  @IsOptional()
  @IsIn(Object.values(PaymentConcept))
  concept?: PaymentConcept;

  @ApiPropertyOptional({ enum: Currency, example: 'MXN' })
  @IsOptional()
  @IsIn(Object.values(Currency))
  currency?: Currency;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all')
  offerId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Pagos de una persona.' })
  @IsOptional()
  @IsUUID('all')
  userId?: string;

  @ApiPropertyOptional({ example: 'PAG-000123', description: Q_DESCRIPTION })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({
    example: '2026-11-01T00:00:00.000Z',
    description: 'Creado desde (ISO 8601).',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-11-30T23:59:59.999Z',
    description: 'Creado hasta (ISO 8601).',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: ADMIN_PAYMENTS_SORT, default: 'CREATED_DESC' })
  @IsOptional()
  @IsIn(ADMIN_PAYMENTS_SORT)
  sort?: AdminPaymentsSort;
}

export class AdminPaymentsSummaryQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Solo una oferta.' })
  @IsOptional()
  @IsUUID('all')
  offerId?: string;

  @ApiPropertyOptional({
    example: '2026-11-01T00:00:00.000Z',
    description: 'Cobrado desde (fecha de pago/validación, ISO 8601).',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-11-30T23:59:59.999Z', description: 'Cobrado hasta.' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

const TRANSFER_STATUSES = ['PENDING_VALIDATION', 'VALIDATED', 'REJECTED', 'REFUNDED'] as const;

export class ListAdminTransfersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: TRANSFER_STATUSES,
    default: 'PENDING_VALIDATION',
    description:
      '"Transferencias por conciliar" = `PENDING_VALIDATION` (las más antiguas primero).',
  })
  @IsOptional()
  @IsIn(TRANSFER_STATUSES)
  status?: (typeof TRANSFER_STATUSES)[number];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all')
  offerId?: string;

  @ApiPropertyOptional({ example: 'ana@correo.mx', description: Q_DESCRIPTION })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

export const ADMIN_PLANS_SORT = ['FAILED_SINCE_ASC', 'CREATED_DESC'] as const;

export class ListAdminPlansQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: InstallmentPlanStatus,
    isArray: true,
    example: ['PAST_DUE', 'DELINQUENT'],
    description:
      'Estados (`?status=PAST_DUE,DELINQUENT`). Por defecto todos menos `PENDING_ACTIVATION` ' +
      '(checkout de la 1.ª cuota sin completar).',
  })
  @IsOptional()
  @csvArray
  @IsIn(Object.values(InstallmentPlanStatus), { each: true })
  status?: InstallmentPlanStatus[];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all')
  offerId?: string;

  @ApiPropertyOptional({ example: 'Ana', description: 'Nombre o correo de la persona.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({
    enum: ADMIN_PLANS_SORT,
    default: 'FAILED_SINCE_ASC',
    description: '`FAILED_SINCE_ASC`: los que llevan más días con cobro fallido primero.',
  })
  @IsOptional()
  @IsIn(ADMIN_PLANS_SORT)
  sort?: (typeof ADMIN_PLANS_SORT)[number];
}

export class ListAdminRefundsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: RefundStatus, example: 'PENDING' })
  @IsOptional()
  @IsIn(Object.values(RefundStatus))
  status?: RefundStatus;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsIn(Object.values(PaymentMethod))
  method?: PaymentMethod;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all')
  offerId?: string;
}

export class ValidateTransferRequestDto {
  @ApiProperty({
    example: 510000,
    minimum: 1,
    description:
      'Monto recibido en la cuenta (centavos MXN). Menor al saldo esperado → 422 ' +
      '`PAYMENT_TRANSFER_AMOUNT_MISMATCH` (`meta.differenceCents`): solo se puede rechazar.',
  })
  @IsInt()
  @Min(1)
  receivedAmountCents!: number;

  @ApiProperty({
    example: '2026-11-10',
    description: 'Fecha en que se recibió (YYYY-MM-DD, ≤ hoy).',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Usa el formato AAAA-MM-DD.' })
  receivedOn!: string;
}

export class RejectTransferRequestDto {
  @ApiProperty({
    enum: TransferRejectionReason,
    example: 'AMOUNT_MISMATCH',
    description: 'Ilegible / Monto no coincide / No encontrado / Otro.',
  })
  @IsIn(Object.values(TransferRejectionReason))
  reason!: TransferRejectionReason;

  @ApiPropertyOptional({
    example: 'Recibimos $5,000 de $5,100. Transfiere la diferencia y sube ambos comprobantes.',
    maxLength: 500,
    description: 'Detalle visible para la persona. Obligatorio con `OTHER`.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class PlanActionReasonRequestDto {
  @ApiProperty({
    example: 'Sin respuesta tras 3 contactos; plan en mora desde el 15/11.',
    minLength: 3,
    maxLength: 500,
    description: 'Motivo obligatorio (queda en la auditoría y en la inscripción/plan).',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class RefundRequestDto {
  @ApiProperty({
    example: 255000,
    minimum: 1,
    description:
      'Monto a reembolsar (centavos, en la moneda del pago). ≤ pagado − reembolsado − en proceso.',
  })
  @IsInt()
  @Min(1)
  amountCents!: number;

  @ApiProperty({
    example: 'Baja antes del inicio por motivos de salud (acuerdo con coordinación).',
    minLength: 3,
    maxLength: 500,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
