import { Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import type { AdminUser } from '../../../common/guards/permissions.guard';
import { type CsvColumn, toCsv } from '../../../common/utils/csv';
import { formatInZone, nowUtc, OFFICIAL_TIMEZONE } from '../../../common/utils/time';
import { BUSINESS_RULES } from '../../../config/business-rules';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CLASSROOM_ACCESS_STATUSES } from '../../enrollments/policies/enrollment.policy';
import { NotificationsService } from '../../notifications/notifications.service';
import { PORTAL_LINKS } from '../../notifications/portal-links';
import { cdmxDate } from '../../offers/policies/schedule-rule';
import {
  attendanceInfo,
  AttendanceWindowState,
  effectiveAttendanceWindowHours,
  type AttendanceInfo,
} from '../policies/session.policy';
import { ROSTER_STATUSES } from './admin-session-view';
import type {
  AttendanceSessionChipDto,
  MarkAttendanceRequestDto,
  MarkAttendanceResultDto,
  ParticipantAttendanceDto,
  ParticipantAttendanceQueryDto,
  RemindAttendanceResultDto,
  SessionAttendanceDto,
  SessionAttendanceQueryDto,
  SessionAttendanceRowDto,
  UnmarkAttendanceResultDto,
} from './dto/admin-attendance.dto';
import {
  adminSessionState,
  attendanceSummary,
  participantAttendance,
} from './policies/session-admin.policy';

const ROSTER_SELECT = {
  status: true,
  origin: true,
  user: { select: { id: true, fullName: true, email: true, countryCode: true } },
} as const satisfies Prisma.EnrollmentSelect;

type RosterRow = Prisma.EnrollmentGetPayload<{ select: typeof ROSTER_SELECT }>;

/** Texto de los estados para el CSV (mismos textos que la guía). */
const STATUS_TEXT: Record<string, string> = {
  REGISTERED: 'Registrada',
  PENDING: 'Pendiente',
  NOT_REGISTERED: 'No registrada',
  NOT_APPLICABLE: 'Cancelada',
};

/**
 * Control de asistencia del panel (Fase 06, HU-30): chips por sesión, tabla "Por sesión" y "Por
 * participante", marca manual (origen MANUAL, quién/cuándo/motivo), "Recordar a pendientes" y CSV.
 * Inscritos = Enrollment ACTIVE, COMPLETED o SUSPENDED (NAS y Moodle).
 */
@Injectable()
export class AdminAttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async sessionChips(offerId: string): Promise<AttendanceSessionChipDto[]> {
    const offer = await this.requireOffer(offerId);
    const [sessions, total] = await Promise.all([
      this.prisma.offerSession.findMany({
        where: { offerId },
        orderBy: { startsAt: 'asc' },
        include: { _count: { select: { attendances: true } } },
      }),
      this.prisma.enrollment.count({ where: { offerId, status: { in: [...ROSTER_STATUSES] } } }),
    ]);
    const now = nowUtc();
    return sessions.map((s) =>
      this.chip(s, this.info(s, offer.attendanceWindowHours, now), s._count.attendances, total),
    );
  }

  async sessionAttendance(
    sessionId: string,
    query: SessionAttendanceQueryDto,
  ): Promise<SessionAttendanceDto> {
    const { session, offer } = await this.requireSession(sessionId);
    const now = nowUtc();
    const [roster, records] = await Promise.all([
      this.roster(offer.id),
      this.prisma.sessionAttendance.findMany({
        where: { sessionId },
        include: { recordedBy: { select: { id: true, fullName: true } } },
      }),
    ]);
    const windowHours = effectiveAttendanceWindowHours(
      session.attendanceWindowHours,
      offer.attendanceWindowHours,
    );
    const byUser = new Map(records.map((r) => [r.userId, r]));
    const rows: SessionAttendanceRowDto[] = roster.map((e) => {
      const record = byUser.get(e.user.id) ?? null;
      const info = attendanceInfo(
        { status: session.status, endsAt: session.endsAt, windowHours, record },
        now,
      );
      return {
        userId: e.user.id,
        fullName: e.user.fullName,
        email: e.user.email,
        countryCode: e.user.countryCode,
        origin: e.origin,
        enrollmentStatus: e.status,
        status: info.status,
        registeredAt: record?.registeredAt.toISOString() ?? null,
        source: record?.source ?? null,
        comment: record?.comment ?? null,
        recordedBy: record?.recordedBy ?? null,
        manualReason: record?.manualReason ?? null,
      };
    });
    const registered = rows.filter((r) => r.status === 'REGISTERED').length;
    const info = attendanceInfo(
      { status: session.status, endsAt: session.endsAt, windowHours, record: null },
      now,
    );
    const summary = attendanceSummary(registered, rows.length);
    return {
      session: this.chip(session, info, registered, rows.length),
      summary,
      rows: rows
        .filter((r) => !query.status || r.status === query.status)
        .filter((r) => !query.countryCode || r.countryCode === query.countryCode)
        .filter((r) => matchesQuery(r, query.q))
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es')),
    };
  }

  async participants(
    offerId: string,
    query: ParticipantAttendanceQueryDto,
  ): Promise<ParticipantAttendanceDto> {
    await this.requireOffer(offerId);
    const now = nowUtc();
    const [roster, sessions, records] = await Promise.all([
      this.roster(offerId),
      this.prisma.offerSession.findMany({
        where: { offerId },
        select: { id: true, status: true, endsAt: true },
      }),
      this.prisma.sessionAttendance.findMany({
        where: { session: { offerId } },
        select: { userId: true, sessionId: true },
      }),
    ]);
    const attendedBy = new Map<string, Set<string>>();
    for (const r of records) {
      const set = attendedBy.get(r.userId) ?? new Set<string>();
      set.add(r.sessionId);
      attendedBy.set(r.userId, set);
    }
    const rows = roster.map((e) => ({
      userId: e.user.id,
      fullName: e.user.fullName,
      email: e.user.email,
      countryCode: e.user.countryCode,
      origin: e.origin,
      enrollmentStatus: e.status,
      ...participantAttendance(sessions, attendedBy.get(e.user.id) ?? new Set(), now),
    }));
    const held = participantAttendance(sessions, new Set(), now).heldSessions;
    return {
      heldSessions: held,
      thresholdPercent: BUSINESS_RULES.ATTENDANCE_ALERT_THRESHOLD_PERCENT,
      rows: rows
        .filter((r) => !query.countryCode || r.countryCode === query.countryCode)
        .filter((r) => !query.belowThreshold || r.belowThreshold)
        .filter((r) => matchesQuery(r, query.q))
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es')),
    };
  }

  async mark(
    sessionId: string,
    dto: MarkAttendanceRequestDto,
    user: AdminUser,
  ): Promise<MarkAttendanceResultDto> {
    const { session, offer } = await this.requireSession(sessionId);
    if (session.status === 'CANCELLED') throw new AppException('SESSION_CANCELLED');
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        offerId: offer.id,
        userId: { in: dto.userIds },
        status: { in: [...ROSTER_STATUSES] },
      },
      select: { id: true, userId: true },
    });
    const enrolled = new Set(enrollments.map((e) => e.userId));
    const missing = dto.userIds.filter((id) => !enrolled.has(id));
    if (missing.length > 0) {
      throw new AppException('ATTENDANCE_NOT_ENROLLED', { meta: { userIds: missing } });
    }
    const reason = dto.reason.trim();
    const now = nowUtc();
    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.sessionAttendance.createMany({
        data: enrollments.map((e) => ({
          sessionId,
          userId: e.userId,
          enrollmentId: e.id,
          source: 'MANUAL' as const,
          registeredAt: now,
          recordedById: user.id,
          manualReason: reason,
        })),
        skipDuplicates: true,
      });
      await this.audit.record(
        {
          actor: user,
          action: 'attendance.mark',
          entityType: 'OfferSession',
          entityId: sessionId,
          summary: `Marcó asistencia manual a ${created.count} persona(s) en «${offer.name}».`,
          after: { userIds: dto.userIds, reason, marked: created.count },
        },
        tx,
      );
      return created.count;
    });
    return { marked: result, alreadyRegistered: dto.userIds.length - result };
  }

  async unmark(
    sessionId: string,
    dto: MarkAttendanceRequestDto,
    user: AdminUser,
  ): Promise<UnmarkAttendanceResultDto> {
    const { offer } = await this.requireSession(sessionId);
    const reason = dto.reason.trim();
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.sessionAttendance.findMany({
        where: { sessionId, userId: { in: dto.userIds } },
        select: { userId: true, source: true, registeredAt: true, comment: true },
      });
      const deleted = await tx.sessionAttendance.deleteMany({
        where: { sessionId, userId: { in: dto.userIds } },
      });
      await this.audit.record(
        {
          actor: user,
          action: 'attendance.unmark',
          entityType: 'OfferSession',
          entityId: sessionId,
          summary: `Quitó la asistencia de ${deleted.count} persona(s) en «${offer.name}». Motivo: ${reason}`,
          before: { records: existing },
          after: { reason, unmarked: deleted.count },
        },
        tx,
      );
      return { unmarked: deleted.count };
    });
  }

  async remind(sessionId: string, user: AdminUser): Promise<RemindAttendanceResultDto> {
    const { session, offer } = await this.requireSession(sessionId);
    const now = nowUtc();
    const info = this.info(session, offer.attendanceWindowHours, now);
    if (info.windowState === AttendanceWindowState.NOT_APPLICABLE) {
      throw new AppException('SESSION_CANCELLED');
    }
    if (info.windowState === AttendanceWindowState.NOT_OPEN_YET) {
      throw new AppException('ATTENDANCE_NOT_OPEN_YET', {
        meta: { opensAt: info.opensAt.toISOString() },
      });
    }
    if (info.windowState === AttendanceWindowState.CLOSED) {
      throw new AppException('ATTENDANCE_WINDOW_CLOSED', {
        meta: { closesAt: info.closesAt.toISOString() },
      });
    }
    const pending = await this.prisma.enrollment.findMany({
      where: {
        offerId: offer.id,
        status: { in: [...CLASSROOM_ACCESS_STATUSES] },
        user: { attendances: { none: { sessionId } } },
      },
      select: { userId: true },
    });
    const closes = formatInZone(info.closesAt, OFFICIAL_TIMEZONE, 'd/MM/yyyy HH:mm');
    const created = await this.notifications.notify({
      userIds: pending.map((p) => p.userId),
      type: 'ATTENDANCE_OPEN',
      title: `Recuerda registrar tu asistencia: ${offer.name}`,
      body: `Aún no registras tu asistencia a la sesión. El registro cierra el ${closes} hora CDMX.`,
      action: { label: 'Registrar asistencia', path: PORTAL_LINKS.attendance(sessionId) },
      data: { offerId: offer.id, sessionId },
      dedupeKey: `attendance-remind:${sessionId}:${cdmxDate(now)}`,
    });
    await this.audit.record({
      actor: user,
      action: 'attendance.remind',
      entityType: 'OfferSession',
      entityId: sessionId,
      summary: `Recordó registrar asistencia a ${created.length} persona(s) en «${offer.name}».`,
      after: { notified: created.length },
    });
    return { notified: created.length };
  }

  // --- CSV (respetan los filtros) -----------------------------------------------------------------

  async sessionCsv(
    sessionId: string,
    query: SessionAttendanceQueryDto,
  ): Promise<{ fileName: string; csv: string }> {
    const data = await this.sessionAttendance(sessionId, query);
    const columns: CsvColumn<SessionAttendanceRowDto>[] = [
      { header: 'Nombre', value: (r) => r.fullName },
      { header: 'Correo', value: (r) => r.email },
      { header: 'País', value: (r) => r.countryCode },
      {
        header: 'Origen inscripción',
        value: (r) => (r.origin === 'MOODLE' ? 'Vía Moodle' : 'NAS'),
      },
      { header: 'Estado', value: (r) => STATUS_TEXT[r.status] ?? r.status },
      {
        header: 'Registrada (hora CDMX)',
        value: (r) => (r.registeredAt ? cdmx(r.registeredAt) : ''),
      },
      {
        header: 'Origen registro',
        value: (r) => (r.source === 'MANUAL' ? 'Manual' : r.source ? 'Participante' : ''),
      },
      { header: 'Comentario', value: (r) => r.comment },
      { header: 'Marcada por', value: (r) => r.recordedBy?.fullName },
      { header: 'Motivo', value: (r) => r.manualReason },
    ];
    const date = cdmxDate(new Date(data.session.startsAt));
    return { fileName: `asistencia-sesion-${date}.csv`, csv: toCsv(data.rows, columns) };
  }

  async participantsCsv(
    offerId: string,
    query: ParticipantAttendanceQueryDto,
  ): Promise<{ fileName: string; csv: string }> {
    const offer = await this.requireOffer(offerId);
    const data = await this.participants(offerId, query);
    const columns: CsvColumn<ParticipantAttendanceDto['rows'][number]>[] = [
      { header: 'Nombre', value: (r) => r.fullName },
      { header: 'Correo', value: (r) => r.email },
      { header: 'País', value: (r) => r.countryCode },
      {
        header: 'Origen inscripción',
        value: (r) => (r.origin === 'MOODLE' ? 'Vía Moodle' : 'NAS'),
      },
      { header: 'Sesiones asistidas', value: (r) => r.attended },
      { header: 'Sesiones realizadas', value: (r) => r.heldSessions },
      { header: '% asistencia', value: (r) => r.percent },
      { header: 'Bajo 80%', value: (r) => (r.belowThreshold ? 'Sí' : 'No') },
    ];
    return { fileName: `asistencia-${offer.slug}.csv`, csv: toCsv(data.rows, columns) };
  }

  // ------------------------------------------------------------------------------------------------

  private info(
    session: {
      status: 'SCHEDULED' | 'CANCELLED';
      endsAt: Date;
      attendanceWindowHours: number | null;
    },
    offerWindow: number,
    now: Date,
  ): AttendanceInfo {
    return attendanceInfo(
      {
        status: session.status,
        endsAt: session.endsAt,
        windowHours: effectiveAttendanceWindowHours(session.attendanceWindowHours, offerWindow),
        record: null,
      },
      now,
    );
  }

  private chip(
    session: { id: string; startsAt: Date; endsAt: Date },
    info: AttendanceInfo,
    registered: number,
    total: number,
  ): AttendanceSessionChipDto {
    return {
      sessionId: session.id,
      startsAt: session.startsAt.toISOString(),
      endsAt: session.endsAt.toISOString(),
      state: adminSessionState(info.windowState),
      opensAt: info.opensAt.toISOString(),
      closesAt: info.closesAt.toISOString(),
      registered,
      total,
      percent: attendanceSummary(registered, total).percent,
    };
  }

  private roster(offerId: string): Promise<RosterRow[]> {
    return this.prisma.enrollment.findMany({
      where: { offerId, status: { in: [...ROSTER_STATUSES] } },
      select: ROSTER_SELECT,
    });
  }

  private async requireOffer(offerId: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      select: { id: true, name: true, slug: true, attendanceWindowHours: true },
    });
    if (!offer) throw AppException.notFound('La oferta no existe.');
    return offer;
  }

  private async requireSession(sessionId: string) {
    const session = await this.prisma.offerSession.findUnique({
      where: { id: sessionId },
      include: {
        offer: { select: { id: true, name: true, slug: true, attendanceWindowHours: true } },
      },
    });
    if (!session) throw AppException.notFound('La sesión no existe.');
    return { session, offer: session.offer };
  }
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function matchesQuery(row: { fullName: string; email: string }, q?: string): boolean {
  if (!q?.trim()) return true;
  const needle = normalize(q.trim());
  return normalize(row.fullName).includes(needle) || normalize(row.email).includes(needle);
}

function cdmx(iso: string): string {
  return formatInZone(new Date(iso), OFFICIAL_TIMEZONE, 'yyyy-MM-dd HH:mm');
}
