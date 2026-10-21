import type { OfferModality, OfferSession, Prisma } from '../../../generated/prisma/client';
import { attendanceInfo, effectiveAttendanceWindowHours } from '../policies/session.policy';
import type { AdminSessionDto } from './dto/admin-sessions.dto';
import { adminSessionState, sessionFlags } from './policies/session-admin.policy';

/** Estados de inscripción que el panel cuenta como "inscritos" en asistencia (NAS y Moodle). */
export const ROSTER_STATUSES = ['ACTIVE', 'COMPLETED', 'SUSPENDED'] as const;

export const ADMIN_SESSION_INCLUDE = {
  _count: { select: { attendances: true } },
} as const satisfies Prisma.OfferSessionInclude;

export type AdminSessionRow = OfferSession & { _count: { attendances: number } };

export interface AdminSessionContext {
  modality: OfferModality;
  offerWindowHours: number;
  /** id de módulo → { number, title } (numeración por orden actual). */
  modules: Map<string, { number: number; title: string }>;
  enrolled: number;
  now: Date;
}

/** Numera los módulos de una oferta por su orden ("Módulo N"). */
export function moduleNumbers(
  modules: ReadonlyArray<{ id: string; position: number; title: string }>,
): Map<string, { number: number; title: string }> {
  return new Map(
    [...modules]
      .sort((a, b) => a.position - b.position)
      .map((m, i) => [m.id, { number: i + 1, title: m.title }]),
  );
}

export function toAdminSessionDto(row: AdminSessionRow, ctx: AdminSessionContext): AdminSessionDto {
  const windowHours = effectiveAttendanceWindowHours(
    row.attendanceWindowHours,
    ctx.offerWindowHours,
  );
  const info = attendanceInfo(
    { status: row.status, endsAt: row.endsAt, windowHours, record: null },
    ctx.now,
  );
  const module = row.moduleId ? ctx.modules.get(row.moduleId) : undefined;
  return {
    id: row.id,
    offerId: row.offerId,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    status: row.status,
    state: adminSessionState(info.windowState),
    category: row.category,
    module: module && row.moduleId ? { id: row.moduleId, ...module } : null,
    joinUrl: row.joinUrl,
    hostUrl: row.hostUrl,
    recordingUrl: row.recordingUrl,
    recordingPublishedAt: row.recordingPublishedAt?.toISOString() ?? null,
    attendanceWindowHours: row.attendanceWindowHours,
    effectiveAttendanceWindowHours: windowHours,
    originalStartsAt: row.originalStartsAt?.toISOString() ?? null,
    changeReason: row.changeReason,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    flags: sessionFlags(row, ctx.modality, ctx.now),
    attendance: { registered: row._count.attendances, enrolled: ctx.enrolled },
  };
}
