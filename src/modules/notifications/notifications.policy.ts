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
