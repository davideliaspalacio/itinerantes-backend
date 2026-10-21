import type { Prisma } from '../../../generated/prisma/client';
import { PAYMENT_INCLUDE, PLAN_INCLUDE, toOfferRef, toPlanDto } from '../payment-view';
import { formatPaymentFolio, paymentConceptLabel } from '../policies/payment-amounts.policy';
import type {
  AdminPayerDto,
  AdminPaymentDto,
  AdminPaymentPlanDto,
  AdminRefundDto,
} from './dto/admin-payments.response.dto';
import { availablePlanActions, refundableCents } from './policies/admin-payments.policy';

/** Selección y mapeo a los DTOs del panel de pagos (HU-33). Separados de los del portal. */

export const PAYER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  countryCode: true,
  phoneCountryCode: true,
  phoneNumber: true,
} as const satisfies Prisma.UserSelect;

type PayerRow = Prisma.UserGetPayload<{ select: typeof PAYER_SELECT }>;

export const ADMIN_REFUND_INCLUDE = {
  createdBy: { select: { id: true, fullName: true } },
} as const satisfies Prisma.PaymentRefundInclude;

export const ADMIN_PAYMENT_INCLUDE = {
  ...PAYMENT_INCLUDE,
  user: { select: PAYER_SELECT },
  reviewedBy: { select: { id: true, fullName: true } },
  refunds: { orderBy: { createdAt: 'desc' }, include: ADMIN_REFUND_INCLUDE },
} as const satisfies Prisma.PaymentInclude;

export type AdminPaymentRow = Prisma.PaymentGetPayload<{ include: typeof ADMIN_PAYMENT_INCLUDE }>;

export const ADMIN_PLAN_INCLUDE = {
  ...PLAN_INCLUDE,
  user: { select: PAYER_SELECT },
} as const satisfies Prisma.InstallmentPlanInclude;

export type AdminPlanRow = Prisma.InstallmentPlanGetPayload<{ include: typeof ADMIN_PLAN_INCLUDE }>;

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
const dateOnly = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

export function toPayer(user: PayerRow): AdminPayerDto {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    countryCode: user.countryCode,
    phone: user.phoneNumber ? `${user.phoneCountryCode} ${user.phoneNumber}` : null,
  };
}

export function toAdminPaymentDto(row: AdminPaymentRow): AdminPaymentDto {
  const currency = row.currency;
  const installment =
    row.installment && row.plan
      ? { sequence: row.installment.sequence, count: row.plan.installmentCount }
      : null;
  return {
    id: row.id,
    folio: formatPaymentFolio(row.number),
    concept: row.concept,
    conceptLabel: paymentConceptLabel({
      concept: row.concept,
      applicationKind: row.application?.kind ?? null,
      installment,
    }),
    installment,
    method: row.method,
    status: row.status,
    amount: { amountCents: row.amountCents, currency },
    refunded: { amountCents: row.refundedCents, currency },
    refundable: {
      amountCents:
        row.status === 'PAID' || row.status === 'VALIDATED'
          ? refundableCents({
              amountCents: row.amountCents,
              refundedCents: row.refundedCents,
              refunds: row.refunds,
            })
          : 0,
      currency,
    },
    payer: toPayer(row.user),
    offer: toOfferRef(row.offer),
    applicationId: row.applicationId,
    enrollmentId: row.enrollmentId,
    planId: row.planId,
    card: row.cardLast4 ? { brand: row.cardBrand, last4: row.cardLast4 } : null,
    stripe: {
      paymentIntentId: row.stripePaymentIntentId,
      checkoutSessionId: row.stripeCheckoutSessionId,
      chargeId: row.stripeChargeId,
      receiptUrl: row.stripeReceiptUrl,
    },
    transfer:
      row.method === 'BANK_TRANSFER'
        ? {
            reference: row.transferReference ?? '',
            expectedAmount: { amountCents: row.amountCents, currency },
            declaredAmount:
              row.declaredAmountCents !== null
                ? { amountCents: row.declaredAmountCents, currency }
                : null,
            declaredPaidOn: dateOnly(row.declaredPaidOn),
            trackingKey: row.trackingKey,
            proofFileName: row.proofFileName,
            proofMimeType: row.proofMimeType,
            proofSizeBytes: row.proofSizeBytes,
            submittedAt: iso(row.submittedAt),
            receivedAmount:
              row.receivedAmountCents !== null
                ? { amountCents: row.receivedAmountCents, currency }
                : null,
            receivedOn: dateOnly(row.receivedOn),
            reviewedAt: iso(row.reviewedAt),
            reviewedBy: row.reviewedBy,
            rejectionReason: row.rejectionReason,
            rejectionNote: row.rejectionNote,
          }
        : null,
    failureMessage: row.failureMessage,
    createdAt: row.createdAt.toISOString(),
    paidAt: iso(row.paidAt),
    failedAt: iso(row.failedAt),
    refundedAt: iso(row.refundedAt),
  };
}

export function toAdminRefundDto(
  refund: Prisma.PaymentRefundGetPayload<{ include: typeof ADMIN_REFUND_INCLUDE }>,
  payment: Pick<AdminPaymentRow, 'id' | 'number' | 'user' | 'offer'>,
): AdminRefundDto {
  return {
    id: refund.id,
    paymentId: payment.id,
    paymentFolio: formatPaymentFolio(payment.number),
    amount: { amountCents: refund.amountCents, currency: refund.currency },
    method: refund.method,
    status: refund.status,
    reason: refund.reason,
    stripeRefundId: refund.stripeRefundId,
    failureMessage: refund.failureMessage,
    createdBy: refund.createdBy,
    payer: toPayer(payment.user),
    offer: toOfferRef(payment.offer),
    createdAt: refund.createdAt.toISOString(),
  };
}

export function toAdminPlanDto(plan: AdminPlanRow, now: Date): AdminPaymentPlanDto {
  const enrollmentStatus = plan.enrollment?.status ?? null;
  return {
    ...toPlanDto(plan, now),
    payer: toPayer(plan.user),
    enrollmentId: plan.enrollmentId,
    enrollmentStatus,
    accessSuspendedAt: iso(plan.accessSuspendedAt),
    delinquentAt: iso(plan.delinquentAt),
    cancelledAt: iso(plan.cancelledAt),
    cancelReason: plan.cancelReason,
    availableActions: availablePlanActions({
      status: plan.status,
      hasFailedInstallments: plan.installments.some((i) => i.status === 'FAILED'),
      enrollmentStatus,
    }),
  };
}
