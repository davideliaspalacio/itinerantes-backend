import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { paginate, type PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { formatInZone, nowUtc, OFFICIAL_TIMEZONE } from '../../common/utils/time';
import { BUSINESS_RULES } from '../../config/business-rules';
import type { Enrollment, OfferType, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PORTAL_LINKS } from '../notifications/portal-links';
import { deriveOfferAvailability } from '../offers/policies/offer-status.policy';
import type { ListEnrollmentsQueryDto } from './dto/enrollments.query.dto';
import type { FormationCardDto, ScheduleStatus } from './dto/enrollments.response.dto';
import {
  decideFreeEnrollment,
  deriveFormationPhase,
  hasClassroomAccess,
  MY_FORMATION_STATUSES,
  SEAT_HOLDING_STATUSES,
} from './policies/enrollment.policy';
import { computeProgress, nextSession } from './policies/progress.policy';
import { whatsappInfo } from '../classroom/policies/classroom.policy';

const CARD_SELECT = {
  id: true,
  status: true,
  origin: true,
  createdAt: true,
  activatedAt: true,
  offer: {
    select: {
      id: true,
      slug: true,
      name: true,
      type: true,
      modality: true,
      coverImageKey: true,
      cohortLabel: true,
      startsAt: true,
      endsAt: true,
      venueName: true,
      venueAddress: true,
      venueCity: true,
      venueMapsUrl: true,
      sessions: { select: { id: true, status: true, startsAt: true, endsAt: true } },
    },
  },
  attendances: { select: { sessionId: true } },
} as const satisfies Prisma.EnrollmentSelect;

type CardRow = Prisma.EnrollmentGetPayload<{ select: typeof CARD_SELECT }>;

/**
 * "Mi formación" (HU-07), tarjetas del Dashboard (HU-06) e inscripción gratuita (ENROLL_FREE, HU-16).
 */
@Injectable()
export class EnrollmentsService {
  private readonly logger = new Logger(EnrollmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  async listMine(
    userId: string,
    query: ListEnrollmentsQueryDto,
  ): Promise<PaginatedResponseDto<FormationCardDto>> {
    const now = nowUtc();
    const cards = await this.cardsFor(userId, now, query.type);
    const filtered = cards.filter((c) => query.phase === 'ALL' || c.phase === query.phase);
    return paginate(filtered.slice(query.skip, query.skip + query.take), filtered.length, query);
  }

  /** Tarjetas activas para el Dashboard (HU-06), máximo `limit`; `total` = todas las activas. */
  async activeCards(
    userId: string,
    limit: number = BUSINESS_RULES.DASHBOARD_FORMATIONS_LIMIT,
  ): Promise<{ items: FormationCardDto[]; total: number }> {
    const cards = (await this.cardsFor(userId, nowUtc())).filter((c) => c.phase === 'ACTIVE');
    return { items: cards.slice(0, limit), total: cards.length };
  }

  /**
   * [Inscribirme] en una oferta NAS gratuita (no convocatoria) con inscripciones abiertas y cupo.
   * El cupo se valida dentro de una transacción con bloqueo de la fila de la oferta.
   */
  async enrollFree(userId: string, offerId: string): Promise<FormationCardDto> {
    const now = nowUtc();
    const enrollment = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM offers WHERE id = ${offerId}::uuid FOR UPDATE`;
      const offer = await tx.offer.findUnique({ where: { id: offerId } });
      if (!offer || offer.publicationStatus !== 'PUBLISHED') {
        throw new AppException('OFFER_NOT_AVAILABLE');
      }
      const existing = await tx.enrollment.findUnique({
        where: { userId_offerId: { userId, offerId } },
      });
      const seatsTaken =
        offer.capacity !== null
          ? await tx.enrollment.count({
              where: { offerId, status: { in: [...SEAT_HOLDING_STATUSES] } },
            })
          : 0;
      const decision = decideFreeEnrollment({
        type: offer.type,
        origin: offer.origin,
        isFree: offer.isFree,
        availability: deriveOfferAvailability(offer, now),
        enrollmentOpensAt: offer.enrollmentOpensAt,
        soldOut: offer.capacity !== null && seatsTaken >= offer.capacity,
        existingStatus: existing?.status ?? null,
      });
      if (!decision.ok) {
        const meta: Record<string, unknown> = { ...decision.meta };
        if (decision.code === 'ENROLLMENT_CLOSED') {
          meta.availableFrom = decision.meta.availableFrom?.toISOString() ?? null;
        }
        throw new AppException(decision.code, { meta });
      }
      const data = {
        status: 'ACTIVE' as const,
        origin: 'NAS' as const,
        source: 'FREE_SIGNUP' as const,
        activatedAt: now,
        cancelledAt: null,
        statusReason: null,
      };
      return existing
        ? tx.enrollment.update({ where: { id: existing.id }, data })
        : tx.enrollment.create({ data: { userId, offerId, ...data } });
    });

    await this.notifyEnrollment(enrollment, now);
    return this.cardFor(userId, offerId, now);
  }

  // --- Fase 04: inscripciones originadas por una postulación (beca / convocatoria) ---------------

  /**
   * Reserva (PENDING_PAYMENT, saldo tras beca: la Fase 05 la activa al pagar) o activa (ACTIVE,
   * convocatoria confirmada / pago confirmado) la inscripción de una postulación aprobada. Corre
   * dentro de la transacción de la transición (`tx`). Si la persona ya tiene una inscripción vigente
   * por otra vía (p. ej. pagó el precio completo), no la toca y devuelve null.
   */
  async upsertFromApplication(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      offerId: string;
      applicationId: string;
      source: 'SCHOLARSHIP' | 'OPEN_CALL';
      status: 'PENDING_PAYMENT' | 'ACTIVE';
      now: Date;
    },
  ): Promise<Enrollment | null> {
    const existing = await tx.enrollment.findUnique({
      where: { userId_offerId: { userId: input.userId, offerId: input.offerId } },
    });
    if (
      existing &&
      existing.applicationId !== input.applicationId &&
      (SEAT_HOLDING_STATUSES as readonly string[]).includes(existing.status)
    ) {
      this.logger.warn(
        { enrollmentId: existing.id, applicationId: input.applicationId },
        'La persona ya tenía una inscripción vigente: no se modifica',
      );
      return null;
    }
    const data = {
      status: input.status,
      origin: 'NAS' as const,
      source: input.source,
      applicationId: input.applicationId,
      activatedAt: input.status === 'ACTIVE' ? input.now : null,
      cancelledAt: null,
      statusReason: null,
    };
    return existing
      ? tx.enrollment.update({ where: { id: existing.id }, data })
      : tx.enrollment.create({ data: { userId: input.userId, offerId: input.offerId, ...data } });
  }

  /** Cancela la reserva PENDING_PAYMENT de una postulación vencida (libera la inscripción). */
  async cancelPendingForApplication(
    tx: Prisma.TransactionClient,
    applicationId: string,
    reason: string,
    now: Date,
  ): Promise<number> {
    const result = await tx.enrollment.updateMany({
      where: { applicationId, status: 'PENDING_PAYMENT' },
      data: { status: 'CANCELLED', cancelledAt: now, statusReason: reason },
    });
    return result.count;
  }

  async cardFor(userId: string, offerId: string, now: Date = nowUtc()): Promise<FormationCardDto> {
    const row = await this.prisma.enrollment.findUniqueOrThrow({
      where: { userId_offerId: { userId, offerId } },
      select: CARD_SELECT,
    });
    return this.toCard(row, now);
  }

  // ------------------------------------------------------------------------------------------------

  private async cardsFor(
    userId: string,
    now: Date,
    types?: readonly OfferType[],
  ): Promise<FormationCardDto[]> {
    const rows = await this.prisma.enrollment.findMany({
      where: {
        userId,
        status: { in: [...MY_FORMATION_STATUSES] },
        ...(types?.length ? { offer: { type: { in: [...types] } } } : {}),
      },
      select: CARD_SELECT,
    });
    const cards = await Promise.all(rows.map((row) => this.toCard(row, now)));
    return cards.sort(compareCards);
  }

  private async toCard(row: CardRow, now: Date): Promise<FormationCardDto> {
    const { offer } = row;
    const attended = new Set(row.attendances.map((a) => a.sessionId));
    const next = nextSession(offer.sessions, now);
    const phase = deriveFormationPhase(row.status, offer.endsAt, now);
    const scheduleStatus: ScheduleStatus = next
      ? 'HAS_NEXT_SESSION'
      : phase === 'COMPLETED'
        ? 'FINISHED'
        : 'NO_UPCOMING_SESSIONS';
    return {
      enrollmentId: row.id,
      status: row.status,
      phase,
      origin: row.origin,
      canContinue: hasClassroomAccess(row.status),
      offer: {
        id: offer.id,
        slug: offer.slug,
        name: offer.name,
        type: offer.type,
        modality: offer.modality,
        coverImageUrl: offer.coverImageKey
          ? await this.storage.getPublicUrl(
              offer.coverImageKey,
              BUSINESS_RULES.PUBLIC_IMAGE_SIGNED_URL_TTL_SECONDS,
            )
          : null,
        cohortLabel: offer.cohortLabel,
        startsAt: offer.startsAt?.toISOString() ?? null,
        endsAt: offer.endsAt?.toISOString() ?? null,
        venue:
          offer.modality === 'IN_PERSON' && offer.venueName
            ? {
                name: offer.venueName,
                address: offer.venueAddress,
                city: offer.venueCity,
                mapsUrl: offer.venueMapsUrl,
              }
            : null,
      },
      progress: computeProgress(offer.sessions, attended),
      nextSession: next
        ? { id: next.id, startsAt: next.startsAt.toISOString(), endsAt: next.endsAt.toISOString() }
        : null,
      scheduleStatus,
      enrolledAt: (row.activatedAt ?? row.createdAt).toISOString(),
    };
  }

  /** Confirmación de inscripción (portal + correo) y, si ya está visible, el grupo de WhatsApp. */
  private async notifyEnrollment(enrollment: Enrollment, now: Date): Promise<void> {
    try {
      const offer = await this.prisma.offer.findUniqueOrThrow({
        where: { id: enrollment.offerId },
        select: {
          id: true,
          name: true,
          startsAt: true,
          whatsappGroupUrl: true,
          whatsappVisibleFrom: true,
          sessions: {
            where: { status: 'SCHEDULED' },
            orderBy: { startsAt: 'asc' },
            take: 1,
            select: { startsAt: true },
          },
        },
      });
      const first = offer.sessions[0]?.startsAt ?? offer.startsAt;
      const when = first
        ? ` Primera sesión: ${formatInZone(first, OFFICIAL_TIMEZONE, 'd/MM/yyyy HH:mm')} hora CDMX.`
        : '';
      await this.notifications.notify({
        userIds: [enrollment.userId],
        type: 'ENROLLMENT_CONFIRMED',
        title: `Inscripción confirmada: ${offer.name}`,
        body: `Ya estás inscrito en ${offer.name}.${when} Encuentra todo en tu aula.`,
        action: { label: 'Ir a mi aula', path: PORTAL_LINKS.classroom(offer.id) },
        data: { offerId: offer.id, enrollmentId: enrollment.id },
        dedupeKey: `enrollment-confirmed:${enrollment.id}:${enrollment.activatedAt?.getTime() ?? 0}`,
      });
      const whatsapp = whatsappInfo(
        {
          url: offer.whatsappGroupUrl,
          visibleFrom: offer.whatsappVisibleFrom,
          firstSessionStartsAt: first,
        },
        now,
      );
      if (whatsapp.available) {
        await this.notifications.notify({
          userIds: [enrollment.userId],
          type: 'WHATSAPP_GROUP_AVAILABLE',
          title: `Grupo de WhatsApp: ${offer.name}`,
          body: 'El grupo de WhatsApp de tu formación ya está disponible en tu aula.',
          action: { label: 'Unirme al grupo', path: PORTAL_LINKS.classroom(offer.id) },
          data: { offerId: offer.id },
          dedupeKey: `whatsapp:${offer.id}`,
        });
      }
    } catch (error) {
      // La inscripción ya quedó registrada; un fallo de aviso no la revierte.
      this.logger.error({ err: error, enrollmentId: enrollment.id }, 'Aviso de inscripción falló');
    }
  }
}

/** Activas primero (próxima sesión más cercana), luego completadas (fin más reciente primero). */
function compareCards(a: FormationCardDto, b: FormationCardDto): number {
  if (a.phase !== b.phase) return a.phase === 'ACTIVE' ? -1 : 1;
  if (a.phase === 'ACTIVE') {
    const aKey = a.nextSession?.startsAt ?? a.offer.startsAt ?? '9999';
    const bKey = b.nextSession?.startsAt ?? b.offer.startsAt ?? '9999';
    if (aKey !== bKey) return aKey < bKey ? -1 : 1;
  } else {
    const aEnd = a.offer.endsAt ?? '';
    const bEnd = b.offer.endsAt ?? '';
    if (aEnd !== bEnd) return aEnd > bEnd ? -1 : 1;
  }
  return a.offer.name.localeCompare(b.offer.name, 'es');
}
