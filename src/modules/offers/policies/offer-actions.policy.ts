import type {
  ApplicationStatus,
  EnrollmentStatus,
  OfferOrigin,
  OfferType,
} from '../../../generated/prisma/client';
import { OfferAvailability } from './offer-status.policy';

/**
 * Bloque de acciones (CTA) de la ficha (HU-16). El backend decide QUÉ botones mostrar y si están
 * habilitados; el frontend solo los pinta en el orden recibido (el primero con `primary` es el
 * botón principal).
 */
export const OfferActionType = {
  /** [Inscribirme y pagar] (HU-22) */
  ENROLL_AND_PAY: 'ENROLL_AND_PAY',
  /** [Pagar en cuotas] (HU-24) */
  PAY_IN_INSTALLMENTS: 'PAY_IN_INSTALLMENTS',
  /** [Inscribirme] — oferta NAS gratuita (p. ej. un evento sin costo) */
  ENROLL_FREE: 'ENROLL_FREE',
  /** [Postular a beca] (HU-19) */
  APPLY_SCHOLARSHIP: 'APPLY_SCHOLARSHIP',
  /** [Postular] (HU-20) */
  APPLY_OPEN_CALL: 'APPLY_OPEN_CALL',
  /** [Ya estoy inscrito: activar mi acceso] (HU-25) */
  ACTIVATE_MOODLE_ACCESS: 'ACTIVATE_MOODLE_ACCESS',
  /** [Ir a mi aula] (HU-17) */
  GO_TO_CLASSROOM: 'GO_TO_CLASSROOM',
  /** [Ver mi postulación] (HU-16/21): ya existe una postulación (beca o convocatoria) en esta oferta */
  VIEW_APPLICATION: 'VIEW_APPLICATION',
  /** [Pagar saldo] — "Pendiente de pago" (HU-16/21/23): postulación aprobada con saldo */
  PAY_BALANCE: 'PAY_BALANCE',
  /** [Continuar pago] (Fase 05, HU-22): tiene un checkout de Stripe abierto para esta oferta */
  CONTINUE_PAYMENT: 'CONTINUE_PAYMENT',
  /** "Pago en validación" (Fase 05, HU-23): comprobante de transferencia en revisión (deshabilitado) */
  PAYMENT_IN_VALIDATION: 'PAYMENT_IN_VALIDATION',
  /** [Regularizar pago] (Fase 05, HU-24): acceso suspendido por mora → Mis pagos */
  REGULARIZE_PAYMENT: 'REGULARIZE_PAYMENT',
} as const;
export type OfferActionType = (typeof OfferActionType)[keyof typeof OfferActionType];

/** Motivo de una acción deshabilitada (la UI lo traduce; ver docs/frontend/fase-02-oferta.md). */
export const OfferActionReason = {
  /** Próximamente: "Inscripciones abren el [availableFrom]" */
  ENROLLMENT_NOT_OPEN_YET: 'ENROLLMENT_NOT_OPEN_YET',
  /** "Inscripciones cerradas" (o "Convocatoria cerrada") */
  ENROLLMENT_CLOSED: 'ENROLLMENT_CLOSED',
  /** "Esta oferta finalizó" */
  OFFER_FINISHED: 'OFFER_FINISHED',
  /** "Cupo agotado" */
  SOLD_OUT: 'SOLD_OUT',
  /** "La convocatoria de becas abre el [availableFrom]" */
  SCHOLARSHIP_NOT_OPEN_YET: 'SCHOLARSHIP_NOT_OPEN_YET',
  /** "La convocatoria de becas está cerrada" */
  SCHOLARSHIP_CLOSED: 'SCHOLARSHIP_CLOSED',
  /** La oferta no tiene precio en la moneda del visitante (configuración incompleta) */
  PRICE_NOT_AVAILABLE: 'PRICE_NOT_AVAILABLE',
  /** Fase 05: el equipo valida el comprobante de transferencia ("Pago en validación") */
  TRANSFER_PENDING_VALIDATION: 'TRANSFER_PENDING_VALIDATION',
} as const;
export type OfferActionReason = (typeof OfferActionReason)[keyof typeof OfferActionReason];

export interface OfferAction {
  type: OfferActionType;
  enabled: boolean;
  /** Botón principal (máximo uno por respuesta). */
  primary: boolean;
  /** Sin sesión: el botón lleva a login/registro y regresa a la ficha con la acción (HU-16). */
  requiresLogin: boolean;
  reason: OfferActionReason | null;
  /** Para *_NOT_OPEN_YET: cuándo se habilita. */
  availableFrom: Date | null;
  /** VIEW_APPLICATION / PAY_BALANCE: postulación de la persona (ruta del portal /postulaciones/{id}). */
  applicationId: string | null;
  applicationStatus: ApplicationStatus | null;
}

export type WindowState = 'OPEN' | 'UPCOMING' | 'CLOSED';

export interface OfferActionsInput {
  type: OfferType;
  origin: OfferOrigin;
  isFree: boolean;
  availability: OfferAvailability;
  enrollmentOpensAt: Date | null;
  installmentsEnabled: boolean;
  /** `offersScholarship(offer)` */
  scholarshipOffered: boolean;
  scholarshipWindow: WindowState;
  scholarshipOpensAt: Date | null;
  /** La oferta tiene precio (> 0) en la moneda del visitante. */
  hasPriceInCurrency: boolean;
  soldOut: boolean;
  viewer: {
    authenticated: boolean;
    enrolled: boolean;
    /** Postulación (beca o convocatoria) de la persona en esta oferta (Fase 04). */
    application?: { id: string; status: ApplicationStatus; transferPending?: boolean } | null;
    /** Fase 05: inscripción (aunque no dé acceso) y si tiene un checkout abierto. */
    enrollment?: { status: EnrollmentStatus; checkoutPending: boolean } | null;
  };
}

/**
 * Reglas (HU-16, HU-19, HU-20, HU-22, HU-24, HU-25):
 * - Inscrito → solo [Ir a mi aula].
 * - Moodle → solo [Ya estoy inscrito: activar mi acceso] (sin costo ni compra).
 * - Convocatoria → solo [Postular], según la ventana de postulación.
 * - NAS → [Inscribirme y pagar] (o [Inscribirme] si es gratuita), [Pagar en cuotas] si hay cuotas,
 *   [Postular a beca] si es diplomado con beca. Se deshabilitan con motivo: próximamente, cerradas,
 *   finalizada, cupo agotado.
 * - Con postulación (Fase 04, una por cohorte): [Postular] / [Postular a beca] se reemplazan por
 *   [Ver mi postulación]; si está "Aprobada – pendiente de pago" → [Pagar saldo] (principal) y
 *   [Ver mi postulación], sin [Inscribirme y pagar] (evita pagar el precio completo dos veces).
 * - Fase 05: comprobante en validación → "Pago en validación" (deshabilitado) en lugar de [Pagar
 *   saldo]; checkout abierto → [Continuar pago]; acceso suspendido por mora → [Regularizar pago].
 */
export function computeOfferActions(input: OfferActionsInput): OfferAction[] {
  const requiresLogin = !input.viewer.authenticated;
  const action = (
    type: OfferActionType,
    primary: boolean,
    block: { reason: OfferActionReason; availableFrom?: Date | null } | null,
  ): OfferAction => ({
    type,
    enabled: block === null,
    primary,
    requiresLogin,
    reason: block?.reason ?? null,
    availableFrom: block?.availableFrom ?? null,
    applicationId: null,
    applicationStatus: null,
  });
  const application = input.viewer.application ?? null;
  const applicationAction = (type: OfferActionType, primary: boolean): OfferAction => ({
    ...action(type, primary, null),
    applicationId: application?.id ?? null,
    applicationStatus: application?.status ?? null,
  });

  if (input.viewer.enrolled) return [action('GO_TO_CLASSROOM', true, null)];
  if (input.viewer.enrollment?.status === 'SUSPENDED') {
    return [action('REGULARIZE_PAYMENT', true, null)];
  }
  if (input.origin === 'MOODLE') return [action('ACTIVATE_MOODLE_ACCESS', true, null)];

  if (application?.status === 'APPROVED_PENDING_PAYMENT') {
    if (application.transferPending) {
      return [
        {
          ...applicationAction('PAYMENT_IN_VALIDATION', true),
          enabled: false,
          reason: OfferActionReason.TRANSFER_PENDING_VALIDATION,
        },
        applicationAction('VIEW_APPLICATION', false),
      ];
    }
    return [applicationAction('PAY_BALANCE', true), applicationAction('VIEW_APPLICATION', false)];
  }
  if (input.viewer.enrollment?.checkoutPending && input.type !== 'OPEN_CALL' && !input.isFree) {
    return [action('CONTINUE_PAYMENT', true, null)];
  }
  const enrollmentBlock = enrollmentBlockFor(input);
  if (input.type === 'OPEN_CALL') {
    return [
      application
        ? applicationAction('VIEW_APPLICATION', true)
        : action('APPLY_OPEN_CALL', true, enrollmentBlock),
    ];
  }

  const actions: OfferAction[] = [];
  if (input.isFree) {
    actions.push(action('ENROLL_FREE', true, enrollmentBlock ?? soldOutBlock(input)));
  } else {
    const purchaseBlock =
      enrollmentBlock ??
      soldOutBlock(input) ??
      (input.hasPriceInCurrency ? null : { reason: OfferActionReason.PRICE_NOT_AVAILABLE });
    actions.push(action('ENROLL_AND_PAY', true, purchaseBlock));
    if (input.installmentsEnabled)
      actions.push(action('PAY_IN_INSTALLMENTS', false, purchaseBlock));
  }
  if (input.scholarshipOffered) {
    actions.push(
      application
        ? applicationAction('VIEW_APPLICATION', false)
        : action('APPLY_SCHOLARSHIP', false, scholarshipBlockFor(input)),
    );
  }
  return actions;
}

function enrollmentBlockFor(
  input: OfferActionsInput,
): { reason: OfferActionReason; availableFrom?: Date | null } | null {
  switch (input.availability) {
    case OfferAvailability.FINISHED:
      return { reason: OfferActionReason.OFFER_FINISHED };
    case OfferAvailability.UPCOMING:
      return {
        reason: OfferActionReason.ENROLLMENT_NOT_OPEN_YET,
        availableFrom: input.enrollmentOpensAt,
      };
    case OfferAvailability.ENROLLMENT_CLOSED:
      return { reason: OfferActionReason.ENROLLMENT_CLOSED };
    default:
      return null;
  }
}

function soldOutBlock(input: OfferActionsInput): { reason: OfferActionReason } | null {
  return input.soldOut ? { reason: OfferActionReason.SOLD_OUT } : null;
}

function scholarshipBlockFor(
  input: OfferActionsInput,
): { reason: OfferActionReason; availableFrom?: Date | null } | null {
  if (input.availability === OfferAvailability.FINISHED) {
    return { reason: OfferActionReason.OFFER_FINISHED };
  }
  if (input.scholarshipWindow === 'UPCOMING') {
    return {
      reason: OfferActionReason.SCHOLARSHIP_NOT_OPEN_YET,
      availableFrom: input.scholarshipOpensAt,
    };
  }
  if (input.scholarshipWindow === 'CLOSED') return { reason: OfferActionReason.SCHOLARSHIP_CLOSED };
  return soldOutBlock(input);
}

/** Estado de una ventana [opensAt, closesAt] en `now`. */
export function windowState(opensAt: Date | null, closesAt: Date | null, now: Date): WindowState {
  if (opensAt && opensAt.getTime() > now.getTime()) return 'UPCOMING';
  if (closesAt && closesAt.getTime() <= now.getTime()) return 'CLOSED';
  return 'OPEN';
}
