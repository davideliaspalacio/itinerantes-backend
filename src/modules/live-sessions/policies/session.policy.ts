import type {
  AttendanceSource,
  OfferModality,
  SessionStatus,
} from '../../../generated/prisma/client';
import { BUSINESS_RULES } from '../../../config/business-rules';

/**
 * Reglas puras de una sesión en vivo para el participante (HU-10, HU-12, HU-17, HU-18).
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

// -------------------------------------------------------------------------------------------------
// Acceso a la sesión: [Entrar a sesión] (HU-12)
// -------------------------------------------------------------------------------------------------

/**
 * | Valor          | UI                                                            |
 * |----------------|---------------------------------------------------------------|
 * | NOT_YET        | Deshabilitado: "Disponible 10 min antes" / cuenta regresiva   |
 * | OPEN           | [Entrar a sesión] habilitado → `url` (join_url)               |
 * | LINK_PENDING   | "Enlace aún no disponible"                                    |
 * | ENDED          | Sesión terminada (sin acceso)                                 |
 * | CANCELLED      | "Cancelada"                                                   |
 * | IN_PERSON      | Presencial: sin enlace (lugar y "Cómo llegar")                |
 */
export const JoinState = {
  NOT_YET: 'NOT_YET',
  OPEN: 'OPEN',
  LINK_PENDING: 'LINK_PENDING',
  ENDED: 'ENDED',
  CANCELLED: 'CANCELLED',
  IN_PERSON: 'IN_PERSON',
} as const;
export type JoinState = (typeof JoinState)[keyof typeof JoinState];

export interface JoinInput {
  status: SessionStatus;
  modality: OfferModality;
  startsAt: Date;
  endsAt: Date;
  /** join_url de participante. El host_url NUNCA entra aquí. */
  joinUrl: string | null;
}

export interface JoinInfo {
  state: JoinState;
  /** Desde cuándo se habilita el botón (inicio − N minutos). */
  opensAt: Date;
  /** Solo con state = OPEN. */
  url: string | null;
}

export function joinInfo(
  session: JoinInput,
  now: Date,
  minutesBefore: number = BUSINESS_RULES.SESSION_JOIN_WINDOW_MINUTES_BEFORE,
): JoinInfo {
  const opensAt = new Date(session.startsAt.getTime() - minutesBefore * MINUTE);
  const result = (state: JoinState, url: string | null = null): JoinInfo => ({
    state,
    opensAt,
    url,
  });
  if (session.status === 'CANCELLED') return result(JoinState.CANCELLED);
  if (session.modality === 'IN_PERSON') return result(JoinState.IN_PERSON);
  if (session.endsAt.getTime() <= now.getTime()) return result(JoinState.ENDED);
  if (!session.joinUrl) return result(JoinState.LINK_PENDING);
  if (now.getTime() < opensAt.getTime()) return result(JoinState.NOT_YET);
  return result(JoinState.OPEN, session.joinUrl);
}

/** Plataforma para el ícono de la tarjeta (HU-12), deducida del join_url. */
export type SessionPlatform = 'ZOOM' | 'GOOGLE_MEET' | 'OTHER';

export function sessionPlatform(joinUrl: string | null): SessionPlatform | null {
  if (!joinUrl) return null;
  let host: string;
  try {
    host = new URL(joinUrl).hostname.toLowerCase();
  } catch {
    return 'OTHER';
  }
  if (host === 'zoom.us' || host.endsWith('.zoom.us')) return 'ZOOM';
  if (host === 'meet.google.com') return 'GOOGLE_MEET';
  return 'OTHER';
}

// -------------------------------------------------------------------------------------------------
// Grabación (HU-08 / HU-12 / HU-28)
// -------------------------------------------------------------------------------------------------

/**
 * | Valor           | UI                                   |
 * |-----------------|--------------------------------------|
 * | AVAILABLE       | [Ver grabación] (pestaña nueva)      |
 * | AFTER_SESSION   | "Disponible después de la sesión"    |
 * | PENDING         | "Grabación pendiente"                |
 * | NOT_APPLICABLE  | Sin grabación (cancelada/presencial) |
 */
export const RecordingState = {
  AVAILABLE: 'AVAILABLE',
  AFTER_SESSION: 'AFTER_SESSION',
  PENDING: 'PENDING',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
} as const;
export type RecordingState = (typeof RecordingState)[keyof typeof RecordingState];

export function recordingInfo(
  session: Pick<JoinInput, 'status' | 'modality' | 'endsAt'> & { recordingUrl: string | null },
  now: Date,
): { state: RecordingState; url: string | null } {
  if (session.status === 'CANCELLED') return { state: RecordingState.NOT_APPLICABLE, url: null };
  if (session.recordingUrl) return { state: RecordingState.AVAILABLE, url: session.recordingUrl };
  if (session.modality === 'IN_PERSON') return { state: RecordingState.NOT_APPLICABLE, url: null };
  if (session.endsAt.getTime() > now.getTime()) {
    return { state: RecordingState.AFTER_SESSION, url: null };
  }
  return { state: RecordingState.PENDING, url: null };
}

// -------------------------------------------------------------------------------------------------
// Asistencia (HU-18 / HU-30)
// -------------------------------------------------------------------------------------------------

/** Ventana efectiva: la de la sesión si tiene override; si no, la de la oferta (HU-27/HU-30). */
export function effectiveAttendanceWindowHours(
  sessionHours: number | null | undefined,
  offerHours: number | null | undefined,
): number {
  return sessionHours ?? offerHours ?? BUSINESS_RULES.ATTENDANCE_WINDOW_HOURS;
}

export const AttendanceWindowState = {
  /** La sesión no ha terminado: "El registro se abre al terminar la sesión". */
  NOT_OPEN_YET: 'NOT_OPEN_YET',
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  /** Sesión cancelada: sin registro (HU-30). */
  NOT_APPLICABLE: 'NOT_APPLICABLE',
} as const;
export type AttendanceWindowState =
  (typeof AttendanceWindowState)[keyof typeof AttendanceWindowState];

/** Estado de asistencia de la persona (HU-12/17/18): Pendiente / Registrada / No registrada. */
export const AttendanceStatus = {
  PENDING: 'PENDING',
  REGISTERED: 'REGISTERED',
  NOT_REGISTERED: 'NOT_REGISTERED',
  /** Sesión cancelada: no cuenta. */
  NOT_APPLICABLE: 'NOT_APPLICABLE',
} as const;
export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

export interface AttendanceInput {
  status: SessionStatus;
  endsAt: Date;
  windowHours: number;
  record: { registeredAt: Date; source: AttendanceSource; comment: string | null } | null;
}

export interface AttendanceInfo {
  status: AttendanceStatus;
  windowState: AttendanceWindowState;
  /** Abre al terminar la sesión. */
  opensAt: Date;
  /** Cierra `windowHours` después. */
  closesAt: Date;
  /** Se puede enviar el formulario ahora (ventana abierta y sin registro previo). */
  canRegister: boolean;
  registeredAt: Date | null;
  source: AttendanceSource | null;
  comment: string | null;
}

export function attendanceInfo(input: AttendanceInput, now: Date): AttendanceInfo {
  const opensAt = input.endsAt;
  const closesAt = new Date(input.endsAt.getTime() + input.windowHours * HOUR);
  const t = now.getTime();
  const windowState: AttendanceWindowState =
    input.status === 'CANCELLED'
      ? AttendanceWindowState.NOT_APPLICABLE
      : t < opensAt.getTime()
        ? AttendanceWindowState.NOT_OPEN_YET
        : t < closesAt.getTime()
          ? AttendanceWindowState.OPEN
          : AttendanceWindowState.CLOSED;

  let status: AttendanceStatus;
  if (input.record) status = AttendanceStatus.REGISTERED;
  else if (windowState === AttendanceWindowState.NOT_APPLICABLE) {
    status = AttendanceStatus.NOT_APPLICABLE;
  } else if (windowState === AttendanceWindowState.CLOSED) status = AttendanceStatus.NOT_REGISTERED;
  else status = AttendanceStatus.PENDING;

  return {
    status,
    windowState,
    opensAt,
    closesAt,
    canRegister: !input.record && windowState === AttendanceWindowState.OPEN,
    registeredAt: input.record?.registeredAt ?? null,
    source: input.record?.source ?? null,
    comment: input.record?.comment ?? null,
  };
}

/** Error que corresponde a un intento de registro (HU-18), o null si se puede registrar. */
export function attendanceRegistrationError(
  info: AttendanceInfo,
):
  | 'ATTENDANCE_ALREADY_REGISTERED'
  | 'SESSION_CANCELLED'
  | 'ATTENDANCE_NOT_OPEN_YET'
  | 'ATTENDANCE_WINDOW_CLOSED'
  | null {
  if (info.status === AttendanceStatus.REGISTERED) return 'ATTENDANCE_ALREADY_REGISTERED';
  switch (info.windowState) {
    case AttendanceWindowState.NOT_APPLICABLE:
      return 'SESSION_CANCELLED';
    case AttendanceWindowState.NOT_OPEN_YET:
      return 'ATTENDANCE_NOT_OPEN_YET';
    case AttendanceWindowState.CLOSED:
      return 'ATTENDANCE_WINDOW_CLOSED';
    default:
      return null;
  }
}
