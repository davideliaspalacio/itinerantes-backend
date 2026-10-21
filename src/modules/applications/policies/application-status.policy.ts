import type {
  ApplicationActorType,
  ApplicationKind,
  ApplicationStatus,
} from '../../../generated/prisma/client';

/**
 * Máquina de estados de la postulación (HU-19, 20, 21; transiciones de revisión de HU-31/32).
 * Reglas PURAS: el servicio (`ApplicationWorkflowService.transition`) las aplica con un update
 * condicionado al estado previo y deja el historial en `ApplicationStatusEvent`.
 *
 * ```
 *  DRAFT ──(participante: enviar)──▶ SUBMITTED ──(equipo: abre el detalle)──▶ IN_REVIEW
 *                                       │  ╲                                    │
 *                                       │   ╲──────(equipo: agenda Zoom)───────▶ INTERVIEW_SCHEDULED
 *                                       ▼                                       │ (cancelada → IN_REVIEW)
 *         (equipo: decisión desde SUBMITTED / IN_REVIEW / INTERVIEW_SCHEDULED)  │
 *            ├──▶ NOT_SELECTED                                                   │
 *            ├──▶ APPROVED_PENDING_PAYMENT ──(sistema/equipo: pago confirmado)──▶ ENROLLED
 *            └──▶ APPROVED_PENDING_CONFIRMATION ──(participante: confirma)─────▶ ENROLLED
 *  APPROVED_* ──(sistema: vence el plazo sin pago/comprobante)──▶ EXPIRED
 *  EXPIRED ──(equipo: "Extender plazo", HU-32)──▶ APPROVED_PENDING_PAYMENT / APPROVED_PENDING_CONFIRMATION
 * ```
 */

/** Textos de HU-21 (también los usan las notificaciones: "el mismo nombre de estado"). */
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: 'Borrador',
  SUBMITTED: 'Enviada',
  IN_REVIEW: 'En revisión',
  INTERVIEW_SCHEDULED: 'Entrevista agendada',
  APPROVED_PENDING_PAYMENT: 'Aprobada – pendiente de pago',
  APPROVED_PENDING_CONFIRMATION: 'Aprobada – confirma tu participación',
  ENROLLED: 'Inscrita',
  NOT_SELECTED: 'No seleccionada',
  EXPIRED: 'Vencida',
};

type ActorType = ApplicationActorType;

const STAFF: readonly ActorType[] = ['STAFF'];
const DECISIONS = {
  APPROVED_PENDING_PAYMENT: STAFF,
  APPROVED_PENDING_CONFIRMATION: STAFF,
  NOT_SELECTED: STAFF,
} as const;

/** Transiciones permitidas y quién puede provocarlas. */
export const APPLICATION_TRANSITIONS: Record<
  ApplicationStatus,
  Partial<Record<ApplicationStatus, readonly ActorType[]>>
> = {
  DRAFT: { SUBMITTED: ['PARTICIPANT'] },
  SUBMITTED: { IN_REVIEW: STAFF, INTERVIEW_SCHEDULED: STAFF, ...DECISIONS },
  IN_REVIEW: { INTERVIEW_SCHEDULED: STAFF, ...DECISIONS },
  // Entrevista cancelada sin reprogramar → vuelve a revisión.
  INTERVIEW_SCHEDULED: { IN_REVIEW: STAFF, ...DECISIONS },
  // Pago confirmado (Stripe: sistema; transferencia validada: equipo) o vencimiento (job).
  APPROVED_PENDING_PAYMENT: { ENROLLED: ['SYSTEM', 'STAFF'], EXPIRED: ['SYSTEM'] },
  // "Confirmar mi participación" (convocatoria sin costo).
  APPROVED_PENDING_CONFIRMATION: { ENROLLED: ['PARTICIPANT', 'STAFF'], EXPIRED: ['SYSTEM'] },
  ENROLLED: {},
  NOT_SELECTED: {},
  // HU-32 "Extender plazo" reactiva una Vencida.
  EXPIRED: { APPROVED_PENDING_PAYMENT: STAFF, APPROVED_PENDING_CONFIRMATION: STAFF },
};

export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
  actor: ActorType,
): boolean {
  return APPLICATION_TRANSITIONS[from][to]?.includes(actor) ?? false;
}

/** Estados en que la persona aún puede editar (solo el borrador; HU-19 "borrador editable"). */
export function isEditable(status: ApplicationStatus): boolean {
  return status === 'DRAFT';
}

/** Estados finales (sin transiciones salientes salvo la extensión de plazo de una Vencida). */
export function isFinal(status: ApplicationStatus): boolean {
  return status === 'ENROLLED' || status === 'NOT_SELECTED';
}

/** Estados aprobados en espera de respuesta (pago o confirmación) con plazo. */
export const AWAITING_RESPONSE_STATUSES = [
  'APPROVED_PENDING_PAYMENT',
  'APPROVED_PENDING_CONFIRMATION',
] as const satisfies readonly ApplicationStatus[];

export function isAwaitingResponse(status: ApplicationStatus): boolean {
  return (AWAITING_RESPONSE_STATUSES as readonly string[]).includes(status);
}

/** Estados en revisión del equipo (bandeja de HU-31). */
export const UNDER_REVIEW_STATUSES = [
  'SUBMITTED',
  'IN_REVIEW',
  'INTERVIEW_SCHEDULED',
] as const satisfies readonly ApplicationStatus[];

/** HU-21: "las que requieren acción (entrevista, pago o confirmación) se destacan arriba". */
export function requiresAction(status: ApplicationStatus): boolean {
  return status === 'INTERVIEW_SCHEDULED' || isAwaitingResponse(status);
}

// -------------------------------------------------------------------------------------------------
// Acción contextual (HU-21: "Continuar", "Pagar saldo", "Confirmar mi participación", "Ir a mi aula")
// -------------------------------------------------------------------------------------------------

export const ApplicationActionType = {
  /** [Continuar] el borrador */
  CONTINUE_DRAFT: 'CONTINUE_DRAFT',
  /** [Entrar a la entrevista] (Zoom, 10 min antes) */
  JOIN_INTERVIEW: 'JOIN_INTERVIEW',
  /** [Pagar saldo] (HU-23, Fase 05) */
  PAY_BALANCE: 'PAY_BALANCE',
  /** [Confirmar mi participación] (sin costo) */
  CONFIRM_PARTICIPATION: 'CONFIRM_PARTICIPATION',
  /** [Ir a mi aula] */
  GO_TO_CLASSROOM: 'GO_TO_CLASSROOM',
  /** [Ver mi postulación] (solo lectura) */
  VIEW: 'VIEW',
} as const;
export type ApplicationActionType =
  (typeof ApplicationActionType)[keyof typeof ApplicationActionType];

export const ApplicationActionReason = {
  /** La convocatoria cerró: el borrador queda en solo lectura. */
  WINDOW_CLOSED: 'WINDOW_CLOSED',
  /** La entrevista aún no abre (se habilita 10 min antes). */
  INTERVIEW_NOT_OPEN_YET: 'INTERVIEW_NOT_OPEN_YET',
  /** Enlace de Zoom aún no capturado. */
  INTERVIEW_LINK_PENDING: 'INTERVIEW_LINK_PENDING',
  /** La entrevista ya terminó (en espera de resultado). */
  INTERVIEW_ENDED: 'INTERVIEW_ENDED',
} as const;
export type ApplicationActionReason =
  (typeof ApplicationActionReason)[keyof typeof ApplicationActionReason];

export interface ApplicationAction {
  type: ApplicationActionType;
  enabled: boolean;
  reason: ApplicationActionReason | null;
  /** Fecha límite / inicio que se muestra con cuenta regresiva (entrevista, pago o confirmación). */
  dueAt: Date | null;
}

export interface ActionInput {
  status: ApplicationStatus;
  /** Ventana de postulación abierta (solo importa en DRAFT). */
  windowOpen: boolean;
  responseDueAt: Date | null;
  interview: { startsAt: Date; joinState: string } | null;
}

export function contextualAction(input: ActionInput): ApplicationAction {
  const action = (
    type: ApplicationActionType,
    dueAt: Date | null = null,
    reason: ApplicationActionReason | null = null,
  ): ApplicationAction => ({ type, enabled: reason === null, reason, dueAt });

  switch (input.status) {
    case 'DRAFT':
      return action(
        'CONTINUE_DRAFT',
        null,
        input.windowOpen ? null : ApplicationActionReason.WINDOW_CLOSED,
      );
    case 'INTERVIEW_SCHEDULED': {
      if (!input.interview) return action('VIEW');
      const reason =
        input.interview.joinState === 'OPEN'
          ? null
          : input.interview.joinState === 'LINK_PENDING'
            ? ApplicationActionReason.INTERVIEW_LINK_PENDING
            : input.interview.joinState === 'ENDED'
              ? ApplicationActionReason.INTERVIEW_ENDED
              : ApplicationActionReason.INTERVIEW_NOT_OPEN_YET;
      return action('JOIN_INTERVIEW', input.interview.startsAt, reason);
    }
    case 'APPROVED_PENDING_PAYMENT':
      return action('PAY_BALANCE', input.responseDueAt);
    case 'APPROVED_PENDING_CONFIRMATION':
      return action('CONFIRM_PARTICIPATION', input.responseDueAt);
    case 'ENROLLED':
      return action('GO_TO_CLASSROOM');
    default:
      return action('VIEW');
  }
}

// -------------------------------------------------------------------------------------------------
// Línea de tiempo (HU-21: Enviada → En revisión → Entrevista (si aplica) → Resultado → Pago o
// confirmación → Inscrita)
// -------------------------------------------------------------------------------------------------

export const TimelineStepKey = {
  SUBMITTED: 'SUBMITTED',
  IN_REVIEW: 'IN_REVIEW',
  INTERVIEW: 'INTERVIEW',
  RESULT: 'RESULT',
  PAYMENT: 'PAYMENT',
  CONFIRMATION: 'CONFIRMATION',
  ENROLLED: 'ENROLLED',
} as const;
export type TimelineStepKey = (typeof TimelineStepKey)[keyof typeof TimelineStepKey];

export const TimelineStepState = {
  /** Completado (con fecha si se conoce). */
  DONE: 'DONE',
  /** Etapa actual (en espera). */
  CURRENT: 'CURRENT',
  UPCOMING: 'UPCOMING',
  /** No ocurrió (p. ej. sin entrevista o no seleccionada). */
  SKIPPED: 'SKIPPED',
  /** Terminó mal: "No seleccionada" (Resultado) o "Vencida" (Pago/Confirmación). */
  FAILED: 'FAILED',
} as const;
export type TimelineStepState = (typeof TimelineStepState)[keyof typeof TimelineStepState];

export const TIMELINE_STEP_LABELS: Record<TimelineStepKey, string> = {
  SUBMITTED: 'Enviada',
  IN_REVIEW: 'En revisión',
  INTERVIEW: 'Entrevista',
  RESULT: 'Resultado',
  PAYMENT: 'Pago del saldo',
  CONFIRMATION: 'Confirmación',
  ENROLLED: 'Inscrita',
};

export interface TimelineStep {
  key: TimelineStepKey;
  state: TimelineStepState;
  at: Date | null;
}

export interface TimelineInput {
  kind: ApplicationKind;
  status: ApplicationStatus;
  /** Historial (cualquier orden). */
  history: ReadonlyArray<{ toStatus: ApplicationStatus; at: Date }>;
  /** Requiere entrevista (convocatoria o beca especial > 70%). */
  interviewRequired: boolean;
  /** La respuesta es un pago (saldo > 0 o la oferta tiene costo) o una confirmación. */
  responseKind: 'PAYMENT' | 'CONFIRMATION';
}

/** Rango de avance por estado: índice del último paso COMPLETADO en la secuencia completa. */
const DONE_THROUGH: Record<ApplicationStatus, TimelineStepKey | null> = {
  DRAFT: null,
  SUBMITTED: 'SUBMITTED',
  IN_REVIEW: 'IN_REVIEW',
  INTERVIEW_SCHEDULED: 'IN_REVIEW',
  APPROVED_PENDING_PAYMENT: 'RESULT',
  APPROVED_PENDING_CONFIRMATION: 'RESULT',
  ENROLLED: 'ENROLLED',
  NOT_SELECTED: 'IN_REVIEW',
  EXPIRED: 'RESULT',
};

export function buildTimeline(input: TimelineInput): TimelineStep[] {
  const latest = (statuses: readonly ApplicationStatus[]): Date | null => {
    const times = input.history
      .filter((e) => statuses.includes(e.toStatus))
      .map((e) => e.at.getTime());
    return times.length ? new Date(Math.max(...times)) : null;
  };
  const hadInterview = input.history.some((e) => e.toStatus === 'INTERVIEW_SCHEDULED');
  const includeInterview =
    input.interviewRequired || hadInterview || input.status === 'INTERVIEW_SCHEDULED';

  const keys: TimelineStepKey[] = [
    'SUBMITTED',
    'IN_REVIEW',
    ...(includeInterview ? (['INTERVIEW'] as const) : []),
    'RESULT',
    input.responseKind,
    'ENROLLED',
  ];
  const atFor: Record<TimelineStepKey, Date | null> = {
    SUBMITTED: latest(['SUBMITTED']),
    IN_REVIEW: latest(['IN_REVIEW']),
    INTERVIEW: latest(['INTERVIEW_SCHEDULED']),
    RESULT: latest(['APPROVED_PENDING_PAYMENT', 'APPROVED_PENDING_CONFIRMATION', 'NOT_SELECTED']),
    PAYMENT: latest(['ENROLLED', 'EXPIRED']),
    CONFIRMATION: latest(['ENROLLED', 'EXPIRED']),
    ENROLLED: latest(['ENROLLED']),
  };

  // Paso hasta el que todo está hecho (la entrevista cuenta como hecha si ocurrió).
  let doneThrough = DONE_THROUGH[input.status];
  if (input.status === 'NOT_SELECTED' && hadInterview) doneThrough = 'INTERVIEW';
  const doneIndex = doneThrough === null ? -1 : indexIn(keys, doneThrough);

  return keys.map((key, index): TimelineStep => {
    const at = atFor[key];
    if (input.status === 'NOT_SELECTED') {
      if (key === 'RESULT') return { key, state: 'FAILED', at };
      if (index > indexIn(keys, 'RESULT')) return { key, state: 'SKIPPED', at: null };
      if (key === 'INTERVIEW' && !hadInterview) return { key, state: 'SKIPPED', at: null };
    }
    if (input.status === 'EXPIRED') {
      if (key === input.responseKind) return { key, state: 'FAILED', at };
      if (key === 'ENROLLED') return { key, state: 'SKIPPED', at: null };
    }
    if (index <= doneIndex) {
      // Pasos que se saltaron en la práctica (p. ej. decisión directa sin "En revisión").
      if (key === 'INTERVIEW' && !hadInterview) return { key, state: 'SKIPPED', at: null };
      return { key, state: 'DONE', at };
    }
    if (input.status !== 'DRAFT' && index === doneIndex + 1) return { key, state: 'CURRENT', at };
    return { key, state: 'UPCOMING', at: null };
  });
}

function indexIn(keys: readonly TimelineStepKey[], key: TimelineStepKey): number {
  const index = keys.indexOf(key);
  // La entrevista puede no estar en la secuencia: su "hecho hasta" equivale a En revisión.
  return index >= 0 ? index : keys.indexOf('IN_REVIEW');
}
