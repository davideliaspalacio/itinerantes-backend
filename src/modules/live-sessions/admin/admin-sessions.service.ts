import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import type { AdminUser } from '../../../common/guards/permissions.guard';
import { nowUtc } from '../../../common/utils/time';
import { isHttpsUrl, isMeetingUrl } from '../../../common/utils/urls';
import {
  type CalendarEventKind,
  type OfferModality,
  type OfferSession,
  type Prisma,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CLASSROOM_ACCESS_STATUSES } from '../../enrollments/policies/enrollment.policy';
import { NotificationsService } from '../../notifications/notifications.service';
import { PORTAL_LINKS } from '../../notifications/portal-links';
import { buildImportantDates } from '../../offers/policies/important-dates.policy';
import {
  cdmxDate,
  scheduleRuleSchema,
  type ScheduleRule,
} from '../../offers/policies/schedule-rule';
import { generateSessions } from '../../offers/policies/session-generation.policy';
import {
  ADMIN_SESSION_INCLUDE,
  type AdminSessionRow,
  moduleNumbers,
  ROSTER_STATUSES,
  toAdminSessionDto,
} from './admin-session-view';
import type {
  AdminSessionDto,
  CancelSessionRequestDto,
  CreateSessionRequestDto,
  GenerateSessionsRequestDto,
  GenerateSessionsResultDto,
  RescheduleSessionRequestDto,
  SessionChangeResultDto,
  SessionPreviewDto,
  UpdateSessionRequestDto,
} from './dto/admin-sessions.dto';
import {
  decideGeneration,
  groupByTimezone,
  overlaps,
  recordingPublishedMessage,
  scheduledMinutes,
  sessionCancelledMessage,
  type SessionMessage,
  sessionRescheduledMessage,
} from './policies/session-admin.policy';

type ImportantKind = Exclude<CalendarEventKind, 'MANUAL'>;

interface Plan {
  offerId: string;
  rule: ScheduleRule;
  ruleProvided: boolean;
  joinUrl: string | null;
  hostUrl: string | null;
  preview: SessionPreviewDto;
  /** Sesiones a crear (status NEW) con su módulo. */
  toCreate: Array<{ startsAt: Date; endsAt: Date; moduleId: string | null }>;
  importantDates: Array<{
    kind: ImportantKind;
    title: string;
    startsAt: Date;
    audience: 'ALL_REGISTERED' | 'OFFER_ENROLLED';
    existingId: string | null;
  }>;
  category: OfferSession['category'];
}

/**
 * Sesiones de una oferta en el panel (Fase 06, HU-29): listado con enlaces de anfitrión, generación
 * automática con vista previa (festivos MX, conflictos, reglas de horas), sesión manual, edición de
 * enlaces/grabación (HU-28), reprogramación y cancelación con aviso a inscritos.
 */
@Injectable()
export class AdminSessionsService {
  private readonly logger = new Logger(AdminSessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async list(offerId: string): Promise<AdminSessionDto[]> {
    const offer = await this.requireOffer(offerId);
    const rows = await this.prisma.offerSession.findMany({
      where: { offerId },
      orderBy: { startsAt: 'asc' },
      include: ADMIN_SESSION_INCLUDE,
    });
    const ctx = await this.context(offer);
    return rows.map((row) => toAdminSessionDto(row, ctx));
  }

  async get(sessionId: string): Promise<AdminSessionDto> {
    const row = await this.requireSession(sessionId);
    const offer = await this.requireOffer(row.offerId);
    return toAdminSessionDto(row, await this.context(offer));
  }

  // --- Generación (HU-29) -------------------------------------------------------------------------

  async preview(offerId: string, dto: GenerateSessionsRequestDto): Promise<SessionPreviewDto> {
    return (await this.plan(offerId, dto)).preview;
  }

  async generate(
    offerId: string,
    dto: GenerateSessionsRequestDto,
    user: AdminUser,
  ): Promise<GenerateSessionsResultDto> {
    const plan = await this.plan(offerId, dto);
    if (!plan.preview.canConfirm) {
      throw new AppException('SESSION_GENERATION_BLOCKED', {
        message: plan.preview.blockedReason ?? undefined,
        meta: {
          conflictCount: plan.preview.summary.conflictCount,
          violations: plan.preview.violations,
          blockedReason: plan.preview.blockedReason,
        },
      });
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.offerSession.createMany({
          data: plan.toCreate.map((s) => ({
            offerId,
            moduleId: s.moduleId,
            startsAt: s.startsAt,
            endsAt: s.endsAt,
            category: plan.category,
            joinUrl: plan.joinUrl,
            hostUrl: plan.hostUrl,
          })),
        });
        if (plan.ruleProvided) {
          await tx.offer.update({
            where: { id: offerId },
            data: { scheduleRule: plan.rule },
          });
        }
        for (const date of plan.importantDates) {
          const data = {
            kind: date.kind,
            title: date.title,
            startsAt: date.startsAt,
            audience: date.audience,
            category: 'IMPORTANT_DATES' as const,
            allDay: false,
            offerId,
            status: 'SCHEDULED' as const,
          };
          if (date.existingId)
            await tx.calendarEvent.update({ where: { id: date.existingId }, data });
          else await tx.calendarEvent.create({ data });
        }
        await this.audit.record(
          {
            actor: user,
            action: 'session.generate',
            entityType: 'Offer',
            entityId: offerId,
            summary: `Generó ${plan.toCreate.length} sesiones y ${plan.importantDates.length} fechas importantes.`,
            after: {
              sessions: plan.toCreate.length,
              totalHours: plan.preview.summary.totalHours,
              rule: plan.ruleProvided ? plan.rule : undefined,
              importantDates: plan.importantDates.map((d) => d.kind),
            },
          },
          tx,
        );
      });
    } catch (error) {
      throw this.uniqueToConflict(error);
    }
    const created = plan.toCreate.length;
    const dates = plan.importantDates.length;
    return {
      createdSessions: created,
      importantDates: dates,
      message: `Se crearon ${created} sesiones y ${dates} fechas importantes`,
      sessions: await this.list(offerId),
    };
  }

  private async plan(offerId: string, dto: GenerateSessionsRequestDto): Promise<Plan> {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        modules: {
          orderBy: { position: 'asc' },
          select: { id: true, position: true, title: true },
        },
        sessions: { select: { status: true, startsAt: true, endsAt: true } },
      },
    });
    if (!offer) throw AppException.notFound('La oferta no existe.');

    const rawRule = dto.rule ?? offer.scheduleRule;
    if (!rawRule) {
      throw AppException.validation([
        {
          field: 'rule',
          code: 'REQUIRED',
          message: 'La oferta no tiene regla de horario: envíala.',
        },
      ]);
    }
    const parsed = scheduleRuleSchema.safeParse(rawRule);
    if (!parsed.success) {
      throw AppException.validation(
        parsed.error.issues.map((issue) => ({
          field: ['rule', ...issue.path.map(String)].join('.'),
          code: 'INVALID',
          message: issue.message,
        })),
      );
    }
    const rule = parsed.data;

    const startDate = dto.startDate ?? (offer.startsAt ? cdmxDate(offer.startsAt) : null);
    const endDate = dto.endDate ?? (offer.endsAt ? cdmxDate(offer.endsAt) : null);
    const issues: Array<{ field: string; code: string; message: string }> = [];
    if (!startDate)
      issues.push({
        field: 'startDate',
        code: 'REQUIRED',
        message: 'Indica el primer día (la oferta no tiene fecha de inicio).',
      });
    if (!endDate)
      issues.push({
        field: 'endDate',
        code: 'REQUIRED',
        message: 'Indica el último día (la oferta no tiene fecha de fin).',
      });
    if (startDate && endDate) {
      if (endDate < startDate)
        issues.push({
          field: 'endDate',
          code: 'INVALID',
          message: 'El último día debe ser igual o posterior al primero.',
        });
      if (offer.startsAt && startDate < cdmxDate(offer.startsAt))
        issues.push({
          field: 'startDate',
          code: 'INVALID',
          message: 'Debe estar dentro del periodo de la oferta.',
        });
      if (offer.endsAt && endDate > cdmxDate(offer.endsAt))
        issues.push({
          field: 'endDate',
          code: 'INVALID',
          message: 'Debe estar dentro del periodo de la oferta.',
        });
    }
    issues.push(...this.linkIssues(offer.modality, { joinUrl: dto.joinUrl, hostUrl: dto.hostUrl }));
    if (issues.length > 0) throw AppException.validation(issues);

    const assign = dto.assignModules !== false && offer.modules.length > 0;
    const result = generateSessions({
      rule,
      startDate: startDate!,
      endDate: endDate!,
      // Las canceladas también ocupan su horario (única por offerId + inicio): bórralas para regenerar.
      existing: offer.sessions,
      moduleCount: assign ? offer.modules.length : undefined,
    });
    const decision = decideGeneration(offer.type, result, scheduledMinutes(offer.sessions));
    const numbers = moduleNumbers(offer.modules);
    const moduleRef = (index: number | undefined) => {
      const module = index !== undefined ? offer.modules[index] : undefined;
      return module ? { id: module.id, ...numbers.get(module.id)! } : null;
    };

    const kinds = new Set(dto.importantDates ?? []);
    const existingEvents = kinds.size
      ? await this.prisma.calendarEvent.findMany({
          where: { offerId, kind: { in: [...kinds] } },
          select: { id: true, kind: true },
        })
      : [];
    const importantDates = buildImportantDates(offer)
      .filter((d) => kinds.has(d.kind))
      .map((d) => ({
        ...d,
        existingId: existingEvents.find((e) => e.kind === d.kind)?.id ?? null,
      }));

    const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
    return {
      offerId,
      rule,
      ruleProvided: dto.rule !== undefined,
      joinUrl: dto.joinUrl ?? null,
      hostUrl: dto.hostUrl ?? null,
      category: offer.calendarCategory,
      toCreate: result.sessions.map((s) => ({
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        moduleId: moduleRef(s.moduleIndex)?.id ?? null,
      })),
      importantDates,
      preview: {
        items: result.items.map((item) => ({
          date: item.date,
          startsAt: item.startsAt.toISOString(),
          endsAt: item.endsAt.toISOString(),
          status: item.status,
          exclusionReason: item.exclusionReason ?? null,
          module: item.status === 'NEW' ? moduleRef(item.moduleIndex) : null,
        })),
        summary: {
          sessionCount: result.sessionCount,
          newHours: decision.newHours,
          existingHours: decision.existingHours,
          totalHours: decision.totalHours,
          excludedCount: result.excludedCount,
          conflictCount: result.conflictCount,
          label:
            `${result.sessionCount} sesiones · ${fmt(decision.newHours)} h · ` +
            `${result.excludedCount} excluidas` +
            (result.conflictCount ? ` · ${result.conflictCount} en conflicto` : ''),
        },
        violations: decision.violations,
        warnings: decision.warnings,
        canConfirm: decision.canConfirm,
        blockedReason: decision.blockedReason,
        importantDates: importantDates.map((d) => ({
          kind: d.kind,
          title: d.title,
          startsAt: d.startsAt.toISOString(),
          audience: d.audience,
          exists: d.existingId !== null,
        })),
      },
    };
  }

  // --- Sesión manual y edición --------------------------------------------------------------------

  async create(
    offerId: string,
    dto: CreateSessionRequestDto,
    user: AdminUser,
  ): Promise<AdminSessionDto> {
    const offer = await this.requireOffer(offerId);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    const issues = this.rangeIssues(startsAt, endsAt);
    issues.push(...this.linkIssues(offer.modality, dto));
    if (dto.moduleId) await this.requireModule(offerId, dto.moduleId, issues);
    if (issues.length) throw AppException.validation(issues);
    await this.assertNoOverlap(offerId, { startsAt, endsAt });
    let created: OfferSession;
    try {
      created = await this.prisma.offerSession.create({
        data: {
          offerId,
          startsAt,
          endsAt,
          moduleId: dto.moduleId ?? null,
          category: dto.category ?? offer.calendarCategory,
          joinUrl: dto.joinUrl ?? null,
          hostUrl: dto.hostUrl ?? null,
        },
      });
    } catch (error) {
      throw this.uniqueToConflict(error);
    }
    await this.audit.record({
      actor: user,
      action: 'session.create',
      entityType: 'OfferSession',
      entityId: created.id,
      summary: `Creó una sesión manual en «${offer.name}».`,
      after: { offerId, startsAt, endsAt, moduleId: created.moduleId, category: created.category },
    });
    return this.get(created.id);
  }

  async update(
    sessionId: string,
    dto: UpdateSessionRequestDto,
    user: AdminUser,
  ): Promise<SessionChangeResultDto> {
    const session = await this.requireSession(sessionId);
    const offer = await this.requireOffer(session.offerId);
    const issues = this.linkIssues(offer.modality, {
      joinUrl: dto.joinUrl ?? undefined,
      hostUrl: dto.hostUrl ?? undefined,
    });
    if (dto.recordingUrl && !isHttpsUrl(dto.recordingUrl)) {
      issues.push({
        field: 'recordingUrl',
        code: 'IS_URL',
        message: 'Usa un enlace https válido.',
      });
    }
    if (dto.moduleId) await this.requireModule(offer.id, dto.moduleId, issues);
    if (issues.length) throw AppException.validation(issues);

    const data: Prisma.OfferSessionUncheckedUpdateInput = {};
    if (dto.moduleId !== undefined) data.moduleId = dto.moduleId;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.joinUrl !== undefined) data.joinUrl = dto.joinUrl;
    if (dto.hostUrl !== undefined) data.hostUrl = dto.hostUrl;
    if (dto.attendanceWindowHours !== undefined)
      data.attendanceWindowHours = dto.attendanceWindowHours;
    const recordingChanged =
      dto.recordingUrl !== undefined && dto.recordingUrl !== session.recordingUrl;
    if (recordingChanged) {
      data.recordingUrl = dto.recordingUrl;
      data.recordingPublishedAt = dto.recordingUrl ? nowUtc() : null;
    }
    const updated = await this.prisma.offerSession.update({ where: { id: sessionId }, data });

    let notifiedCount = 0;
    if (recordingChanged && updated.recordingUrl && dto.notifyRecording !== false) {
      notifiedCount = await this.notifyEnrolled(
        offer,
        `recording:${sessionId}`,
        (tz) =>
          recordingPublishedMessage({
            offerName: offer.name,
            startsAt: updated.startsAt,
            userTimezone: tz,
          }),
        {
          label: 'Ver grabación',
          path: updated.moduleId
            ? PORTAL_LINKS.materials(offer.id, updated.moduleId)
            : PORTAL_LINKS.sessions(),
        },
        { offerId: offer.id, sessionId, moduleId: updated.moduleId },
      );
    }
    await this.audit.record({
      actor: user,
      action:
        recordingChanged && updated.recordingUrl ? 'session.publish-recording' : 'session.update',
      entityType: 'OfferSession',
      entityId: sessionId,
      summary:
        recordingChanged && updated.recordingUrl
          ? `Publicó la grabación de una sesión de «${offer.name}» (notificados: ${notifiedCount}).`
          : `Editó una sesión de «${offer.name}».`,
      before: session,
      after: { ...data },
    });
    return { session: await this.get(sessionId), notifiedCount };
  }

  async reschedule(
    sessionId: string,
    dto: RescheduleSessionRequestDto,
    user: AdminUser,
  ): Promise<SessionChangeResultDto> {
    const session = await this.requireSession(sessionId);
    if (session.status === 'CANCELLED') throw new AppException('SESSION_CANCELLED');
    const offer = await this.requireOffer(session.offerId);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    const issues = this.rangeIssues(startsAt, endsAt);
    if (issues.length) throw AppException.validation(issues);
    await this.assertNoOverlap(offer.id, { startsAt, endsAt }, sessionId);
    const reason = dto.reason.trim();
    try {
      await this.prisma.offerSession.update({
        where: { id: sessionId },
        data: {
          startsAt,
          endsAt,
          originalStartsAt: session.originalStartsAt ?? session.startsAt,
          changeReason: reason,
          // La ventana de asistencia vuelve a abrir al nuevo fin: el aviso se reenvía.
          attendanceNotifiedAt: null,
        },
      });
    } catch (error) {
      throw this.uniqueToConflict(error);
    }
    const notifiedCount = await this.notifyEnrolled(
      offer,
      `session-rescheduled:${sessionId}:${startsAt.getTime()}`,
      (tz) =>
        sessionRescheduledMessage({
          offerName: offer.name,
          previousStartsAt: session.startsAt,
          startsAt,
          reason,
          userTimezone: tz,
        }),
      { label: 'Ver mis sesiones', path: PORTAL_LINKS.sessions() },
      { offerId: offer.id, sessionId, startsAt: startsAt.toISOString() },
    );
    await this.audit.record({
      actor: user,
      action: 'session.reschedule',
      entityType: 'OfferSession',
      entityId: sessionId,
      summary: `Reprogramó una sesión de «${offer.name}» (notificados: ${notifiedCount}).`,
      before: { startsAt: session.startsAt, endsAt: session.endsAt },
      after: { startsAt, endsAt, changeReason: reason },
    });
    return { session: await this.get(sessionId), notifiedCount };
  }

  async cancel(
    sessionId: string,
    dto: CancelSessionRequestDto,
    user: AdminUser,
  ): Promise<SessionChangeResultDto> {
    const session = await this.requireSession(sessionId);
    const offer = await this.requireOffer(session.offerId);
    const reason = dto.reason.trim();
    const now = nowUtc();
    const updated = await this.prisma.offerSession.updateMany({
      where: { id: sessionId, status: 'SCHEDULED' },
      data: { status: 'CANCELLED', cancelledAt: now, changeReason: reason },
    });
    if (updated.count === 0) throw new AppException('SESSION_CANCELLED');
    const notifiedCount = await this.notifyEnrolled(
      offer,
      `session-cancelled:${sessionId}`,
      (tz) =>
        sessionCancelledMessage({
          offerName: offer.name,
          startsAt: session.startsAt,
          reason,
          userTimezone: tz,
        }),
      { label: 'Ver calendario', path: PORTAL_LINKS.calendar() },
      { offerId: offer.id, sessionId },
    );
    await this.audit.record({
      actor: user,
      action: 'session.cancel',
      entityType: 'OfferSession',
      entityId: sessionId,
      summary: `Canceló una sesión de «${offer.name}» (notificados: ${notifiedCount}).`,
      before: { status: session.status },
      after: { status: 'CANCELLED', changeReason: reason },
    });
    return { session: await this.get(sessionId), notifiedCount };
  }

  async remove(sessionId: string, user: AdminUser): Promise<void> {
    const session = await this.requireSession(sessionId);
    if (session._count.attendances > 0) throw new AppException('SESSION_HAS_ATTENDANCE');
    await this.prisma.offerSession.delete({ where: { id: sessionId } });
    await this.audit.record({
      actor: user,
      action: 'session.delete',
      entityType: 'OfferSession',
      entityId: sessionId,
      summary: 'Borró una sesión sin asistencias.',
      before: {
        offerId: session.offerId,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        status: session.status,
      },
    });
  }

  // ------------------------------------------------------------------------------------------------

  private async requireOffer(offerId: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      select: {
        id: true,
        name: true,
        modality: true,
        attendanceWindowHours: true,
        calendarCategory: true,
      },
    });
    if (!offer) throw AppException.notFound('La oferta no existe.');
    return offer;
  }

  private async requireSession(sessionId: string): Promise<AdminSessionRow> {
    const session = await this.prisma.offerSession.findUnique({
      where: { id: sessionId },
      include: ADMIN_SESSION_INCLUDE,
    });
    if (!session) throw AppException.notFound('La sesión no existe.');
    return session;
  }

  private async requireModule(
    offerId: string,
    moduleId: string,
    issues: Array<{ field: string; code: string; message: string }>,
  ): Promise<void> {
    const module = await this.prisma.offerModule.findFirst({ where: { id: moduleId, offerId } });
    if (!module)
      issues.push({
        field: 'moduleId',
        code: 'INVALID',
        message: 'El módulo no pertenece a esta oferta.',
      });
  }

  private async context(offer: {
    id: string;
    modality: OfferModality;
    attendanceWindowHours: number;
  }) {
    const [modules, enrolled] = await Promise.all([
      this.prisma.offerModule.findMany({
        where: { offerId: offer.id },
        select: { id: true, position: true, title: true },
      }),
      this.prisma.enrollment.count({
        where: { offerId: offer.id, status: { in: [...ROSTER_STATUSES] } },
      }),
    ]);
    return {
      modality: offer.modality,
      offerWindowHours: offer.attendanceWindowHours,
      modules: moduleNumbers(modules),
      enrolled,
      now: nowUtc(),
    };
  }

  private rangeIssues(startsAt: Date, endsAt: Date) {
    const issues: Array<{ field: string; code: string; message: string }> = [];
    if (endsAt.getTime() <= startsAt.getTime()) {
      issues.push({
        field: 'endsAt',
        code: 'INVALID',
        message: 'El fin debe ser posterior al inicio.',
      });
    }
    return issues;
  }

  /** HU-29: enlaces solo en línea y de zoom.us o meet.google.com. */
  private linkIssues(
    modality: OfferModality,
    links: { joinUrl?: string | null; hostUrl?: string | null },
  ) {
    const issues: Array<{ field: string; code: string; message: string }> = [];
    for (const field of ['joinUrl', 'hostUrl'] as const) {
      const value = links[field];
      if (!value) continue;
      if (modality !== 'ONLINE_LIVE') {
        issues.push({
          field,
          code: 'NOT_APPLICABLE',
          message: 'Las sesiones presenciales no llevan enlace.',
        });
      } else if (!isMeetingUrl(value)) {
        issues.push({
          field,
          code: 'INVALID_MEETING_URL',
          message: 'Usa un enlace https de zoom.us o meet.google.com.',
        });
      }
    }
    return issues;
  }

  private async assertNoOverlap(
    offerId: string,
    slot: { startsAt: Date; endsAt: Date },
    excludeId?: string,
  ): Promise<void> {
    const others = await this.prisma.offerSession.findMany({
      where: { offerId, status: 'SCHEDULED', ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true, startsAt: true, endsAt: true },
    });
    const clash = others.find((o) => overlaps(slot, o));
    if (clash) {
      throw new AppException('SESSION_CONFLICT', {
        meta: { sessionId: clash.id, startsAt: clash.startsAt.toISOString() },
      });
    }
  }

  private uniqueToConflict(error: unknown): unknown {
    if ((error as { code?: string } | null)?.code === 'P2002') {
      return new AppException('SESSION_CONFLICT');
    }
    return error;
  }

  /**
   * Avisa a los inscritos con acceso (ACTIVE, COMPLETED) con el texto en la zona de cada persona
   * (un `notify` por zona; `dedupeKey` evita duplicados). Nunca rompe la acción ya guardada.
   */
  private async notifyEnrolled(
    offer: { id: string },
    dedupeKey: string,
    message: (timezone: string) => SessionMessage,
    action: { label: string; path: string },
    data: Record<string, string | null>,
  ): Promise<number> {
    try {
      const enrollments = await this.prisma.enrollment.findMany({
        where: { offerId: offer.id, status: { in: [...CLASSROOM_ACCESS_STATUSES] } },
        select: { user: { select: { id: true, timezone: true } } },
      });
      let count = 0;
      for (const [timezone, users] of groupByTimezone(enrollments.map((e) => e.user))) {
        const created = await this.notifications.notify({
          userIds: users.map((u) => u.id),
          ...message(timezone),
          action,
          data,
          dedupeKey,
        });
        count += created.length;
      }
      return count;
    } catch (error) {
      this.logger.error({ err: error, dedupeKey }, 'No se pudo notificar el cambio de sesión');
      return 0;
    }
  }
}
