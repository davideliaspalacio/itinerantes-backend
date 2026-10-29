import type { EmailLayoutOptions } from '../../infra/mail/templates/base.template';
import type {
  NotificationCategory,
  NotificationPriority,
  NotificationType,
} from '../../generated/prisma/client';

/**
 * Reglas puras de notificaciones (HU-13).
 */

/** Grupo (ícono) de cada tipo: Formación, Postulaciones y becas, Pagos, General. */
export const NOTIFICATION_CATEGORY_BY_TYPE: Record<NotificationType, NotificationCategory> = {
  ENROLLMENT_CONFIRMED: 'TRAINING',
  ATTENDANCE_OPEN: 'TRAINING',
  WHATSAPP_GROUP_AVAILABLE: 'TRAINING',
  MATERIAL_PUBLISHED: 'TRAINING',
  RECORDING_PUBLISHED: 'TRAINING',
  SESSION_SCHEDULED: 'TRAINING',
  SESSION_RESCHEDULED: 'TRAINING',
  SESSION_CANCELLED: 'TRAINING',
  MOODLE_ENROLLMENT_LINKED: 'TRAINING',
  APPLICATION_SUBMITTED: 'APPLICATIONS',
  APPLICATION_STATUS_CHANGED: 'APPLICATIONS',
  INTERVIEW_SCHEDULED: 'APPLICATIONS',
  INTERVIEW_REMINDER: 'APPLICATIONS',
  SCHOLARSHIP_APPROVED: 'APPLICATIONS',
  APPLICATION_EXPIRED: 'APPLICATIONS',
  PAYMENT_CONFIRMED: 'PAYMENTS',
  BALANCE_DUE_REMINDER: 'PAYMENTS',
  INSTALLMENT_UPCOMING: 'PAYMENTS',
  INSTALLMENT_PAID: 'PAYMENTS',
  INSTALLMENT_FAILED: 'PAYMENTS',
  PLAN_DELINQUENT: 'PAYMENTS',
  TRANSFER_VALIDATED: 'PAYMENTS',
  TRANSFER_REJECTED: 'PAYMENTS',
  GENERAL: 'GENERAL',
};

/** Etiqueta sobre el título del correo según el grupo de la notificación. */
export const EMAIL_EYEBROW_BY_CATEGORY: Record<NotificationCategory, string> = {
  TRAINING: 'Tu formación',
  APPLICATIONS: 'Postulaciones y becas',
  PAYMENTS: 'Pagos',
  GENERAL: 'Aviso',
};

/** Cobro fallido y mora: prioridad alta, fijadas al inicio hasta regularizar (HU-13 / HU-24). */
const HIGH_PRIORITY_TYPES: ReadonlySet<NotificationType> = new Set([
  'INSTALLMENT_FAILED',
  'PLAN_DELINQUENT',
]);

export function defaultPriority(type: NotificationType): NotificationPriority {
  return HIGH_PRIORITY_TYPES.has(type) ? 'HIGH' : 'NORMAL';
}

/** Una notificación de prioridad alta nace fijada; `resolve()` la desfija al regularizarse. */
export function isPinnedOnCreate(priority: NotificationPriority): boolean {
  return priority === 'HIGH';
}

/**
 * Todos los eventos van al portal y por correo (HU-13), salvo los que el emisor marque como solo
 * portal (p. ej. la postulación pasa a "En revisión": `email: false`).
 */
export function shouldEmail(email: boolean | object | undefined): boolean {
  return email !== false;
}

/** Une la URL del frontend con la ruta relativa de la acción (sin dobles barras). */
export function frontendLink(frontendUrl: string, path: string): string {
  return `${frontendUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/** Correo de una notificación (lo usan `NotificationsService` y las vistas previas). */
export function buildNotificationEmail(input: {
  fullName: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  frontendUrl: string;
  action?: { label: string; path: string };
  custom?: {
    subject?: string;
    paragraphs?: string[];
    details?: { label: string; value: string }[];
  };
}): { subject: string; layout: EmailLayoutOptions } {
  const firstName = input.fullName.split(' ')[0] ?? input.fullName;
  return {
    subject: input.custom?.subject ?? input.title,
    layout: {
      title: input.title,
      eyebrow: EMAIL_EYEBROW_BY_CATEGORY[NOTIFICATION_CATEGORY_BY_TYPE[input.type]],
      tone: input.priority === 'HIGH' ? 'alert' : 'default',
      preheader: input.body.slice(0, 120),
      paragraphs: [`Hola, ${firstName}:`, ...(input.custom?.paragraphs ?? [input.body])],
      details: input.custom?.details,
      action: input.action
        ? { label: input.action.label, url: frontendLink(input.frontendUrl, input.action.path) }
        : undefined,
      footerNote:
        'Recibes este correo porque tienes una cuenta en el portal de la Escuela Itinerante del ' +
        'Agua. También puedes ver este aviso en la campana de notificaciones del portal.',
    },
  };
}
