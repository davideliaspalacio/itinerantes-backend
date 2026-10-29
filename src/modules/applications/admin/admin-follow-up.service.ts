import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../../common/errors/app.exception';
import type { AdminUser } from '../../../common/guards/permissions.guard';
import { paginate, type PaginatedResponseDto } from '../../../common/dto/pagination.dto';
import { formatMoney, isCurrency, type Money } from '../../../common/utils/money';
import { formatInZone, nowUtc, OFFICIAL_TIMEZONE } from '../../../common/utils/time';
import { type Env, portalBaseUrl } from '../../../config/env.schema';
import type {
  ApplicationFollowUpNote,
  FollowUpNoteKind,
  FollowUpOutcome,
  Prisma,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { SEAT_HOLDING_STATUSES } from '../../enrollments/policies/enrollment.policy';
import { NotificationsService } from '../../notifications/notifications.service';
import { frontendLink } from '../../notifications/notifications.policy';
import { PORTAL_LINKS } from '../../notifications/portal-links';
import { effectiveEnrollmentClose } from '../../offers/policies/offer-status.policy';
import { ApplicationWorkflowService } from '../application-workflow.service';
import {
  balanceReminderMessage,
  statusChangeMessage,
} from '../policies/application-messages.policy';
import { formatFolio } from '../policies/application-rules.policy';
import {
  APPLICATION_STATUS_LABELS,
  AWAITING_RESPONSE_STATUSES,
  isAwaitingResponse,
} from '../policies/application-status.policy';
import { adminTransition } from './admin-applications.service';
import type {
  CloseEnrollmentResultDto,
  FollowUpDetailDto,
  FollowUpItemDto,
  FollowUpNoteDto,
  FollowUpNotesDto,
  FollowUpTimelineItemDto,
  FunnelOfferDto,
  ListFollowUpsQueryDto,
  ListFunnelOffersQueryDto,
  OfferFunnelDto,
  ReminderResultDto,
  WhatsappResultDto,
} from './dto/admin-follow-up.dto';
import {
  computeFunnel,
  DEFAULT_CONFIRMATION_TEMPLATE,
  DEFAULT_PAYMENT_TEMPLATE,
  firstName,
  isDueSoon,
  reminderAvailableAt,
  remainingDays,
  renderFollowUpTemplate,
  whatsappNumber,
  whatsappUrl,
} from './policies/admin-applications.policy';
import {
  OFFER_SCHOLARSHIP_TYPES_RELATION,
  SCHOLARSHIP_TYPE_SELECT,
} from '../..//scholarship-types/scholarship-type.select';
import { assignedSummary } from '../..//scholarship-types/policies/scholarship-type.policy';

const PERSON = { select: { id: true, fullName: true } } as const;

const FOLLOW_UP_INCLUDE = {
  followUpNotes: { orderBy: { createdAt: 'desc' }, take: 20 },
  assignedScholarshipType: { select: SCHOLARSHIP_TYPE_SELECT },
  offer: { select: { scholarshipTypes: OFFER_SCHOLARSHIP_TYPES_RELATION } },
} as const satisfies Prisma.ApplicationInclude;

type FollowUpRow = Prisma.ApplicationGetPayload<{ include: typeof FOLLOW_UP_INCLUDE }>;

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/**
 * Seguimiento de postulación a inscripción (HU-32): embudo, "Aprobados sin pagar" / "Vencidas",
 * recordatorios, WhatsApp, notas, extender plazo y cerrar inscripciones.
 */
@Injectable()
export class AdminFollowUpService {
  /** Raíz del portal (PORTAL_URL o FRONTEND_URL). */
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: ApplicationWorkflowService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    config: ConfigService<Env, true>,
  ) {
    this.frontendUrl = portalBaseUrl(config);
  }

  // --- Embudo ----------------------------------------------------------------------------------------

  async offers(query: ListFunnelOffersQueryDto): Promise<PaginatedResponseDto<FunnelOfferDto>> {
    const where: Prisma.OfferWhereInput = {
      OR: [
        { applications: { some: { submittedAt: { not: null } } } },
        { enrollments: { some: {} } },
      ],
      ...(query.q ? { name: { contains: query.q.trim(), mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.offer.findMany({
        where,
        orderBy: [{ startsAt: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
        skip: query.skip,
        take: query.take,
        select: {
          id: true,
          name: true,
          type: true,
          startsAt: true,
          _count: {
            select: {
              applications: { where: { submittedAt: { not: null }, status: { not: 'DRAFT' } } },
              enrollments: { where: { status: { in: [...SEAT_HOLDING_STATUSES] } } },
            },
          },
        },
      }),
      this.prisma.offer.count({ where }),
    ]);
    return paginate(
      rows.map((o) => ({
        id: o.id,
        name: o.name,
        type: o.type,
        startsAt: iso(o.startsAt),
        applications: o._count.applications,
        enrollments: o._count.enrollments,
      })),
      total,
      query,
    );
  }

  async funnel(offerId: string): Promise<OfferFunnelDto> {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      select: {
        id: true,
        name: true,
        type: true,
        startsAt: true,
        _count: {
          select: {
            enrollments: { where: { status: { in: [...SEAT_HOLDING_STATUSES] } } },
          },
        },
      },
    });
    if (!offer) throw AppException.notFound('La oferta no existe.');
    const [apps, direct] = await Promise.all([
      this.prisma.application.findMany({
        where: { offerId, status: { not: 'DRAFT' } },
        select: { status: true, submittedAt: true, paymentStartedAt: true, responseDueAt: true },
      }),
      this.prisma.enrollment.count({
        where: { offerId, applicationId: null, status: { in: [...SEAT_HOLDING_STATUSES] } },
      }),
    ]);
    const funnel = computeFunnel(apps, nowUtc());
    return {
      offer: {
        id: offer.id,
        name: offer.name,
        type: offer.type,
        startsAt: iso(offer.startsAt),
        applications: funnel.stages[0].count,
        enrollments: offer._count.enrollments,
      },
      ...funnel,
      directEnrollments: direct,
    };
  }

  async followUps(
    offerId: string,
    query: ListFollowUpsQueryDto,
  ): Promise<PaginatedResponseDto<FollowUpItemDto>> {
    await this.requireOffer(offerId);
    const where: Prisma.ApplicationWhereInput = {
      offerId,
      status: query.tab === 'EXPIRED' ? 'EXPIRED' : { in: [...AWAITING_RESPONSE_STATUSES] },
      ...(query.paymentStarted === true ? { paymentStartedAt: { not: null } } : {}),
      ...(query.paymentStarted === false ? { paymentStartedAt: null } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: FOLLOW_UP_INCLUDE,
        orderBy:
          query.tab === 'EXPIRED'
            ? [{ expiredAt: { sort: 'desc', nulls: 'last' } }, { number: 'asc' }]
            : [{ responseDueAt: { sort: 'asc', nulls: 'last' } }, { number: 'asc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.application.count({ where }),
    ]);
    const now = nowUtc();
    return paginate(
      rows.map((row) => this.toItem(row, now)),
      total,
      query,
    );
  }

  /** HU-32 "Cerrar inscripciones": cierra la ventana de inscripción/convocatoria ahora. */
  async closeEnrollment(
    user: AdminUser,
    offerId: string,
    reason?: string,
  ): Promise<CloseEnrollmentResultDto> {
    const offer = await this.requireOffer(offerId);
    const now = nowUtc();
    const close = effectiveEnrollmentClose(offer);
    if (offer.publicationStatus !== 'PUBLISHED' || (close && close.getTime() <= now.getTime())) {
      throw new AppException('OFFER_INVALID_STATE', {
        message: 'Las inscripciones de esta oferta ya están cerradas.',
        meta: { publicationStatus: offer.publicationStatus, enrollmentClosesAt: iso(close) },
      });
    }
    const data = {
      enrollmentClosesAt: now,
      // Si aún no abría, también "abre" ahora para que la ventana quede coherente (cerrada).
      ...(offer.enrollmentOpensAt && offer.enrollmentOpensAt > now
        ? { enrollmentOpensAt: now }
        : {}),
    };
    await this.prisma.offer.update({ where: { id: offerId }, data });
    await this.audit.record({
      actor: user,
      action: 'offer.close-enrollment',
      entityType: 'Offer',
      entityId: offerId,
      summary: `Cerró las inscripciones de «${offer.name}»${reason ? `: ${reason}` : '.'}`,
      before: {
        enrollmentOpensAt: offer.enrollmentOpensAt,
        enrollmentClosesAt: offer.enrollmentClosesAt,
      },
      after: { ...data, reason: reason ?? null },
    });
    return { offerId, enrollmentClosesAt: now.toISOString() };
  }

  // --- Persona ---------------------------------------------------------------------------------------

  async detail(applicationId: string): Promise<FollowUpDetailDto> {
    const row = await this.requireApproved(applicationId);
    const [events, notes, payments] = await Promise.all([
      this.prisma.applicationStatusEvent.findMany({
        where: { applicationId },
        include: { actor: PERSON },
      }),
      this.prisma.applicationFollowUpNote.findMany({
        where: { applicationId },
        include: { author: PERSON },
      }),
      this.prisma.payment.findMany({ where: { applicationId } }),
    ]);
    const timeline: FollowUpTimelineItemDto[] = [
      ...events.map((e) => ({
        kind: 'STATUS_CHANGE' as const,
        at: e.createdAt.toISOString(),
        title: APPLICATION_STATUS_LABELS[e.toStatus],
        detail: e.note,
        outcome: null,
        author: e.actorType === 'STAFF' ? e.actor : null,
      })),
      ...notes.map((n) => ({
        kind: n.kind === 'NOTE' ? ('NOTE' as const) : n.kind,
        at: n.createdAt.toISOString(),
        title: NOTE_TITLES[n.kind],
        detail: n.body,
        outcome: n.outcome,
        author: n.author,
      })),
      ...payments
        .filter((p) => p.status !== 'CANCELLED')
        .map((p) => ({
          kind: 'PAYMENT' as const,
          at: (p.paidAt ?? p.submittedAt ?? p.createdAt).toISOString(),
          title: `Pago ${p.method === 'CARD' ? 'con tarjeta' : 'por transferencia'}: ${p.status}`,
          detail: formatMoney({ amountCents: p.amountCents, currency: p.currency }),
          outcome: null,
          author: null,
        })),
    ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    return { ...this.toItem(row, nowUtc()), timeline };
  }

  async notes(applicationId: string): Promise<FollowUpNotesDto> {
    await this.requireApproved(applicationId);
    const notes = await this.prisma.applicationFollowUpNote.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
      include: { author: PERSON },
    });
    return { data: notes.map(toNoteDto) };
  }

  async addNote(
    user: AdminUser,
    applicationId: string,
    body: string,
    outcome?: FollowUpOutcome,
  ): Promise<FollowUpNoteDto> {
    const app = await this.requireApproved(applicationId);
    const note = await this.createNote(
      applicationId,
      user.id,
      'NOTE',
      body.trim(),
      outcome ?? null,
    );
    await this.audit.record({
      actor: user,
      action: 'application.follow-up-note',
      entityType: 'Application',
      entityId: applicationId,
      summary: `Registró una nota de seguimiento en ${formatFolio(app.kind, app.number)}.`,
      after: { body: note.body, outcome: note.outcome },
    });
    return note;
  }

  /** HU-32 [Recordatorio]: correo con saldo, fecha límite y link de pago. Máx. 1 cada 24 h. */
  async sendReminder(user: AdminUser, applicationId: string): Promise<ReminderResultDto> {
    const app = await this.requireApproved(applicationId);
    if (!isAwaitingResponse(app.status)) {
      throw new AppException('APPLICATION_INVALID_STATE', { meta: { status: app.status } });
    }
    const now = nowUtc();
    const last = await this.prisma.applicationFollowUpNote.findFirst({
      where: { applicationId, kind: 'REMINDER_SENT' },
      orderBy: { createdAt: 'desc' },
    });
    const availableAt = reminderAvailableAt(last?.createdAt ?? null, now);
    if (availableAt) {
      throw new AppException('FOLLOW_UP_REMINDER_TOO_SOON', {
        meta: { availableAt: availableAt.toISOString() },
      });
    }
    const ctx = await this.workflow.messageContext(app);
    const base =
      app.status === 'APPROVED_PENDING_PAYMENT'
        ? balanceReminderMessage(ctx)
        : {
            ...statusChangeMessage('APPROVED_PENDING_CONFIRMATION', ctx)!,
            title: `Recordatorio: confirma tu participación en ${ctx.offer.name}`,
          };
    const [notification] = await this.notifications.notify({
      userIds: [app.userId],
      ...base,
      dedupeKey: `staff-reminder:${app.id}:${now.getTime()}`,
    });
    const balance = money(app.balanceCents, app.currency);
    const due = app.responseDueAt
      ? `${formatInZone(app.responseDueAt, OFFICIAL_TIMEZONE, 'd/MM/yyyy HH:mm')} hora CDMX`
      : 'sin plazo';
    const note = await this.createNote(
      applicationId,
      user.id,
      'REMINDER_SENT',
      `Recordatorio enviado por correo (${balance ? `saldo ${formatMoney(balance)}, ` : ''}vence ${due}).`,
      null,
    );
    await this.audit.record({
      actor: user,
      action: 'application.send-reminder',
      entityType: 'Application',
      entityId: applicationId,
      summary: `Envió un recordatorio a ${app.applicantName} (${formatFolio(app.kind, app.number)}).`,
      after: { notificationId: notification?.id ?? null },
    });
    const saved = notification
      ? await this.prisma.notification.findUnique({ where: { id: notification.id } })
      : null;
    return {
      sentAt: note.createdAt,
      nextAvailableAt: reminderAvailableAt(new Date(note.createdAt), now)!.toISOString(),
      emailStatus: saved?.emailStatus ?? null,
      note,
    };
  }

  /** HU-32 [WhatsApp]: enlace wa.me prellenado (sin API; lo abre el equipo) + nota automática. */
  async whatsapp(
    user: AdminUser,
    applicationId: string,
    template?: string,
  ): Promise<WhatsappResultDto> {
    const app = await this.requireApproved(applicationId);
    const number = whatsappNumber({ countryCode: app.phoneCountryCode, number: app.phoneNumber });
    if (!number) throw new AppException('FOLLOW_UP_PHONE_INVALID');
    const balance = money(app.balanceCents, app.currency);
    const payment = (app.balanceCents ?? 0) > 0;
    const text = renderFollowUpTemplate(
      template?.trim() || (payment ? DEFAULT_PAYMENT_TEMPLATE : DEFAULT_CONFIRMATION_TEMPLATE),
      {
        nombre: firstName(app.applicantName),
        saldo: balance ? formatMoney(balance) : '—',
        link_pago: frontendLink(
          this.frontendUrl,
          payment ? PORTAL_LINKS.payBalance(app.id) : PORTAL_LINKS.application(app.id),
        ),
      },
    );
    const note = await this.createNote(
      applicationId,
      user.id,
      'WHATSAPP_CONTACT',
      `Contacto por WhatsApp: ${text}`.slice(0, 1000),
      null,
    );
    await this.audit.record({
      actor: user,
      action: 'application.whatsapp-contact',
      entityType: 'Application',
      entityId: applicationId,
      summary: `Contactó por WhatsApp a ${app.applicantName} (${formatFolio(app.kind, app.number)}).`,
    });
    return { url: whatsappUrl(number, text), text, note };
  }

  /** HU-32 "Extender plazo" (nueva fecha ≤ inicio de clases; reactiva una Vencida). */
  async extendDeadline(
    user: AdminUser,
    applicationId: string,
    responseDueAt: Date,
    reason: string,
  ): Promise<FollowUpDetailDto> {
    const app = await this.requireApproved(applicationId);
    if (!isAwaitingResponse(app.status) && app.status !== 'EXPIRED') {
      throw new AppException('APPLICATION_INVALID_STATE', { meta: { status: app.status } });
    }
    const updated = await adminTransition(() =>
      this.workflow.extendDeadline(applicationId, responseDueAt, user.id, reason),
    );
    await this.createNote(
      applicationId,
      user.id,
      'NOTE',
      `Plazo extendido al ${formatInZone(responseDueAt, OFFICIAL_TIMEZONE, 'd/MM/yyyy HH:mm')} hora CDMX. Motivo: ${reason}`.slice(
        0,
        1000,
      ),
      null,
    );
    await this.audit.record({
      actor: user,
      action: 'application.extend-deadline',
      entityType: 'Application',
      entityId: applicationId,
      summary: `Extendió el plazo de ${formatFolio(app.kind, app.number)}: ${reason}`,
      before: { status: app.status, responseDueAt: app.responseDueAt },
      after: { status: updated.status, responseDueAt: updated.responseDueAt },
    });
    return this.detail(applicationId);
  }

  // ------------------------------------------------------------------------------------------------

  private async requireOffer(offerId: string) {
    const offer = await this.prisma.offer.findUnique({ where: { id: offerId } });
    if (!offer) throw AppException.notFound('La oferta no existe.');
    return offer;
  }

  /** Postulación que ya tuvo decisión de aprobación (seguimiento solo aplica a aprobadas). */
  private async requireApproved(applicationId: string): Promise<FollowUpRow> {
    const row = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: FOLLOW_UP_INCLUDE,
    });
    if (!row || row.status === 'DRAFT') throw AppException.notFound('La postulación no existe.');
    if (
      ![
        'APPROVED_PENDING_PAYMENT',
        'APPROVED_PENDING_CONFIRMATION',
        'ENROLLED',
        'EXPIRED',
      ].includes(row.status)
    ) {
      throw new AppException('APPLICATION_INVALID_STATE', { meta: { status: row.status } });
    }
    return row;
  }

  private async createNote(
    applicationId: string,
    authorId: string,
    kind: FollowUpNoteKind,
    body: string,
    outcome: FollowUpOutcome | null,
  ): Promise<FollowUpNoteDto> {
    const note = await this.prisma.applicationFollowUpNote.create({
      data: { applicationId, authorId, kind, body, outcome },
      include: { author: PERSON },
    });
    return toNoteDto(note);
  }

  private toItem(row: FollowUpRow, now: Date): FollowUpItemDto {
    const number = whatsappNumber({ countryCode: row.phoneCountryCode, number: row.phoneNumber });
    const lastContact = row.followUpNotes[0] ?? null;
    const lastReminder = row.followUpNotes.find((n) => n.kind === 'REMINDER_SENT') ?? null;
    const remindAt = reminderAvailableAt(lastReminder?.createdAt ?? null, now);
    const awaiting = isAwaitingResponse(row.status);
    return {
      applicationId: row.id,
      folio: formatFolio(row.kind, row.number),
      kind: row.kind,
      status: row.status,
      name: row.applicantName,
      email: row.applicantEmail,
      phone: {
        countryCode: row.phoneCountryCode,
        number: row.phoneNumber,
        whatsappUrl: number ? whatsappUrl(number) : null,
      },
      countryCode: row.countryCode,
      assignedScholarshipTypeId: row.assignedScholarshipTypeId,
      assignedScholarshipType: assignedSummary(
        row.assignedScholarshipType,
        row.offer.scholarshipTypes,
        row.assignedScholarshipTypeName,
      ),
      assignedPercent: row.assignedPercent,
      balance: money(row.balanceCents, row.currency),
      responseDueAt: iso(row.responseDueAt),
      remainingDays: remainingDays(row.responseDueAt, now),
      dueSoon: awaiting && isDueSoon(row.responseDueAt, now),
      pendingTransfer: row.pendingTransferSince !== null,
      paymentStarted: row.paymentStartedAt !== null,
      lastContactAt: iso(lastContact?.createdAt),
      lastOutcome: row.followUpNotes.find((n) => n.outcome)?.outcome ?? null,
      canRemind: awaiting && remindAt === null,
      remindAvailableAt: awaiting ? iso(remindAt) : null,
    };
  }
}

const NOTE_TITLES: Record<FollowUpNoteKind, string> = {
  NOTE: 'Nota',
  REMINDER_SENT: 'Recordatorio enviado',
  WHATSAPP_CONTACT: 'Contacto por WhatsApp',
};

function toNoteDto(
  n: ApplicationFollowUpNote & { author: { id: string; fullName: string } | null },
): FollowUpNoteDto {
  return {
    id: n.id,
    kind: n.kind,
    outcome: n.outcome,
    body: n.body,
    author: n.author,
    createdAt: n.createdAt.toISOString(),
  };
}

function money(cents: number | null, currency: string | null): Money | null {
  if (cents === null || !currency || !isCurrency(currency)) return null;
  return { amountCents: cents, currency };
}
