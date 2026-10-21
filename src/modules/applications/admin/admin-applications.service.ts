import { Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import type { AdminUser } from '../../../common/guards/permissions.guard';
import { paginate, type PaginatedResponseDto } from '../../../common/dto/pagination.dto';
import { toCsv } from '../../../common/utils/csv';
import { isCurrency, type Money } from '../../../common/utils/money';
import { formatInZone, nowUtc, OFFICIAL_TIMEZONE } from '../../../common/utils/time';
import { isZoomUrl } from '../../../common/utils/urls';
import { BUSINESS_RULES } from '../../../config/business-rules';
import { Permission } from '../../../config/permissions';
import type {
  Application,
  ApplicationStatus,
  Prisma,
  ScholarshipLevel,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { StorageService } from '../../../infra/storage/storage.service';
import { AuditService } from '../../audit/audit.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { SCHOLARSHIP_LEVEL_ORDER } from '../../offers/policies/scholarship.policy';
import { ApplicationWorkflowService } from '../application-workflow.service';
import { statusChangeMessage } from '../policies/application-messages.policy';
import {
  balanceAfterScholarship,
  formatFolio,
  interviewRequired,
  resolveAssignedPercent,
  responseDeadline,
} from '../policies/application-rules.policy';
import {
  APPLICATION_STATUS_LABELS,
  UNDER_REVIEW_STATUSES,
} from '../policies/application-status.policy';
import {
  SENT_STATUSES,
  type AdminApplicationDetailDto,
  type AdminApplicationEmailDto,
  type AdminApplicationListItemDto,
  type AdminEvaluationDto,
  type ApproveApplicationRequestDto,
  type DecisionPreviewDto,
  type DecisionPreviewQueryDto,
  type ListAdminApplicationsQueryDto,
  type RejectApplicationRequestDto,
  type RetryEmailResultDto,
  type ScheduleInterviewRequestDto,
  type UpsertEvaluationRequestDto,
} from './dto/admin-applications.dto';
import {
  applicationRequiresInterview,
  summarizeEvaluations,
} from './policies/admin-applications.policy';

const LIST_INCLUDE = {
  offer: { select: { id: true, name: true, slug: true } },
  interviews: {
    where: { status: { not: 'CANCELLED' } },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { status: true, startsAt: true },
  },
  evaluations: { select: { evaluatorId: true, recommendation: true } },
} as const satisfies Prisma.ApplicationInclude;

type ListRow = Prisma.ApplicationGetPayload<{ include: typeof LIST_INCLUDE }>;

const PERSON = { select: { id: true, fullName: true } } as const;

/** Máximo de filas de la exportación CSV. */
const EXPORT_MAX_ROWS = 5000;

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/**
 * Revisión de postulaciones en equipo (HU-31). Las transiciones SIEMPRE pasan por
 * `ApplicationWorkflowService` (máquina de estados, historial, inscripción y avisos).
 */
@Injectable()
export class AdminApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly workflow: ApplicationWorkflowService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  // --- Bandeja ---------------------------------------------------------------------------------------

  async list(
    user: AdminUser,
    query: ListAdminApplicationsQueryDto,
  ): Promise<PaginatedResponseDto<AdminApplicationListItemDto>> {
    const where = this.where(user, query);
    const [rows, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: orderBy(query.sort),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.application.count({ where }),
    ]);
    return paginate(
      rows.map((row) => toListItem(row, user.id)),
      total,
      query,
    );
  }

  async exportCsv(user: AdminUser, query: ListAdminApplicationsQueryDto): Promise<string> {
    const rows = await this.prisma.application.findMany({
      where: this.where(user, query),
      include: LIST_INCLUDE,
      orderBy: orderBy(query.sort),
      take: EXPORT_MAX_ROWS,
    });
    const fmt = (d: Date | null) =>
      d ? formatInZone(d, OFFICIAL_TIMEZONE, 'yyyy-MM-dd HH:mm') : '';
    return toCsv(rows, [
      { header: 'Folio', value: (r) => formatFolio(r.kind, r.number) },
      { header: 'Tipo', value: (r) => (r.kind === 'SCHOLARSHIP' ? 'Beca' : 'Convocatoria') },
      { header: 'Estado', value: (r) => APPLICATION_STATUS_LABELS[r.status] },
      { header: 'Nombre', value: (r) => r.applicantName },
      { header: 'Correo', value: (r) => r.applicantEmail },
      { header: 'Teléfono', value: (r) => `${r.phoneCountryCode} ${r.phoneNumber}` },
      { header: 'País', value: (r) => r.countryCode },
      { header: 'Estado/Provincia', value: (r) => r.divisionName },
      { header: 'Municipio/Ciudad', value: (r) => r.municipalityName },
      { header: 'Oferta', value: (r) => r.offer.name },
      { header: 'Nivel solicitado', value: (r) => levelLabel(r.requestedLevel) },
      { header: 'Nivel asignado', value: (r) => levelLabel(r.assignedLevel) },
      { header: '% asignado', value: (r) => r.assignedPercent },
      { header: 'Saldo (centavos)', value: (r) => r.balanceCents },
      { header: 'Moneda', value: (r) => r.currency },
      { header: 'Enviada (CDMX)', value: (r) => fmt(r.submittedAt) },
      { header: 'Plazo (CDMX)', value: (r) => fmt(r.responseDueAt) },
      { header: 'Evaluaciones', value: (r) => r.evaluations.length },
      {
        header: 'Requiere entrevista',
        value: (r) => (applicationRequiresInterview(r) ? 'Sí' : 'No'),
      },
      { header: 'Entrevista', value: (r) => r.interviews[0]?.status ?? '' },
    ]);
  }

  // --- Detalle ---------------------------------------------------------------------------------------

  /** HU-31: al abrir el detalle por primera vez pasa a "En revisión" (si puede evaluar o decidir). */
  async detail(user: AdminUser, applicationId: string): Promise<AdminApplicationDetailDto> {
    const app = await this.requireSent(applicationId);
    let reviewStarted = false;
    const reviewer =
      user.permissions.includes(Permission.APPLICATIONS_EVALUATE) ||
      user.permissions.includes(Permission.APPLICATIONS_DECIDE);
    if (reviewer && app.status === 'SUBMITTED') {
      await this.workflow.startReview(applicationId, user.id);
      reviewStarted = true;
      await this.audit.record({
        actor: user,
        action: 'application.start-review',
        entityType: 'Application',
        entityId: applicationId,
        summary: `Abrió la postulación ${formatFolio(app.kind, app.number)}: pasó a "En revisión".`,
        before: { status: 'SUBMITTED' },
        after: { status: 'IN_REVIEW' },
      });
    }
    return this.buildDetail(user, applicationId, reviewStarted);
  }

  // --- Evaluaciones ----------------------------------------------------------------------------------

  async upsertEvaluation(
    user: AdminUser,
    applicationId: string,
    dto: UpsertEvaluationRequestDto,
  ): Promise<AdminApplicationDetailDto> {
    const app = await this.requireSent(applicationId);
    if (!(UNDER_REVIEW_STATUSES as readonly string[]).includes(app.status)) {
      throw new AppException('APPLICATION_INVALID_STATE', { meta: { status: app.status } });
    }
    if (dto.suggestedLevel) {
      if (app.kind !== 'SCHOLARSHIP') {
        throw AppException.validation([
          { field: 'suggestedLevel', code: 'NOT_APPLICABLE', message: 'Solo aplica a becas.' },
        ]);
      }
      if (!app.offer.scholarshipLevels.includes(dto.suggestedLevel)) {
        throw AppException.validation([
          {
            field: 'suggestedLevel',
            code: 'LEVEL_NOT_ENABLED',
            message: 'El nivel no está habilitado en esta oferta.',
          },
        ]);
      }
    }
    const data = {
      recommendation: dto.recommendation,
      suggestedLevel: dto.suggestedLevel ?? null,
      comment: dto.comment?.trim() || null,
    };
    const previous = await this.prisma.applicationEvaluation.findUnique({
      where: { applicationId_evaluatorId: { applicationId, evaluatorId: user.id } },
    });
    await this.prisma.applicationEvaluation.upsert({
      where: { applicationId_evaluatorId: { applicationId, evaluatorId: user.id } },
      create: { applicationId, evaluatorId: user.id, ...data },
      update: data,
    });
    await this.audit.record({
      actor: user,
      action: 'application.evaluate',
      entityType: 'Application',
      entityId: applicationId,
      summary: `Evaluó la postulación ${formatFolio(app.kind, app.number)} (${dto.recommendation}).`,
      before: previous
        ? {
            recommendation: previous.recommendation,
            suggestedLevel: previous.suggestedLevel,
            comment: previous.comment,
          }
        : null,
      after: data,
    });
    return this.buildDetail(user, applicationId, false);
  }

  // --- Entrevistas -----------------------------------------------------------------------------------

  async scheduleInterview(
    user: AdminUser,
    applicationId: string,
    dto: ScheduleInterviewRequestDto,
  ): Promise<AdminApplicationDetailDto> {
    if (!isZoomUrl(dto.joinUrl)) {
      throw AppException.validation([
        { field: 'joinUrl', code: 'INVALID', message: 'Usa un enlace https de zoom.us.' },
      ]);
    }
    const app = await this.requireSent(applicationId);
    const input = {
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
      joinUrl: dto.joinUrl,
    };
    await adminTransition(() => this.workflow.scheduleInterview(applicationId, input, user.id));
    await this.audit.record({
      actor: user,
      action:
        app.status === 'INTERVIEW_SCHEDULED'
          ? 'application.reschedule-interview'
          : 'application.schedule-interview',
      entityType: 'Application',
      entityId: applicationId,
      summary: `Agendó la entrevista por Zoom de ${formatFolio(app.kind, app.number)}.`,
      before: { status: app.status },
      after: { status: 'INTERVIEW_SCHEDULED', startsAt: input.startsAt, endsAt: input.endsAt },
    });
    return this.buildDetail(user, applicationId, false);
  }

  async completeInterview(
    user: AdminUser,
    applicationId: string,
    outcome: 'COMPLETED' | 'NO_SHOW',
  ): Promise<AdminApplicationDetailDto> {
    const app = await this.requireSent(applicationId);
    await this.workflow.completeInterview(applicationId, user.id, outcome);
    await this.audit.record({
      actor: user,
      action: 'application.complete-interview',
      entityType: 'Application',
      entityId: applicationId,
      summary: `Marcó la entrevista de ${formatFolio(app.kind, app.number)} como ${outcome === 'COMPLETED' ? '"Realizada"' : '"No asistió"'}.`,
      after: { interviewStatus: outcome },
    });
    return this.buildDetail(user, applicationId, false);
  }

  async cancelInterview(
    user: AdminUser,
    applicationId: string,
    note?: string,
  ): Promise<AdminApplicationDetailDto> {
    const app = await this.requireSent(applicationId);
    await adminTransition(() => this.workflow.cancelInterview(applicationId, user.id, note));
    await this.audit.record({
      actor: user,
      action: 'application.cancel-interview',
      entityType: 'Application',
      entityId: applicationId,
      summary: `Canceló la entrevista de ${formatFolio(app.kind, app.number)}.`,
      before: { status: app.status },
      after: { status: 'IN_REVIEW', note: note ?? null },
    });
    return this.buildDetail(user, applicationId, false);
  }

  // --- Decisión --------------------------------------------------------------------------------------

  async decisionPreview(
    applicationId: string,
    query: DecisionPreviewQueryDto,
  ): Promise<DecisionPreviewDto> {
    const app = await this.requireSent(applicationId);
    const ctx = await this.workflow.messageContext(app);
    const hasInterview = app.interviews.some((i) => i.status === 'COMPLETED');
    if (query.decision === 'REJECT') {
      const message = statusChangeMessage('NOT_SELECTED', ctx)!;
      return {
        decision: 'REJECT',
        status: 'NOT_SELECTED',
        assignedLevel: null,
        assignedPercent: null,
        balance: null,
        responseDueAt: null,
        interviewRequired: false,
        blockedReason: null,
        email: { subject: message.title, body: withMessage(message.body, query.message) },
      };
    }
    let assignedPercent: number | null = null;
    let assignedLevel: ScholarshipLevel | null = null;
    if (app.kind === 'SCHOLARSHIP') {
      if (!query.assignedLevel) {
        throw AppException.validation([
          { field: 'assignedLevel', code: 'REQUIRED', message: 'Elige el nivel asignado.' },
        ]);
      }
      const resolved = resolveAssignedPercent(
        query.assignedLevel,
        app.offer.scholarshipLevels,
        query.assignedPercent,
      );
      if (!resolved.ok) {
        throw AppException.validation([
          { field: 'assignedPercent', code: 'INVALID', message: resolved.message },
        ]);
      }
      assignedLevel = query.assignedLevel;
      assignedPercent = resolved.percent;
    }
    const balanceCents =
      app.kind === 'SCHOLARSHIP'
        ? balanceAfterScholarship(app.originalAmountCents, assignedPercent ?? 0)
        : Math.max(app.originalAmountCents ?? 0, 0);
    const kind = balanceCents > 0 ? 'PAYMENT' : 'CONFIRMATION';
    const status: ApplicationStatus =
      kind === 'PAYMENT' ? 'APPROVED_PENDING_PAYMENT' : 'APPROVED_PENDING_CONFIRMATION';
    const responseDueAt = responseDeadline(nowUtc(), kind, app.offer.startsAt);
    const balance = money(balanceCents, app.currency);
    const message = statusChangeMessage(status, {
      ...ctx,
      assignedLevel,
      assignedPercent,
      balance,
      responseDueAt,
    })!;
    const required = interviewRequired(app.kind, assignedPercent);
    return {
      decision: 'APPROVE',
      status,
      assignedLevel,
      assignedPercent,
      balance,
      responseDueAt: responseDueAt.toISOString(),
      interviewRequired: required,
      blockedReason: required && !hasInterview ? 'APPLICATION_INTERVIEW_REQUIRED' : null,
      email: { subject: message.title, body: withMessage(message.body, query.message) },
    };
  }

  async approve(
    user: AdminUser,
    applicationId: string,
    dto: ApproveApplicationRequestDto,
  ): Promise<AdminApplicationDetailDto> {
    const app = await this.requireSent(applicationId);
    const updated = await adminTransition(() =>
      this.workflow.approve(
        applicationId,
        {
          assignedLevel: dto.assignedLevel ?? null,
          assignedPercent: dto.assignedPercent ?? null,
          note: dto.note ?? null,
          participantMessage: dto.message ?? null,
        },
        user.id,
      ),
    );
    await this.audit.record({
      actor: user,
      action: 'application.approve',
      entityType: 'Application',
      entityId: applicationId,
      summary: `Aprobó la postulación ${formatFolio(app.kind, app.number)}${updated.assignedPercent ? ` (${updated.assignedPercent}%)` : ''}.`,
      before: { status: app.status },
      after: {
        status: updated.status,
        assignedLevel: updated.assignedLevel,
        assignedPercent: updated.assignedPercent,
        balanceCents: updated.balanceCents,
        responseDueAt: updated.responseDueAt,
        note: dto.note ?? null,
      },
    });
    return this.buildDetail(user, applicationId, false);
  }

  async reject(
    user: AdminUser,
    applicationId: string,
    dto: RejectApplicationRequestDto,
  ): Promise<AdminApplicationDetailDto> {
    const app = await this.requireSent(applicationId);
    await adminTransition(() =>
      this.workflow.reject(applicationId, user.id, dto.note, dto.message ?? null),
    );
    await this.audit.record({
      actor: user,
      action: 'application.reject',
      entityType: 'Application',
      entityId: applicationId,
      summary: `Registró "No seleccionada" en ${formatFolio(app.kind, app.number)}.`,
      before: { status: app.status },
      after: { status: 'NOT_SELECTED', note: dto.note ?? null },
    });
    return this.buildDetail(user, applicationId, false);
  }

  /** HU-31 "Reintentar envío": reenvía el correo fallido (sin perder ni repetir la decisión). */
  async retryEmail(
    user: AdminUser,
    applicationId: string,
    notificationId?: string,
  ): Promise<RetryEmailResultDto> {
    const app = await this.requireSent(applicationId);
    const target = notificationId
      ? await this.prisma.notification.findFirst({
          where: { id: notificationId, ...this.notificationsWhere(app) },
        })
      : await this.prisma.notification.findFirst({
          where: { ...this.notificationsWhere(app), emailStatus: 'FAILED' },
          orderBy: { createdAt: 'desc' },
        });
    if (!target) {
      if (notificationId) throw AppException.notFound('La notificación no existe.');
      throw new AppException('NOTIFICATION_EMAIL_NOT_FAILED');
    }
    const result = await this.notifications.retryEmail(target.id);
    await this.audit.record({
      actor: user,
      action: 'application.retry-email',
      entityType: 'Application',
      entityId: applicationId,
      summary: `Reintentó el correo "${target.title}" de ${formatFolio(app.kind, app.number)}: ${result.emailStatus}.`,
      before: { emailStatus: target.emailStatus },
      after: { notificationId: target.id, emailStatus: result.emailStatus },
    });
    return {
      notificationId: result.id,
      emailStatus: result.emailStatus,
      emailSentAt: iso(result.emailSentAt),
    };
  }

  // ------------------------------------------------------------------------------------------------

  private where(user: AdminUser, q: ListAdminApplicationsQueryDto): Prisma.ApplicationWhereInput {
    const and: Prisma.ApplicationWhereInput[] = [
      { status: { in: q.status?.length ? q.status : SENT_STATUSES } },
    ];
    if (q.kind) and.push({ kind: q.kind });
    if (q.offerId) and.push({ offerId: q.offerId });
    if (q.level) and.push({ requestedLevel: q.level });
    if (q.countryCode) and.push({ countryCode: q.countryCode.toUpperCase() });
    if (q.withoutMyEvaluation) and.push({ evaluations: { none: { evaluatorId: user.id } } });
    const interview: Prisma.ApplicationWhereInput = {
      OR: [
        { kind: 'OPEN_CALL' },
        { assignedPercent: { gt: BUSINESS_RULES.SCHOLARSHIP_INTERVIEW_REQUIRED_ABOVE_PERCENT } },
        { assignedPercent: null, requestedLevel: { in: levelsRequiringInterview() } },
      ],
    };
    if (q.requiresInterview === true) and.push(interview);
    if (q.requiresInterview === false) and.push({ NOT: interview });
    const text = q.q?.trim();
    if (text) {
      const folio = /^(?:BEC|CONV)-?0*(\d+)$/i.exec(text);
      and.push({
        OR: [
          { applicantName: { contains: text, mode: 'insensitive' } },
          { applicantEmail: { contains: text, mode: 'insensitive' } },
          ...(folio ? [{ number: Number(folio[1]) }] : []),
        ],
      });
    }
    return { AND: and };
  }

  private async requireSent(applicationId: string) {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        offer: { select: { startsAt: true, scholarshipLevels: true } },
        interviews: { select: { status: true } },
      },
    });
    if (!app || app.status === 'DRAFT') throw AppException.notFound('La postulación no existe.');
    return app;
  }

  private notificationsWhere(app: Application): Prisma.NotificationWhereInput {
    return { userId: app.userId, data: { path: ['applicationId'], equals: app.id } };
  }

  private async buildDetail(
    user: AdminUser,
    applicationId: string,
    reviewStarted: boolean,
  ): Promise<AdminApplicationDetailDto> {
    const row = await this.prisma.application.findUniqueOrThrow({
      where: { id: applicationId },
      include: {
        ...LIST_INCLUDE,
        offer: {
          select: {
            id: true,
            name: true,
            slug: true,
            scholarshipLevels: true,
            priceMxnCents: true,
            priceUsdCents: true,
          },
        },
        documents: { orderBy: { createdAt: 'asc' } },
        statusEvents: { orderBy: { createdAt: 'asc' }, include: { actor: PERSON } },
        decidedBy: PERSON,
      },
    });
    const [interviews, evaluations, emails, neighbours] = await Promise.all([
      this.prisma.applicationInterview.findMany({
        where: { applicationId },
        orderBy: { createdAt: 'desc' },
        include: { scheduledBy: PERSON },
      }),
      this.prisma.applicationEvaluation.findMany({
        where: { applicationId },
        orderBy: { updatedAt: 'asc' },
        include: { evaluator: PERSON },
      }),
      this.prisma.notification.findMany({
        where: this.notificationsWhere(row),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.application.findMany({
        where: { kind: row.kind, status: { in: SENT_STATUSES } },
        orderBy: [{ submittedAt: 'asc' }, { number: 'asc' }],
        select: { id: true },
      }),
    ]);
    const documents = await Promise.all(
      row.documents.map(async (d) => {
        const signed = await this.storage.getDownloadUrl(d.fileKey, {
          expiresInSeconds: BUSINESS_RULES.PRIVATE_FILE_URL_TTL_SECONDS,
          downloadFileName: d.fileName,
        });
        return {
          id: d.id,
          fileName: d.fileName,
          mimeType: d.mimeType,
          sizeBytes: d.sizeBytes,
          url: signed.url,
          expiresAt: signed.expiresAt,
        };
      }),
    );
    const evaluationDtos: AdminEvaluationDto[] = evaluations.map((e) => ({
      id: e.id,
      evaluator: e.evaluator,
      recommendation: e.recommendation,
      suggestedLevel: e.suggestedLevel,
      comment: e.comment,
      updatedAt: e.updatedAt.toISOString(),
    }));
    const emailDtos: AdminApplicationEmailDto[] = emails.map((n) => ({
      notificationId: n.id,
      type: n.type,
      title: n.title,
      emailStatus: n.emailStatus,
      emailSentAt: iso(n.emailSentAt),
      createdAt: n.createdAt.toISOString(),
    }));
    const decisionEmail = emails.find(
      (n) => (n.data as Record<string, unknown> | null)?.status === row.status,
    );
    const hasCompletedInterview = interviews.some((i) => i.status === 'COMPLETED');
    const required = applicationRequiresInterview(row);
    const priceCents =
      row.originalAmountCents ??
      (row.currency === 'USD' ? row.offer.priceUsdCents : row.offer.priceMxnCents);
    const levels = SCHOLARSHIP_LEVEL_ORDER.filter(
      (l) => row.kind === 'SCHOLARSHIP' && row.offer.scholarshipLevels.includes(l),
    ).map((level) => {
      const def = BUSINESS_RULES.SCHOLARSHIP_LEVELS[level];
      return {
        level,
        label: def.label,
        minPercent: def.minPercent,
        maxPercent: def.maxPercent,
        requiresInterview: interviewRequired('SCHOLARSHIP', def.maxPercent),
        balanceAtMaxPercent: money(
          balanceAfterScholarship(priceCents, def.maxPercent),
          row.currency,
        ),
      };
    });
    const canDecide =
      user.permissions.includes(Permission.APPLICATIONS_DECIDE) &&
      (UNDER_REVIEW_STATUSES as readonly string[]).includes(row.status);
    const index = neighbours.findIndex((n) => n.id === row.id);
    const mine = evaluationDtos.find((e) => e.evaluator.id === user.id) ?? null;
    return {
      ...toListItem(row, user.id),
      contact: {
        name: row.applicantName,
        email: row.applicantEmail,
        phoneCountryCode: row.phoneCountryCode,
        phoneNumber: row.phoneNumber,
        countryCode: row.countryCode,
        divisionName: row.divisionName,
        municipalityName: row.municipalityName,
        age: row.age,
        organization: row.organization,
        organizationRole: row.organizationRole,
        partnerCode: row.partnerCode,
      },
      answers: {
        intentLetter: row.intentLetter,
        experience: row.experience,
        motivation: row.motivation,
        canTravel: row.canTravel,
        eligibilityConfirmed: row.eligibilityConfirmed,
        evidenceLinks: row.evidenceLinks,
      },
      documents,
      history: row.statusEvents.map((e) => ({
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        actorType: e.actorType,
        actor: e.actor,
        note: e.note,
        at: e.createdAt.toISOString(),
      })),
      interviews: interviews.map((i) => ({
        id: i.id,
        status: i.status,
        startsAt: i.startsAt.toISOString(),
        endsAt: i.endsAt.toISOString(),
        joinUrl: i.joinUrl,
        completedAt: iso(i.completedAt),
        scheduledBy: i.scheduledBy,
      })),
      evaluations: evaluationDtos,
      evaluationSummary: summarizeEvaluations(evaluations),
      myEvaluationDetail: mine,
      decision: {
        canDecide,
        interviewRequired: required,
        hasCompletedInterview,
        blockedReason: required && !hasCompletedInterview ? 'APPLICATION_INTERVIEW_REQUIRED' : null,
        price: money(priceCents, row.currency),
        levels,
        assignedLevel: row.assignedLevel,
        assignedPercent: row.assignedPercent,
        balance: money(row.balanceCents, row.currency),
        responseDueAt: iso(row.responseDueAt),
        decidedAt: iso(row.decidedAt),
        decidedBy: row.decidedBy,
        decisionNote: row.decisionNote,
        emailStatus: decisionEmail?.emailStatus ?? null,
      },
      emails: emailDtos,
      prevId: index > 0 ? neighbours[index - 1].id : null,
      nextId: index >= 0 && index < neighbours.length - 1 ? neighbours[index + 1].id : null,
      reviewStarted,
    };
  }
}

function toListItem(row: ListRow, userId: string): AdminApplicationListItemDto {
  const interview = row.interviews[0] ?? null;
  return {
    id: row.id,
    folio: formatFolio(row.kind, row.number),
    kind: row.kind,
    status: row.status,
    applicant: {
      userId: row.userId,
      name: row.applicantName,
      email: row.applicantEmail,
      countryCode: row.countryCode,
    },
    offer: { id: row.offer.id, name: row.offer.name, slug: row.offer.slug },
    requestedLevel: row.requestedLevel,
    assignedLevel: row.assignedLevel,
    assignedPercent: row.assignedPercent,
    submittedAt: iso(row.submittedAt),
    requiresInterview: applicationRequiresInterview(row),
    interview: interview
      ? { status: interview.status, startsAt: interview.startsAt.toISOString() }
      : null,
    evaluationCount: row.evaluations.length,
    myEvaluation: row.evaluations.find((e) => e.evaluatorId === userId)?.recommendation ?? null,
    responseDueAt: iso(row.responseDueAt),
  };
}

function orderBy(
  sort: ListAdminApplicationsQueryDto['sort'],
): Prisma.ApplicationOrderByWithRelationInput[] {
  switch (sort) {
    case 'SUBMITTED_DESC':
      return [{ submittedAt: 'desc' }, { number: 'desc' }];
    case 'DUE_ASC':
      return [{ responseDueAt: { sort: 'asc', nulls: 'last' } }, { number: 'asc' }];
    default:
      return [{ submittedAt: 'asc' }, { number: 'asc' }];
  }
}

function levelsRequiringInterview(): ScholarshipLevel[] {
  return SCHOLARSHIP_LEVEL_ORDER.filter(
    (l) =>
      BUSINESS_RULES.SCHOLARSHIP_LEVELS[l].maxPercent >
      BUSINESS_RULES.SCHOLARSHIP_INTERVIEW_REQUIRED_ABOVE_PERCENT,
  );
}

function levelLabel(level: ScholarshipLevel | null): string {
  return level ? BUSINESS_RULES.SCHOLARSHIP_LEVELS[level].label : '';
}

function money(cents: number | null | undefined, currency: string | null): Money | null {
  if (cents === null || cents === undefined || !currency || !isCurrency(currency)) return null;
  return { amountCents: cents, currency };
}

function withMessage(body: string, message?: string): string {
  const extra = message?.trim();
  return extra ? `${body}\n\n${extra}` : body;
}

/**
 * Traduce el error de transición del workflow (redactado para el participante) al del panel:
 * `APPLICATION_INVALID_TRANSITION` → 409 `APPLICATION_INVALID_STATE` con el mismo `meta`.
 */
export async function adminTransition<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AppException && error.code === 'APPLICATION_INVALID_TRANSITION') {
      throw new AppException('APPLICATION_INVALID_STATE', { meta: error.meta });
    }
    throw error;
  }
}
