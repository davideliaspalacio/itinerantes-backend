import type { SessionStatus } from '../../../generated/prisma/client';

/**
 * Progreso de una formación (HU-07 / HU-17): sesiones con asistencia ÷ sesiones programadas, SIN
 * contar las canceladas. Es distinto del "% de asistencia" del panel (HU-30), que divide entre las
 * sesiones ya realizadas.
 */
export interface ProgressSession {
  id: string;
  status: SessionStatus;
}

export interface Progress {
  attendedSessions: number;
  scheduledSessions: number;
  /** Entero 0–100 (redondeado hacia abajo para no mostrar 100% antes de tiempo). */
  percent: number;
}

export function computeProgress(
  sessions: readonly ProgressSession[],
  attendedSessionIds: ReadonlySet<string>,
): Progress {
  const scheduled = sessions.filter((s) => s.status !== 'CANCELLED');
  const attended = scheduled.filter((s) => attendedSessionIds.has(s.id)).length;
  return {
    attendedSessions: attended,
    scheduledSessions: scheduled.length,
    percent: scheduled.length > 0 ? Math.floor((attended / scheduled.length) * 100) : 0,
  };
}

/** Primera sesión no cancelada que aún no termina (en curso o futura), o null. */
export function nextSession<T extends { status: SessionStatus; startsAt: Date; endsAt: Date }>(
  sessions: readonly T[],
  now: Date,
): T | null {
  const t = now.getTime();
  return (
    [...sessions]
      .filter((s) => s.status !== 'CANCELLED' && s.endsAt.getTime() > t)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0] ?? null
  );
}
