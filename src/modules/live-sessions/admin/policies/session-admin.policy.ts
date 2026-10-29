import { BUSINESS_RULES } from '../../../../config/business-rules';
import type {
  NotificationType,
  OfferModality,
  OfferType,
  SessionStatus,
} from '../../../../generated/prisma/client';
import { dualTime } from '../../../applications/policies/application-messages.policy';
import {
  type GenerateSessionsResult,
  type HoursViolation,
  validateOfferHours,
} from '../../../offers/policies/session-generation.policy';
import { AttendanceWindowState } from '../../policies/session.policy';

/**
 * Reglas puras del panel para sesiones y asistencia (Fase 06, HU-29 / HU-30).
 */

// -------------------------------------------------------------------------------------------------
// Generación de sesiones: decisión de la vista previa (HU-29)
// -------------------------------------------------------------------------------------------------

export interface GenerationDecision {
  /** Reglas que BLOQUEAN "Crear sesiones" (HU-29: curso mayor a 9 h). */
  violations: HoursViolation[];
  /** Reglas que solo se advierten (diplomado distinto de 60 h: el wizard de HU-27 ya lo exige). */
  warnings: HoursViolation[];
  canConfirm: boolean;
  /** Motivo legible del bloqueo (null si se puede confirmar). */
  blockedReason: string | null;
  /** Horas totales = sesiones existentes no canceladas + nuevas. */
  totalHours: number;
  newHours: number;
  existingHours: number;
}

export const GENERATION_BLOCK_MESSAGES = {
  NO_SESSIONS: 'La regla no genera ninguna sesión nueva en el rango elegido.',
  CONFLICTS: 'Hay sesiones en conflicto con otras ya existentes: resuélvelas antes de crear.',
  COURSE_MAX_HOURS_EXCEEDED: `Los cursos tienen una duración máxima de ${BUSINESS_RULES.COURSE_MAX_HOURS} horas.`,
} as const;

/**
 * Decide si la vista previa se puede confirmar (HU-29 "No se confirma con conflictos o curso mayor a
 * 9 h"). El total de horas suma las sesiones ya existentes (no canceladas) y las nuevas.
 */
export function decideGeneration(
  type: OfferType,
  result: Pick<GenerateSessionsResult, 'sessionCount' | 'conflictCount' | 'totalMinutes'>,
  existingMinutes: number,
): GenerationDecision {
  const total = existingMinutes + result.totalMinutes;
  const all = validateOfferHours(type, total);
  const violations = all.filter((v) => v === 'COURSE_MAX_HOURS_EXCEEDED');
  const warnings = all.filter((v) => v !== 'COURSE_MAX_HOURS_EXCEEDED');
  let blockedReason: string | null = null;
  if (result.conflictCount > 0) blockedReason = GENERATION_BLOCK_MESSAGES.CONFLICTS;
  else if (violations.length > 0) blockedReason = GENERATION_BLOCK_MESSAGES[violations[0]];
  else if (result.sessionCount === 0) blockedReason = GENERATION_BLOCK_MESSAGES.NO_SESSIONS;
  return {
    violations,
    warnings,
    canConfirm: blockedReason === null,
    blockedReason,
    totalHours: total / 60,
    newHours: result.totalMinutes / 60,
    existingHours: existingMinutes / 60,
  };
}

/** Minutos de una lista de sesiones, sin contar canceladas. */
export function scheduledMinutes(
  sessions: ReadonlyArray<{ status: SessionStatus; startsAt: Date; endsAt: Date }>,
): number {
  return sessions
    .filter((s) => s.status !== 'CANCELLED')
    .reduce((sum, s) => sum + Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 60_000), 0);
}

/** ¿Dos intervalos se traslapan? (fin exclusivo). */
export function overlaps(
  a: { startsAt: Date; endsAt: Date },
  b: { startsAt: Date; endsAt: Date },
): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

// -------------------------------------------------------------------------------------------------
// Estado de la sesión en el panel (chips de HU-30) y banderas (íconos de HU-29)
// -------------------------------------------------------------------------------------------------

/**
 * | Valor              | UI                |
 * |--------------------|-------------------|
 * | SCHEDULED          | Programada        |
 * | REGISTRATION_OPEN  | Registro abierto  |
 * | CLOSED             | Cerrada           |
 * | CANCELLED          | Cancelada         |
 */
export const AdminSessionState = {
  SCHEDULED: 'SCHEDULED',
  REGISTRATION_OPEN: 'REGISTRATION_OPEN',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;
export type AdminSessionState = (typeof AdminSessionState)[keyof typeof AdminSessionState];

export function adminSessionState(windowState: AttendanceWindowState): AdminSessionState {
  switch (windowState) {
    case AttendanceWindowState.NOT_APPLICABLE:
      return AdminSessionState.CANCELLED;
    case AttendanceWindowState.NOT_OPEN_YET:
      return AdminSessionState.SCHEDULED;
    case AttendanceWindowState.OPEN:
      return AdminSessionState.REGISTRATION_OPEN;
    default:
      return AdminSessionState.CLOSED;
  }
}

export interface SessionFlags {
  /** Reprogramada a mano (tiene hora original). */
  edited: boolean;
  cancelled: boolean;
  /** En línea sin enlace de participante. */
  missingLink: boolean;
  /** En línea, ya terminó y sin grabación ("Grabación pendiente", HU-28). */
  recordingPending: boolean;
}

export function sessionFlags(
  session: {
    status: SessionStatus;
    endsAt: Date;
    joinUrl: string | null;
    recordingUrl: string | null;
    originalStartsAt: Date | null;
  },
  modality: OfferModality,
  now: Date,
): SessionFlags {
  const cancelled = session.status === 'CANCELLED';
  const online = modality === 'ONLINE_LIVE';
  return {
    edited: session.originalStartsAt !== null,
    cancelled,
    missingLink: online && !cancelled && !session.joinUrl,
    recordingPending:
      online && !cancelled && !session.recordingUrl && session.endsAt.getTime() <= now.getTime(),
  };
}

// -------------------------------------------------------------------------------------------------
// % de asistencia (HU-30): asistidas ÷ sesiones YA realizadas (no canceladas). Distinto del progreso.
// -------------------------------------------------------------------------------------------------

export interface ParticipantAttendance {
  attended: number;
  heldSessions: number;
  /** Entero 0–100 (redondeo al más cercano); null si aún no hay sesiones realizadas. */
  percent: number | null;
  /** Alerta visual bajo ATTENDANCE_ALERT_THRESHOLD_PERCENT (Anexo A HU-30). */
  belowThreshold: boolean;
}

export function participantAttendance(
  sessions: ReadonlyArray<{ id: string; status: SessionStatus; endsAt: Date }>,
  attendedSessionIds: ReadonlySet<string>,
  now: Date,
  threshold: number = BUSINESS_RULES.ATTENDANCE_ALERT_THRESHOLD_PERCENT,
): ParticipantAttendance {
  const held = sessions.filter(
    (s) => s.status !== 'CANCELLED' && s.endsAt.getTime() <= now.getTime(),
  );
  const attended = held.filter((s) => attendedSessionIds.has(s.id)).length;
  const percent = held.length > 0 ? Math.round((attended / held.length) * 100) : null;
  return {
    attended,
    heldSessions: held.length,
    percent,
    belowThreshold: percent !== null && percent < threshold,
  };
}

/** Resumen de una sesión: "18 de 25 registraron asistencia (72%)". */
export function attendanceSummary(
  registered: number,
  total: number,
): { registered: number; total: number; percent: number; label: string } {
  const percent = total > 0 ? Math.round((registered / total) * 100) : 0;
  return {
    registered,
    total,
    percent,
    label: `${registered} de ${total} registraron asistencia (${percent}%)`,
  };
}

// -------------------------------------------------------------------------------------------------
// Avisos a inscritos (HU-13 / HU-29): nueva hora en la zona de cada persona + hora CDMX
// -------------------------------------------------------------------------------------------------

export interface SessionMessage {
  type: NotificationType;
  title: string;
  body: string;
  /** Datos clave del correo (opcional; la notificación del portal usa `body`). */
  email?: { details: { label: string; value: string }[] };
}

/** "1 h 30 min" / "2 h" / "45 min". */
export function durationLabel(startsAt: Date, endsAt: Date): string {
  const minutes = Math.max(0, Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** HU-13 / HU-29: sesión nueva (alta manual) para quienes ya están inscritos. */
export function sessionScheduledMessage(input: {
  offerName: string;
  startsAt: Date;
  endsAt: Date;
  moduleTitle?: string | null;
  userTimezone: string;
}): SessionMessage {
  const when = dualTime(input.startsAt, input.userTimezone);
  return {
    type: 'SESSION_SCHEDULED',
    title: `Nueva sesión: ${input.offerName}`,
    body:
      `Se agendó una sesión de ${input.offerName} para el ${when}. El enlace para unirte estará ` +
      'en Mis sesiones.',
    email: {
      details: [
        { label: 'Formación', value: input.offerName },
        ...(input.moduleTitle ? [{ label: 'Módulo', value: input.moduleTitle }] : []),
        { label: 'Fecha y hora', value: when },
        { label: 'Duración', value: durationLabel(input.startsAt, input.endsAt) },
      ],
    },
  };
}

/** HU-13 / HU-29: varias sesiones generadas de una vez (un solo aviso con el resumen). */
export function sessionsGeneratedMessage(input: {
  offerName: string;
  count: number;
  firstStartsAt: Date;
  firstEndsAt: Date;
  lastStartsAt: Date;
  userTimezone: string;
}): SessionMessage {
  if (input.count === 1) {
    return sessionScheduledMessage({
      offerName: input.offerName,
      startsAt: input.firstStartsAt,
      endsAt: input.firstEndsAt,
      userTimezone: input.userTimezone,
    });
  }
  const first = dualTime(input.firstStartsAt, input.userTimezone);
  return {
    type: 'SESSION_SCHEDULED',
    title: `Nuevas sesiones: ${input.offerName}`,
    body:
      `Se agendaron ${input.count} sesiones de ${input.offerName}. La primera es el ${first}. ` +
      'Consulta todas las fechas y los enlaces en Mis sesiones.',
    email: {
      details: [
        { label: 'Formación', value: input.offerName },
        { label: 'Sesiones agendadas', value: String(input.count) },
        { label: 'Primera sesión', value: first },
        { label: 'Última sesión', value: dualTime(input.lastStartsAt, input.userTimezone) },
      ],
    },
  };
}

export function sessionRescheduledMessage(input: {
  offerName: string;
  previousStartsAt: Date;
  startsAt: Date;
  reason: string;
  userTimezone: string;
}): SessionMessage {
  return {
    type: 'SESSION_RESCHEDULED',
    title: `Sesión reprogramada: ${input.offerName}`,
    body:
      `La sesión del ${dualTime(input.previousStartsAt, input.userTimezone)} se reprogramó al ` +
      `${dualTime(input.startsAt, input.userTimezone)}. Motivo: ${input.reason}`,
  };
}

export function sessionCancelledMessage(input: {
  offerName: string;
  startsAt: Date;
  reason: string;
  userTimezone: string;
}): SessionMessage {
  return {
    type: 'SESSION_CANCELLED',
    title: `Sesión cancelada: ${input.offerName}`,
    body:
      `La sesión del ${dualTime(input.startsAt, input.userTimezone)} fue cancelada. ` +
      `Motivo: ${input.reason}`,
  };
}

export function recordingPublishedMessage(input: {
  offerName: string;
  startsAt: Date;
  userTimezone: string;
}): SessionMessage {
  return {
    type: 'RECORDING_PUBLISHED',
    title: `Grabación disponible: ${input.offerName}`,
    body:
      `Ya puedes ver la grabación de la sesión del ${dualTime(input.startsAt, input.userTimezone)} ` +
      'en los materiales de tu formación.',
  };
}

/** Agrupa destinatarios por zona horaria (un `notify` por zona con el texto en su hora). */
export function groupByTimezone<T extends { timezone: string }>(
  items: readonly T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const list = groups.get(item.timezone) ?? [];
    list.push(item);
    groups.set(item.timezone, list);
  }
  return groups;
}
