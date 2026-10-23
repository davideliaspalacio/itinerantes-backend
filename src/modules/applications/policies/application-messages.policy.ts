import { formatMoney, type Money } from '../../../common/utils/money';
import { formatInZone, OFFICIAL_TIMEZONE } from '../../../common/utils/time';
import { BUSINESS_RULES } from '../../../config/business-rules';
import type { ApplicationKind, ApplicationStatus } from '../../../generated/prisma/client';
import type { NotifyInput } from '../../notifications/notifications.service';
import { PORTAL_LINKS } from '../../notifications/portal-links';
import { APPLICATION_STATUS_LABELS } from './application-status.policy';

/**
 * Textos de las notificaciones de postulaciones (HU-13 / HU-21): usan el MISMO nombre de estado que
 * "Mis postulaciones". Puro: el servicio agrega destinatario y `dedupeKey`.
 */
export interface ApplicationMessageContext {
  applicationId: string;
  kind: ApplicationKind;
  folio: string;
  offer: { id: string; name: string };
  /** Zona del perfil, para "tu hora" junto a la hora CDMX (HU-11). */
  userTimezone: string;
  /** Tipo de beca solicitado (para avisar de la entrevista al enviar). */
  requestedScholarshipType?: { name: string; requiresInterview: boolean } | null;
  /** Nombre del tipo asignado guardado al aprobar. */
  assignedScholarshipTypeName?: string | null;
  assignedPercent?: number | null;
  balance?: Money | null;
  responseDueAt?: Date | null;
  interview?: { startsAt: Date } | null;
}

export type ApplicationMessage = Omit<NotifyInput, 'userIds' | 'dedupeKey'>;

const DATE_TIME = "d/MM/yyyy 'a las' HH:mm";

/** "12/11/2026 a las 11:00 (tu hora) · 10:00 hora CDMX". */
export function dualTime(date: Date, userTimezone: string): string {
  const cdmx = formatInZone(date, OFFICIAL_TIMEZONE, 'HH:mm');
  if (userTimezone === OFFICIAL_TIMEZONE) {
    return `${formatInZone(date, OFFICIAL_TIMEZONE, DATE_TIME)} hora CDMX`;
  }
  return `${formatInZone(date, userTimezone, DATE_TIME)} (tu hora) · ${cdmx} hora CDMX`;
}

function deadline(date: Date | null | undefined, userTimezone: string): string {
  return date ? dualTime(date, userTimezone) : 'la fecha indicada en tu postulación';
}

/** Mensaje del cambio a `to` (null = no se notifica, p. ej. DRAFT). */
export function statusChangeMessage(
  to: ApplicationStatus,
  ctx: ApplicationMessageContext,
): ApplicationMessage | null {
  const label = APPLICATION_STATUS_LABELS[to];
  const view = { label: 'Ver mi postulación', path: PORTAL_LINKS.application(ctx.applicationId) };
  const data = {
    applicationId: ctx.applicationId,
    offerId: ctx.offer.id,
    status: to,
    folio: ctx.folio,
  };
  const name = ctx.offer.name;

  switch (to) {
    case 'SUBMITTED': {
      const next =
        ctx.kind === 'OPEN_CALL'
          ? 'El proceso incluye una entrevista por Zoom: te avisaremos cuando la agendemos.'
          : ctx.requestedScholarshipType?.requiresInterview
            ? `Solicitaste ${ctx.requestedScholarshipType.name}: el proceso incluye una entrevista por Zoom.`
            : 'El equipo la revisará y te avisaremos de cada cambio.';
      return {
        type: 'APPLICATION_SUBMITTED',
        title: `Postulación enviada: ${name}`,
        body: `Recibimos tu postulación con folio ${ctx.folio}. Estado: ${label}. ${next}`,
        action: view,
        data,
      };
    }
    case 'IN_REVIEW':
      return {
        type: 'APPLICATION_STATUS_CHANGED',
        title: `Tu postulación está ${label}`,
        body: `${name} (folio ${ctx.folio}): el equipo está revisando tu postulación.`,
        action: view,
        data,
        // HU-13: "En revisión" solo en el portal.
        email: false,
      };
    case 'INTERVIEW_SCHEDULED':
      return interviewScheduledMessage(ctx);
    case 'APPROVED_PENDING_PAYMENT': {
      const amount = ctx.balance ? formatMoney(ctx.balance) : 'el saldo';
      const due = deadline(ctx.responseDueAt, ctx.userTimezone);
      const pay = { label: 'Pagar saldo', path: PORTAL_LINKS.payBalance(ctx.applicationId) };
      if (ctx.kind === 'SCHOLARSHIP' && ctx.assignedScholarshipTypeName) {
        return {
          type: 'SCHOLARSHIP_APPROVED',
          title: `Tu beca fue aprobada: ${name}`,
          body:
            `Estado: ${label}. Beca asignada: ${ctx.assignedScholarshipTypeName} ` +
            `(${ctx.assignedPercent ?? '—'}%). ` +
            `Saldo a pagar: ${amount}. Fecha límite: ${due}. Paga con tarjeta o, si vives en México, ` +
            'por transferencia.',
          action: pay,
          data,
        };
      }
      return {
        type: 'APPLICATION_STATUS_CHANGED',
        title: `Tu postulación fue aprobada: ${name}`,
        body: `Estado: ${label}. Monto a pagar: ${amount}. Fecha límite: ${due}.`,
        action: pay,
        data,
      };
    }
    case 'APPROVED_PENDING_CONFIRMATION':
      return {
        type: 'APPLICATION_STATUS_CHANGED',
        title: `Tu postulación fue aprobada: ${name}`,
        body:
          `Estado: ${label}. Confirma tu participación antes del ` +
          `${deadline(ctx.responseDueAt, ctx.userTimezone)}.`,
        action: { label: 'Confirmar mi participación', path: view.path },
        data,
      };
    case 'ENROLLED':
      return {
        type: 'APPLICATION_STATUS_CHANGED',
        title: `${label}: ${name}`,
        body: `Tu postulación quedó ${label}. Ya puedes entrar a tu aula.`,
        action: { label: 'Ir a mi aula', path: PORTAL_LINKS.classroom(ctx.offer.id) },
        data,
      };
    case 'NOT_SELECTED':
      return {
        type: 'APPLICATION_STATUS_CHANGED',
        title: `Resultado de tu postulación: ${name}`,
        body:
          `Estado: ${label}. Gracias por postularte; te avisaremos de nuevas becas y ` +
          'convocatorias.',
        action: view,
        data,
      };
    case 'EXPIRED':
      return {
        type: 'APPLICATION_EXPIRED',
        title: `Tu postulación venció: ${name}`,
        body:
          `El plazo para ${ctx.balance && ctx.balance.amountCents > 0 ? 'pagar el saldo' : 'confirmar tu participación'} ` +
          `venció. Estado: ${label}. Si necesitas ayuda, contacta al equipo de la Escuela.`,
        action: view,
        data,
      };
    default:
      return null;
  }
}

/** Entrevista agendada o reprogramada (HU-13: "entrevista Zoom con hora local y CDMX"). */
export function interviewScheduledMessage(ctx: ApplicationMessageContext): ApplicationMessage {
  const when = ctx.interview ? dualTime(ctx.interview.startsAt, ctx.userTimezone) : 'pronto';
  return {
    type: 'INTERVIEW_SCHEDULED',
    title: `Entrevista agendada: ${ctx.offer.name}`,
    body:
      `Estado: ${APPLICATION_STATUS_LABELS.INTERVIEW_SCHEDULED}. Tu entrevista por Zoom es el ` +
      `${when}. El enlace se habilita ${BUSINESS_RULES.INTERVIEW_JOIN_WINDOW_MINUTES_BEFORE} minutos ` +
      'antes en tu postulación.',
    action: { label: 'Ver mi entrevista', path: PORTAL_LINKS.application(ctx.applicationId) },
    data: {
      applicationId: ctx.applicationId,
      offerId: ctx.offer.id,
      status: 'INTERVIEW_SCHEDULED',
      folio: ctx.folio,
      interviewStartsAt: ctx.interview?.startsAt.toISOString() ?? null,
    },
  };
}

/** Recordatorio 24 h antes de la entrevista (HU-13). */
export function interviewReminderMessage(ctx: ApplicationMessageContext): ApplicationMessage {
  const base = interviewScheduledMessage(ctx);
  return {
    ...base,
    type: 'INTERVIEW_REMINDER',
    title: `Recordatorio: entrevista por Zoom (${ctx.offer.name})`,
    body:
      `Tu entrevista es el ${ctx.interview ? dualTime(ctx.interview.startsAt, ctx.userTimezone) : 'próximamente'}. ` +
      `El enlace se habilita ${BUSINESS_RULES.INTERVIEW_JOIN_WINDOW_MINUTES_BEFORE} minutos antes.`,
  };
}

/** Recordatorio de saldo antes de vencer el plazo (Anexo A HU-13: 48 h). */
export function balanceReminderMessage(ctx: ApplicationMessageContext): ApplicationMessage {
  const amount = ctx.balance ? formatMoney(ctx.balance) : 'tu saldo';
  return {
    type: 'BALANCE_DUE_REMINDER',
    title: `Tu plazo de pago vence pronto: ${ctx.offer.name}`,
    body:
      `Paga ${amount} antes del ${deadline(ctx.responseDueAt, ctx.userTimezone)} para conservar tu ` +
      'lugar. Si ya subiste tu comprobante de transferencia, no necesitas hacer nada.',
    action: { label: 'Pagar saldo', path: PORTAL_LINKS.payBalance(ctx.applicationId) },
    data: {
      applicationId: ctx.applicationId,
      offerId: ctx.offer.id,
      folio: ctx.folio,
      dueAt: ctx.responseDueAt?.toISOString() ?? null,
    },
  };
}
