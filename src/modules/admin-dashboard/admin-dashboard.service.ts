import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import type { AdminUser } from '../../common/guards/permissions.guard';
import { Permission, STAFF_ROLES } from '../../config/permissions';
import { ApplicationStatus, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { totalsByCurrency } from '../payments/admin/policies/admin-payments.policy';
import type {
  AdminDashboardDto,
  AdminDashboardQueryDto,
  AdminDashboardTrendsDto,
  AdminDashboardTrendsQueryDto,
  DashboardApplicationsDto,
  DashboardContactDto,
  DashboardPaymentsDto,
  DashboardPeopleDto,
  DashboardTaskDto,
  DashboardTaskKey,
  DashboardTrainingDto,
} from './dto/admin-dashboard.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PERIOD_DAYS = 30;
const DEFAULT_TREND_MONTHS = 6;
/** Zona del equipo: los meses de las series se cortan con la hora de Ciudad de México. */
const TEAM_TIMEZONE = 'America/Mexico_City';
/** Pagos que cuentan como cobrados (igual que `GET /admin/payments/summary`). */
const COLLECTED_STATUSES = ['PAID', 'VALIDATED', 'REFUNDED'] as const;
const REVIEW_STATUSES: ApplicationStatus[] = ['SUBMITTED', 'IN_REVIEW'];
const APPROVED_PENDING_STATUSES: ApplicationStatus[] = [
  'APPROVED_PENDING_PAYMENT',
  'APPROVED_PENDING_CONFIRMATION',
];

const TASK_LABELS: Record<DashboardTaskKey, string> = {
  APPLICATIONS_TO_REVIEW: 'Postulaciones por revisar',
  INTERVIEWS_SCHEDULED: 'Entrevistas agendadas',
  APPROVED_PENDING: 'Aprobados sin pagar o confirmar',
  TRANSFERS_TO_VALIDATE: 'Transferencias por validar',
  PLANS_DELINQUENT: 'Planes de cuotas en mora',
  REFUNDS_PENDING: 'Reembolsos en proceso',
  CONTACT_UNREAD: 'Mensajes de Contacto nuevos',
  SESSIONS_NEXT_7_DAYS: 'Sesiones en los próximos 7 días',
};

/** Participantes = cuentas sin ningún rol del equipo. */
const PARTICIPANTS: Prisma.UserWhereInput = { NOT: { roles: { hasSome: [...STAFF_ROLES] } } };

/**
 * Inicio del panel: cifras para el dashboard en una sola llamada. Cada bloque se calcula solo si
 * quien consulta tiene el permiso (si no, `null`), así cada rol ve lo suyo.
 */
@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(actor: AdminUser, query: AdminDashboardQueryDto): Promise<AdminDashboardDto> {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - DEFAULT_PERIOD_DAYS * DAY_MS);
    if (from > to) {
      throw AppException.validation([
        { field: 'from', code: 'INVALID_RANGE', message: '`from` debe ser anterior a `to`.' },
      ]);
    }
    const can = (p: Permission) => actor.permissions.includes(p);
    const period = { gte: from, lte: to };

    const [people, training, applications, payments, contact] = await Promise.all([
      this.people(period),
      can(Permission.OFFERS_READ) ? this.training(period) : null,
      can(Permission.APPLICATIONS_READ) ? this.applications(period) : null,
      can(Permission.PAYMENTS_READ) ? this.payments(period) : null,
      can(Permission.CONTACT_READ) ? this.contact() : null,
    ]);

    const candidates: [DashboardTaskKey, number | undefined][] = [
      ['APPLICATIONS_TO_REVIEW', applications?.toReview],
      ['INTERVIEWS_SCHEDULED', applications?.interviewsScheduled],
      ['APPROVED_PENDING', applications?.approvedPending],
      ['TRANSFERS_TO_VALIDATE', payments?.pendingTransfers],
      ['PLANS_DELINQUENT', payments?.plans.delinquent],
      ['REFUNDS_PENDING', payments?.pendingRefunds],
      ['CONTACT_UNREAD', contact?.unread],
      ['SESSIONS_NEXT_7_DAYS', training?.upcomingSessions7d],
    ];
    const tasks: DashboardTaskDto[] = candidates
      .filter((c): c is [DashboardTaskKey, number] => (c[1] ?? 0) > 0)
      .map(([key, count]) => ({ key, label: TASK_LABELS[key], count }));

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      people,
      training,
      applications,
      payments,
      contact,
      tasks,
    };
  }

  async trends(
    actor: AdminUser,
    query: AdminDashboardTrendsQueryDto,
  ): Promise<AdminDashboardTrendsDto> {
    const months = query.months ?? DEFAULT_TREND_MONTHS;
    const can = (p: Permission) => actor.permissions.includes(p);
    const staffRoles = [...STAFF_ROLES] as string[];
    const collected = [...COLLECTED_STATUSES] as string[];

    const rows = await this.prisma.$queryRaw<
      {
        month: string;
        new_participants: number;
        new_enrollments: number;
        submitted_applications: number;
        net_mxn: bigint;
        net_usd: bigint;
      }[]
    >(Prisma.sql`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', now() AT TIME ZONE ${TEAM_TIMEZONE}) - make_interval(months => ${months - 1}),
          date_trunc('month', now() AT TIME ZONE ${TEAM_TIMEZONE}),
          interval '1 month'
        ) AS m
      )
      SELECT
        to_char(m, 'YYYY-MM') AS month,
        (SELECT count(*)::int FROM users u
          WHERE date_trunc('month', u.created_at AT TIME ZONE ${TEAM_TIMEZONE}) = m
            AND NOT (u.roles && ${staffRoles}::text[]::"Role"[])) AS new_participants,
        (SELECT count(*)::int FROM enrollments e
          WHERE date_trunc('month', e.created_at AT TIME ZONE ${TEAM_TIMEZONE}) = m) AS new_enrollments,
        (SELECT count(*)::int FROM applications a
          WHERE a.submitted_at IS NOT NULL
            AND date_trunc('month', a.submitted_at AT TIME ZONE ${TEAM_TIMEZONE}) = m) AS submitted_applications,
        (SELECT coalesce(sum(p.amount_cents - p.refunded_cents), 0)::bigint FROM payments p
          WHERE p.currency = 'MXN' AND p.status::text = ANY(${collected}::text[]) AND p.paid_at IS NOT NULL
            AND date_trunc('month', p.paid_at AT TIME ZONE ${TEAM_TIMEZONE}) = m) AS net_mxn,
        (SELECT coalesce(sum(p.amount_cents - p.refunded_cents), 0)::bigint FROM payments p
          WHERE p.currency = 'USD' AND p.status::text = ANY(${collected}::text[]) AND p.paid_at IS NOT NULL
            AND date_trunc('month', p.paid_at AT TIME ZONE ${TEAM_TIMEZONE}) = m) AS net_usd
      FROM months
      ORDER BY m
    `);

    const offers = can(Permission.OFFERS_READ);
    const apps = can(Permission.APPLICATIONS_READ);
    const money = can(Permission.PAYMENTS_READ);
    return {
      months: rows.map((r) => ({
        month: r.month,
        newParticipants: r.new_participants,
        newEnrollments: offers ? r.new_enrollments : null,
        submittedApplications: apps ? r.submitted_applications : null,
        netMxnCents: money ? Number(r.net_mxn) : null,
        netUsdCents: money ? Number(r.net_usd) : null,
      })),
    };
  }

  private async people(period: Prisma.DateTimeFilter): Promise<DashboardPeopleDto> {
    const [byStatus, newInPeriod, countries] = await Promise.all([
      this.prisma.user.groupBy({ by: ['status'], where: PARTICIPANTS, _count: { _all: true } }),
      this.prisma.user.count({ where: { ...PARTICIPANTS, createdAt: period } }),
      this.prisma.user.groupBy({
        by: ['countryCode'],
        where: PARTICIPANTS,
        _count: { _all: true },
        orderBy: { _count: { countryCode: 'desc' } },
        take: 5,
      }),
    ]);
    const status = new Map(byStatus.map((s) => [s.status, s._count._all]));
    const active = status.get('ACTIVE') ?? 0;
    const pendingVerification = status.get('PENDING_VERIFICATION') ?? 0;
    const disabled = status.get('DISABLED') ?? 0;
    return {
      total: active + pendingVerification + disabled,
      active,
      pendingVerification,
      disabled,
      newInPeriod,
      topCountries: countries.map((c) => ({ countryCode: c.countryCode, count: c._count._all })),
    };
  }

  private async training(period: Prisma.DateTimeFilter): Promise<DashboardTrainingDto> {
    const now = new Date();
    const [published, inProgress, byStatus, newEnrollments, bySource, sessions, top] =
      await Promise.all([
        this.prisma.offer.count({ where: { publicationStatus: 'PUBLISHED' } }),
        this.prisma.offer.count({
          where: {
            publicationStatus: 'PUBLISHED',
            startsAt: { lte: now },
            OR: [{ endsAt: null }, { endsAt: { gte: now } }],
          },
        }),
        this.prisma.enrollment.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.enrollment.count({ where: { createdAt: period } }),
        this.prisma.enrollment.groupBy({
          by: ['source'],
          _count: { _all: true },
          orderBy: { _count: { source: 'desc' } },
        }),
        this.prisma.offerSession.count({
          where: {
            status: 'SCHEDULED',
            startsAt: { gte: now, lte: new Date(now.getTime() + 7 * DAY_MS) },
          },
        }),
        this.prisma.enrollment.groupBy({
          by: ['offerId'],
          where: { status: { in: ['ACTIVE', 'COMPLETED'] } },
          _count: { _all: true },
          orderBy: { _count: { offerId: 'desc' } },
          take: 5,
        }),
      ]);
    const offers = await this.prisma.offer.findMany({
      where: { id: { in: top.map((t) => t.offerId) } },
      select: { id: true, name: true, type: true, capacity: true },
    });
    const offerById = new Map(offers.map((o) => [o.id, o]));
    const status = new Map(byStatus.map((s) => [s.status, s._count._all]));
    return {
      publishedOffers: published,
      offersInProgress: inProgress,
      enrollments: {
        active: status.get('ACTIVE') ?? 0,
        pendingPayment: status.get('PENDING_PAYMENT') ?? 0,
        completed: status.get('COMPLETED') ?? 0,
        suspended: status.get('SUSPENDED') ?? 0,
        cancelled: status.get('CANCELLED') ?? 0,
      },
      newEnrollmentsInPeriod: newEnrollments,
      bySource: bySource.map((s) => ({ source: s.source, count: s._count._all })),
      upcomingSessions7d: sessions,
      topOffers: top.flatMap((t) => {
        const offer = offerById.get(t.offerId);
        return offer
          ? [
              {
                id: offer.id,
                name: offer.name,
                type: offer.type,
                enrolled: t._count._all,
                capacity: offer.capacity,
              },
            ]
          : [];
      }),
    };
  }

  private async applications(period: Prisma.DateTimeFilter): Promise<DashboardApplicationsDto> {
    const notDraft: Prisma.ApplicationWhereInput = { status: { not: 'DRAFT' } };
    const [byStatus, byKind, submittedInPeriod] = await Promise.all([
      this.prisma.application.groupBy({
        by: ['status'],
        where: notDraft,
        _count: { _all: true },
      }),
      this.prisma.application.groupBy({ by: ['kind'], where: notDraft, _count: { _all: true } }),
      this.prisma.application.count({ where: { submittedAt: period } }),
    ]);
    const counts = new Map(byStatus.map((s) => [s.status, s._count._all]));
    const sum = (statuses: ApplicationStatus[]) =>
      statuses.reduce((total, s) => total + (counts.get(s) ?? 0), 0);
    return {
      byStatus: Object.values(ApplicationStatus)
        .filter((s) => s !== 'DRAFT')
        .map((status) => ({ status, count: counts.get(status) ?? 0 })),
      byKind: byKind.map((k) => ({ kind: k.kind, count: k._count._all })),
      toReview: sum(REVIEW_STATUSES),
      interviewsScheduled: counts.get('INTERVIEW_SCHEDULED') ?? 0,
      approvedPending: sum(APPROVED_PENDING_STATUSES),
      submittedInPeriod,
    };
  }

  private async payments(period: Prisma.DateTimeFilter): Promise<DashboardPaymentsDto> {
    const [collected, pendingTransfers, pastDue, delinquent, pendingRefunds] = await Promise.all([
      this.prisma.payment.findMany({
        where: { status: { in: [...COLLECTED_STATUSES] }, paidAt: period },
        select: { currency: true, amountCents: true, refundedCents: true },
      }),
      this.prisma.payment.count({
        where: { method: 'BANK_TRANSFER', status: 'PENDING_VALIDATION' },
      }),
      this.prisma.installmentPlan.count({ where: { status: 'PAST_DUE' } }),
      this.prisma.installmentPlan.count({ where: { status: 'DELINQUENT' } }),
      this.prisma.paymentRefund.count({ where: { status: 'PENDING' } }),
    ]);
    return {
      currencies: totalsByCurrency(collected),
      pendingTransfers,
      plans: { pastDue, delinquent },
      pendingRefunds,
    };
  }

  private async contact(): Promise<DashboardContactDto> {
    return { unread: await this.prisma.contactMessage.count({ where: { status: 'NEW' } }) };
  }
}
