import type { Currency } from '../../common/utils/money';
import type { Prisma } from '../../generated/prisma/client';
import type {
  PaymentDto,
  PaymentOfferRefDto,
  PaymentPlanDto,
  PlanInstallmentDto,
} from './dto/payments.response.dto';
import { daysSinceFailure, delinquencyDueAt } from './policies/installment-collection.policy';
import { formatPaymentFolio, paymentConceptLabel } from './policies/payment-amounts.policy';
import { hasReceipt, isActivePlan } from './policies/payment-status.policy';

/** Selección y mapeo a DTO de pagos y planes (compartido por consultas, checkout y transferencias). */

export const OFFER_REF_SELECT = {
  id: true,
  slug: true,
  name: true,
  type: true,
  cohortLabel: true,
  startsAt: true,
  endsAt: true,
} as const satisfies Prisma.OfferSelect;

export const PAYMENT_INCLUDE = {
  offer: { select: OFFER_REF_SELECT },
  installment: { select: { sequence: true } },
  plan: { select: { installmentCount: true } },
  application: { select: { kind: true } },
} as const satisfies Prisma.PaymentInclude;

export type PaymentRow = Prisma.PaymentGetPayload<{ include: typeof PAYMENT_INCLUDE }>;

export const PLAN_INCLUDE = {
  offer: { select: OFFER_REF_SELECT },
  installments: { orderBy: { sequence: 'asc' } },
  enrollment: { select: { status: true } },
} as const satisfies Prisma.InstallmentPlanInclude;

export type PlanRow = Prisma.InstallmentPlanGetPayload<{ include: typeof PLAN_INCLUDE }>;

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
const dateOnly = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

export function toOfferRef(offer: PaymentRow['offer']): PaymentOfferRefDto {
  return {
    id: offer.id,
    slug: offer.slug,
    name: offer.name,
    type: offer.type,
    cohortLabel: offer.cohortLabel,
    startsAt: iso(offer.startsAt),
    endsAt: iso(offer.endsAt),
  };
}

export function toPaymentDto(row: PaymentRow, now: Date): PaymentDto {
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
    refunded: row.refundedCents > 0 ? { amountCents: row.refundedCents, currency } : null,
    offer: toOfferRef(row.offer),
    applicationId: row.applicationId,
    planId: row.planId,
    card: row.cardLast4 ? { brand: row.cardBrand, last4: row.cardLast4 } : null,
    transfer:
      row.method === 'BANK_TRANSFER'
        ? {
            reference: row.transferReference ?? '',
            declaredAmount:
              row.declaredAmountCents !== null
                ? { amountCents: row.declaredAmountCents, currency }
                : null,
            paidOn: dateOnly(row.declaredPaidOn),
            trackingKey: row.trackingKey,
            proofFileName: row.proofFileName,
            submittedAt: iso(row.submittedAt),
            reviewedAt: iso(row.reviewedAt),
            rejectionReason: row.rejectionReason,
            rejectionNote: row.rejectionNote,
          }
        : null,
    receiptAvailable: hasReceipt(row.status),
    stripeReceiptUrl: row.stripeReceiptUrl,
    failureMessage: row.failureMessage,
    checkout:
      row.status === 'PENDING' &&
      row.checkoutUrl &&
      row.checkoutExpiresAt &&
      row.checkoutExpiresAt > now
        ? { url: row.checkoutUrl, expiresAt: row.checkoutExpiresAt.toISOString() }
        : null,
    createdAt: row.createdAt.toISOString(),
    paidAt: iso(row.paidAt),
    failedAt: iso(row.failedAt),
  };
}

function toInstallmentDto(
  i: PlanRow['installments'][number],
  currency: Currency,
): PlanInstallmentDto {
  return {
    id: i.id,
    sequence: i.sequence,
    amount: { amountCents: i.amountCents, currency },
    dueAt: i.dueAt.toISOString(),
    status: i.status,
    paidAt: iso(i.paidAt),
    attempts: i.attempts,
    nextRetryAt: iso(i.nextRetryAt),
    failureMessage: i.failureMessage,
  };
}

export function toPlanDto(plan: PlanRow, now: Date): PaymentPlanDto {
  const currency = plan.currency;
  const paid = plan.installments.filter((i) => i.status === 'PAID');
  const open = plan.installments.filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED');
  const paidCents = paid.reduce((sum, i) => sum + i.amountCents, 0);
  const pendingCents = open.reduce((sum, i) => sum + i.amountCents, 0);
  const next =
    open.find((i) => i.status === 'FAILED') ?? open.find((i) => i.status !== 'FAILED') ?? null;
  const active = isActivePlan(plan.status);
  return {
    id: plan.id,
    status: plan.status,
    concept: plan.concept,
    offer: toOfferRef(plan.offer),
    total: { amountCents: plan.totalCents, currency },
    installmentCount: plan.installmentCount,
    paidCount: paid.length,
    paidAmount: { amountCents: paidCents, currency },
    pendingAmount: { amountCents: pendingCents, currency },
    nextCharge: next ? toInstallmentDto(next, currency) : null,
    card: plan.cardLast4 ? { brand: plan.cardBrand, last4: plan.cardLast4 } : null,
    failedSince: iso(plan.failedSince),
    delinquencyAt: plan.failedSince
      ? (plan.delinquentAt ?? delinquencyDueAt(plan.failedSince)).toISOString()
      : null,
    daysSinceFailure: daysSinceFailure(plan.failedSince, now),
    accessSuspended: plan.enrollment?.status === 'SUSPENDED',
    canPayNow: active && plan.installments.some((i) => i.status === 'FAILED'),
    canUpdateCard: active,
    installments: plan.installments.map((i) => toInstallmentDto(i, currency)),
    activatedAt: iso(plan.activatedAt),
  };
}
