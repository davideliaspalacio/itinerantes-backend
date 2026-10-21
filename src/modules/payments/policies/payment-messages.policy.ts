import { formatMoney, type Money } from '../../../common/utils/money';
import { formatInZone, OFFICIAL_TIMEZONE } from '../../../common/utils/time';
import type { NotificationType } from '../../../generated/prisma/client';
import { PORTAL_LINKS } from '../../notifications/portal-links';
import { BUSINESS_RULES } from '../../../config/business-rules';
import { TRANSFER_REJECTION_LABELS } from './transfer.policy';

/**
 * Textos de las notificaciones de pagos (HU-13 / HU-22 / HU-23 / HU-24). Reglas PURAS: el servicio
 * agrega destinatario, `data` y `dedupeKey`.
 */

export interface PaymentMessage {
  type: NotificationType;
  title: string;
  body: string;
  action: { label: string; path: string };
}

const date = (d: Date, zone: string) => `${formatInZone(d, zone, 'd/MM/yyyy')}`;
const card = (brand: string | null, last4: string | null) =>
  last4 ? `${brand ? `${brand.toUpperCase()} ` : ''}terminación ${last4}` : 'tu tarjeta registrada';

/** HU-22 / HU-23 / HU-24 (1.ª cuota): pago confirmado + comprobante. */
export function paymentConfirmedMessage(input: {
  offerId: string;
  offerName: string;
  folio: string;
  concept: string;
  amount: Money;
  enrolled: boolean;
}): PaymentMessage {
  return {
    type: 'PAYMENT_CONFIRMED',
    title: `Pago confirmado: ${input.offerName}`,
    body:
      `Recibimos tu pago de ${formatMoney(input.amount)} (${input.concept}, folio ${input.folio}).` +
      (input.enrolled ? ' Tu inscripción está activa.' : '') +
      ' Descarga tu comprobante en Mis pagos (es un recibo de pago, no una factura fiscal).',
    action: input.enrolled
      ? { label: 'Ir a mi aula', path: PORTAL_LINKS.classroom(input.offerId) }
      : { label: 'Ver mis pagos', path: PORTAL_LINKS.myPayments() },
  };
}

export function installmentPaidMessage(input: {
  offerName: string;
  folio: string;
  sequence: number;
  count: number;
  amount: Money;
}): PaymentMessage {
  return {
    type: 'INSTALLMENT_PAID',
    title: `Cuota ${input.sequence} de ${input.count} pagada`,
    body:
      `Cobramos la cuota ${input.sequence} de ${input.count} de ${input.offerName}: ` +
      `${formatMoney(input.amount)} (folio ${input.folio}).`,
    action: { label: 'Ver mis pagos', path: PORTAL_LINKS.myPayments() },
  };
}

/** HU-06 / HU-13 / HU-24: aviso N días antes del cobro automático. */
export function installmentUpcomingMessage(input: {
  offerName: string;
  sequence: number;
  count: number;
  amount: Money;
  dueAt: Date;
  cardBrand: string | null;
  cardLast4: string | null;
  timezone: string;
}): PaymentMessage {
  return {
    type: 'INSTALLMENT_UPCOMING',
    title: `Próximo cobro: cuota ${input.sequence} de ${input.count}`,
    body:
      `El ${date(input.dueAt, input.timezone)} cobraremos ${formatMoney(input.amount)} de ` +
      `${input.offerName} a ${card(input.cardBrand, input.cardLast4)}.`,
    action: { label: 'Ver mis pagos', path: PORTAL_LINKS.myPayments() },
  };
}

/** HU-24: cobro fallido (prioridad alta, fijada hasta regularizar). */
export function installmentFailedMessage(input: {
  offerName: string;
  sequence: number;
  count: number;
  amount: Money;
  nextRetryAt: Date | null;
  failureMessage: string | null;
  timezone: string;
}): PaymentMessage {
  const retry = input.nextRetryAt
    ? ` Reintentaremos el ${date(input.nextRetryAt, input.timezone)}.`
    : ' Se agotaron los reintentos automáticos.';
  return {
    type: 'INSTALLMENT_FAILED',
    title: `No pudimos cobrar tu cuota ${input.sequence} de ${input.count}`,
    body:
      `El cobro de ${formatMoney(input.amount)} de ${input.offerName} fue rechazado` +
      `${input.failureMessage ? ` (${input.failureMessage})` : ''}.${retry} Actualiza tu tarjeta o ` +
      `paga ahora para evitar que el plan pase a "En mora" a los ` +
      `${BUSINESS_RULES.DELINQUENCY_AFTER_DAYS} días.`,
    action: { label: 'Actualizar tarjeta', path: PORTAL_LINKS.myPayments() },
  };
}

/** HU-24: plan "En mora" (prioridad alta). */
export function planDelinquentMessage(input: {
  offerName: string;
  pending: Money;
  accessSuspended: boolean;
}): PaymentMessage {
  return {
    type: 'PLAN_DELINQUENT',
    title: `Tu plan de pagos está en mora: ${input.offerName}`,
    body:
      `Tienes ${formatMoney(input.pending)} pendiente desde hace ` +
      `${BUSINESS_RULES.DELINQUENCY_AFTER_DAYS} días.` +
      (input.accessSuspended
        ? ' Tu acceso a la formación quedó suspendido hasta que regularices el pago.'
        : ' Regulariza tu pago para conservar tu acceso.'),
    action: { label: 'Pagar ahora', path: PORTAL_LINKS.myPayments() },
  };
}

export function transferValidatedMessage(input: {
  offerId: string;
  offerName: string;
  folio: string;
  amount: Money;
}): PaymentMessage {
  return {
    type: 'TRANSFER_VALIDATED',
    title: 'Transferencia validada',
    body:
      `Validamos tu transferencia de ${formatMoney(input.amount)} (folio ${input.folio}). ` +
      `Ya estás inscrito en ${input.offerName}.`,
    action: { label: 'Ir a mi aula', path: PORTAL_LINKS.classroom(input.offerId) },
  };
}

export function transferRejectedMessage(input: {
  applicationId: string;
  offerName: string;
  reason: keyof typeof TRANSFER_REJECTION_LABELS;
  note: string | null;
  dueAt: Date | null;
}): PaymentMessage {
  return {
    type: 'TRANSFER_REJECTED',
    title: 'Tu comprobante de transferencia fue rechazado',
    body:
      `Motivo: ${TRANSFER_REJECTION_LABELS[input.reason]}${input.note ? ` — ${input.note}` : ''}. ` +
      `Puedes subir un comprobante nuevo para ${input.offerName}` +
      (input.dueAt
        ? ` antes del ${formatInZone(input.dueAt, OFFICIAL_TIMEZONE, 'd/MM/yyyy HH:mm')} (hora CDMX).`
        : '.'),
    action: { label: 'Subir comprobante', path: PORTAL_LINKS.payBalance(input.applicationId) },
  };
}
