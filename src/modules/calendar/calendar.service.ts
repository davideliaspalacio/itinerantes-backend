import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { addDaysInZone, nowUtc, OFFICIAL_TIMEZONE } from '../../common/utils/time';
import { BUSINESS_RULES } from '../../config/business-rules';
import type { CalendarCategory } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ApplicationsService } from '../applications/applications.service';
import { publishedNowWhere } from '../classroom/policies/classroom.policy';
import { EnrollmentAccessService } from '../enrollments/enrollment-access.service';
import { joinInfo } from '../live-sessions/policies/session.policy';
import { sessionViewSelect, toSessionCard } from '../live-sessions/session-view';
import type { CalendarItemDto } from './dto/calendar.dto';
import {
  compareCalendarItems,
  isEventVisibleTo,
  matchesCategories,
  overlapsRange,
  validateCalendarRange,
} from './policies/calendar.policy';

/**
 * Calendario central (HU-10): sesiones de mis ofertas + eventos/fechas importantes de mi audiencia.
 */
@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EnrollmentAccessService,
    private readonly applications: ApplicationsService,
  ) {}

  async range(
    userId: string,
    from: Date,
    to: Date,
    categories?: readonly CalendarCategory[],
  ): Promise<CalendarItemDto[]> {
    const error = validateCalendarRange(from, to);
    if (error) {
      throw AppException.validation([
        { field: error.field, code: error.code, message: error.message },
      ]);
    }
    const now = nowUtc();
    const offerIds = await this.access.accessibleOfferIds(userId);

    const [sessions, events, activities, interviews] = await Promise.all([
      this.prisma.offerSession.findMany({
        where: { offerId: { in: [...offerIds] }, startsAt: { lt: to }, endsAt: { gte: from } },
        select: sessionViewSelect(userId),
      }),
      this.prisma.calendarEvent.findMany({
        where: {
          startsAt: { lt: to },
          OR: [{ endsAt: { gte: from } }, { endsAt: null, startsAt: { gte: from } }],
        },
        include: {
          offer: {
            select: {
              id: true,
              slug: true,
              name: true,
              type: true,
              modality: true,
              publicationStatus: true,
            },
          },
        },
      }),
      // HU-08: actividades con fecha → "Fecha importante" (solo módulos y recursos publicados).
      this.prisma.moduleResource.findMany({
        where: {
          type: 'ACTIVITY',
          activityDueAt: { gte: from, lt: to },
          ...publishedNowWhere(now),
          module: { offerId: { in: [...offerIds] }, ...publishedNowWhere(now) },
        },
        select: {
          id: true,
          title: true,
          description: true,
          activityDueAt: true,
          module: {
            select: {
              id: true,
              position: true,
              title: true,
              offer: {
                select: { id: true, slug: true, name: true, type: true, modality: true },
              },
            },
          },
        },
      }),
      // Fase 04 (HU-10/21): entrevistas por Zoom de mis postulaciones → "Fecha importante".
      this.applications.interviewsInRange(userId, from, to),
    ]);

    const items: CalendarItemDto[] = [];
    for (const interview of interviews) {
      items.push({
        id: interview.id,
        source: 'APPLICATION',
        kind: 'INTERVIEW',
        title: `Entrevista por Zoom: ${interview.offer.name}`,
        description: `Postulación ${interview.folio}`,
        category: 'IMPORTANT_DATES',
        startsAt: interview.startsAt.toISOString(),
        endsAt: interview.endsAt.toISOString(),
        allDay: false,
        timezone: OFFICIAL_TIMEZONE,
        status: 'SCHEDULED',
        offer: interview.offer,
        module: null,
        venue: null,
        location: null,
        join: {
          state: interview.join.state,
          opensAt: interview.join.opensAt.toISOString(),
          url: interview.join.url,
        },
        link: {
          kind: 'APPLICATION',
          offerId: interview.offer.id,
          slug: interview.offer.slug,
          applicationId: interview.applicationId,
        },
      });
    }
    for (const activity of activities) {
      const { offer } = activity.module;
      items.push({
        id: activity.id,
        source: 'ACTIVITY',
        kind: 'ACTIVITY_DUE',
        title: activity.title,
        description: activity.description,
        category: 'IMPORTANT_DATES',
        startsAt: activity.activityDueAt!.toISOString(),
        endsAt: null,
        allDay: false,
        timezone: OFFICIAL_TIMEZONE,
        status: 'SCHEDULED',
        offer,
        module: {
          id: activity.module.id,
          number: activity.module.position,
          title: activity.module.title,
        },
        venue: null,
        location: null,
        join: null,
        link: { kind: 'CLASSROOM', offerId: offer.id, slug: offer.slug, applicationId: null },
      });
    }
    for (const row of sessions) {
      const card = toSessionCard(row, now);
      items.push({
        id: card.id,
        source: 'SESSION',
        kind: 'SESSION',
        title: card.offer.name,
        description: card.changeReason,
        category: card.category,
        startsAt: card.startsAt,
        endsAt: card.endsAt,
        allDay: false,
        timezone: OFFICIAL_TIMEZONE,
        status: card.status,
        offer: card.offer,
        module: card.module,
        venue: card.venue,
        location: null,
        join: card.join,
        link: {
          kind: 'CLASSROOM',
          offerId: card.offer.id,
          slug: card.offer.slug,
          applicationId: null,
        },
      });
    }

    for (const event of events) {
      const visible = isEventVisibleTo(
        {
          audience: event.audience,
          offerId: event.offerId,
          offerPublished: event.offer ? event.offer.publicationStatus === 'PUBLISHED' : null,
        },
        offerIds,
      );
      if (!visible || !overlapsRange(event.startsAt, event.endsAt, from, to)) continue;
      const join =
        event.joinUrl && !event.allDay
          ? joinInfo(
              {
                status: event.status,
                modality: 'ONLINE_LIVE',
                startsAt: event.startsAt,
                endsAt: event.endsAt ?? event.startsAt,
                joinUrl: event.joinUrl,
              },
              now,
            )
          : null;
      const offerRef = event.offer
        ? {
            id: event.offer.id,
            slug: event.offer.slug,
            name: event.offer.name,
            type: event.offer.type,
            modality: event.offer.modality,
          }
        : null;
      items.push({
        id: event.id,
        source: 'EVENT',
        kind: event.kind,
        title: event.title,
        description: event.description,
        category: event.category,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt?.toISOString() ?? null,
        allDay: event.allDay,
        timezone: OFFICIAL_TIMEZONE,
        status: event.status,
        offer: offerRef,
        module: null,
        venue: null,
        location: event.location,
        join: join
          ? { state: join.state, opensAt: join.opensAt.toISOString(), url: join.url }
          : null,
        link: offerRef
          ? offerIds.has(offerRef.id) && event.audience === 'OFFER_ENROLLED'
            ? { kind: 'CLASSROOM', offerId: offerRef.id, slug: offerRef.slug, applicationId: null }
            : { kind: 'OFFER', offerId: offerRef.id, slug: offerRef.slug, applicationId: null }
          : { kind: 'NONE', offerId: null, slug: null, applicationId: null },
      });
    }

    return items
      .filter((item) => matchesCategories(item.category, categories))
      .map((item) => ({ item, key: { ...item, startsAt: new Date(item.startsAt) } }))
      .sort((a, b) => compareCalendarItems(a.key, b.key))
      .map(({ item }) => item);
  }

  /**
   * Próximos eventos (Dashboard HU-06): desde ahora hasta N días, sin canceladas, máximo `limit`.
   */
  async upcoming(
    userId: string,
    limit: number = BUSINESS_RULES.DASHBOARD_UPCOMING_EVENTS_LIMIT,
    days: number = BUSINESS_RULES.DASHBOARD_UPCOMING_EVENTS_DAYS,
  ): Promise<CalendarItemDto[]> {
    const now = nowUtc();
    const items = await this.range(userId, now, addDaysInZone(now, days));
    return items
      .filter((i) => i.status !== 'CANCELLED' && new Date(i.endsAt ?? i.startsAt) > now)
      .slice(0, limit);
  }
}
