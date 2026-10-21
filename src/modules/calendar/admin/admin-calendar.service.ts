import { Injectable } from '@nestjs/common';
import { paginate, type PaginatedResponseDto } from '../../../common/dto/pagination.dto';
import { AppException } from '../../../common/errors/app.exception';
import type { AdminUser } from '../../../common/guards/permissions.guard';
import { isHttpsUrl } from '../../../common/utils/urls';
import type { CalendarEvent, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { validateCalendarRange } from '../policies/calendar.policy';
import type {
  AdminCalendarEventDto,
  AdminCalendarItemDto,
  AdminCalendarQueryDto,
  CreateCalendarEventRequestDto,
  ListCalendarEventsQueryDto,
  UpdateCalendarEventRequestDto,
} from './dto/admin-calendar.dto';

type EventRow = CalendarEvent & { offer: { id: string; name: string } | null };

/**
 * Calendario del panel (Fase 06, HU-29): vista mensual/lista con sesiones de todas las ofertas y
 * eventos (todas las audiencias), y "+ Evento manual" (CRUD de CalendarEvent kind MANUAL; las fechas
 * importantes automáticas también se pueden editar o cancelar).
 */
@Injectable()
export class AdminCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async calendar(query: AdminCalendarQueryDto): Promise<AdminCalendarItemDto[]> {
    const rangeError = validateCalendarRange(query.from, query.to);
    if (rangeError) throw AppException.validation([rangeError]);
    const range = { gte: query.from, lt: query.to };
    const [sessions, events] = await Promise.all([
      this.prisma.offerSession.findMany({
        where: {
          startsAt: range,
          ...(query.offerId ? { offerId: query.offerId } : {}),
          ...(query.category ? { category: query.category } : {}),
        },
        include: {
          offer: { select: { id: true, name: true, modality: true } },
          module: { select: { title: true } },
        },
      }),
      this.prisma.calendarEvent.findMany({
        where: {
          startsAt: range,
          ...(query.offerId ? { offerId: query.offerId } : {}),
          ...(query.category ? { category: query.category } : {}),
        },
        include: { offer: { select: { id: true, name: true } } },
      }),
    ]);
    const items: AdminCalendarItemDto[] = [
      ...sessions.map((s) => ({
        source: 'SESSION' as const,
        id: s.id,
        kind: 'SESSION',
        title: s.module ? `${s.offer.name} — ${s.module.title}` : s.offer.name,
        category: s.category,
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        allDay: false,
        status: s.status,
        offer: { id: s.offer.id, name: s.offer.name },
        audience: null,
        edited: s.originalStartsAt !== null,
        missingLink: s.offer.modality === 'ONLINE_LIVE' && s.status === 'SCHEDULED' && !s.joinUrl,
      })),
      ...events.map((e) => ({
        source: 'EVENT' as const,
        id: e.id,
        kind: e.kind,
        title: e.title,
        category: e.category,
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt?.toISOString() ?? null,
        allDay: e.allDay,
        status: e.status,
        offer: e.offer,
        audience: e.audience,
        edited: false,
        missingLink: false,
      })),
    ];
    return items.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
  }

  async list(
    query: ListCalendarEventsQueryDto,
  ): Promise<PaginatedResponseDto<AdminCalendarEventDto>> {
    const where: Prisma.CalendarEventWhereInput = {
      ...(query.offerId ? { offerId: query.offerId } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            startsAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const direction = query.sort === 'STARTS_AT_DESC' ? 'desc' : 'asc';
    const [rows, total] = await Promise.all([
      this.prisma.calendarEvent.findMany({
        where,
        orderBy: [{ startsAt: direction }, { id: 'asc' }],
        skip: query.skip,
        take: query.take,
        include: { offer: { select: { id: true, name: true } } },
      }),
      this.prisma.calendarEvent.count({ where }),
    ]);
    return paginate(rows.map(toDto), total, query);
  }

  async create(
    dto: CreateCalendarEventRequestDto,
    user: AdminUser,
  ): Promise<AdminCalendarEventDto> {
    const data = {
      title: dto.title.trim(),
      description: dto.description ?? null,
      category: dto.category ?? ('EVENTS' as const),
      audience: dto.audience,
      offerId: dto.offerId ?? null,
      startsAt: new Date(dto.startsAt),
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      allDay: dto.allDay ?? false,
      location: dto.location ?? null,
      joinUrl: dto.joinUrl ?? null,
    };
    await this.validate(data);
    const created = await this.prisma.calendarEvent.create({
      data: { ...data, kind: 'MANUAL' },
      include: { offer: { select: { id: true, name: true } } },
    });
    await this.audit.record({
      actor: user,
      action: 'calendar-event.create',
      entityType: 'CalendarEvent',
      entityId: created.id,
      summary: `Creó el evento «${created.title}».`,
      after: data,
    });
    return toDto(created);
  }

  async update(
    id: string,
    dto: UpdateCalendarEventRequestDto,
    user: AdminUser,
  ): Promise<AdminCalendarEventDto> {
    const current = await this.require(id);
    const changes: Prisma.CalendarEventUncheckedUpdateInput = {};
    if (dto.title !== undefined) changes.title = dto.title.trim();
    if (dto.description !== undefined) changes.description = dto.description;
    if (dto.category !== undefined) changes.category = dto.category;
    if (dto.audience !== undefined) changes.audience = dto.audience;
    if (dto.offerId !== undefined) changes.offerId = dto.offerId;
    if (dto.startsAt !== undefined) changes.startsAt = new Date(dto.startsAt);
    if (dto.endsAt !== undefined) changes.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (dto.allDay !== undefined) changes.allDay = dto.allDay;
    if (dto.location !== undefined) changes.location = dto.location;
    if (dto.joinUrl !== undefined) changes.joinUrl = dto.joinUrl;
    const merged = { ...current, ...changes } as unknown as {
      audience: CalendarEvent['audience'];
      offerId: string | null;
      startsAt: Date;
      endsAt: Date | null;
      joinUrl: string | null;
    };
    await this.validate(merged);
    const updated = await this.prisma.calendarEvent.update({
      where: { id },
      data: changes,
      include: { offer: { select: { id: true, name: true } } },
    });
    await this.audit.record({
      actor: user,
      action: 'calendar-event.update',
      entityType: 'CalendarEvent',
      entityId: id,
      summary: `Editó el evento «${updated.title}».`,
      before: current,
      after: { ...changes },
    });
    return toDto(updated);
  }

  async cancel(id: string, user: AdminUser): Promise<AdminCalendarEventDto> {
    const current = await this.require(id);
    if (current.status === 'CANCELLED') {
      throw new AppException('CONFLICT', { message: 'El evento ya está cancelado.' });
    }
    const updated = await this.prisma.calendarEvent.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { offer: { select: { id: true, name: true } } },
    });
    await this.audit.record({
      actor: user,
      action: 'calendar-event.cancel',
      entityType: 'CalendarEvent',
      entityId: id,
      summary: `Canceló el evento «${current.title}».`,
      before: { status: current.status },
      after: { status: 'CANCELLED' },
    });
    return toDto(updated);
  }

  async remove(id: string, user: AdminUser): Promise<void> {
    const current = await this.require(id);
    await this.prisma.calendarEvent.delete({ where: { id } });
    await this.audit.record({
      actor: user,
      action: 'calendar-event.delete',
      entityType: 'CalendarEvent',
      entityId: id,
      summary: `Borró el evento «${current.title}».`,
      before: { title: current.title, kind: current.kind, startsAt: current.startsAt },
    });
  }

  // ------------------------------------------------------------------------------------------------

  private async require(id: string): Promise<EventRow> {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id },
      include: { offer: { select: { id: true, name: true } } },
    });
    if (!event) throw AppException.notFound('El evento no existe.');
    return event;
  }

  private async validate(event: {
    audience: CalendarEvent['audience'];
    offerId: string | null;
    startsAt: Date;
    endsAt: Date | null;
    joinUrl: string | null;
  }): Promise<void> {
    const issues: Array<{ field: string; code: string; message: string }> = [];
    if (event.audience === 'OFFER_ENROLLED' && !event.offerId) {
      issues.push({
        field: 'offerId',
        code: 'REQUIRED',
        message: 'Elige la oferta cuyos inscritos verán el evento.',
      });
    }
    if (event.endsAt && event.endsAt.getTime() <= event.startsAt.getTime()) {
      issues.push({
        field: 'endsAt',
        code: 'INVALID',
        message: 'El fin debe ser posterior al inicio.',
      });
    }
    if (event.joinUrl && !isHttpsUrl(event.joinUrl)) {
      issues.push({ field: 'joinUrl', code: 'IS_URL', message: 'Usa un enlace https válido.' });
    }
    if (event.offerId) {
      const offer = await this.prisma.offer.findUnique({
        where: { id: event.offerId },
        select: { id: true },
      });
      if (!offer)
        issues.push({ field: 'offerId', code: 'INVALID', message: 'La oferta no existe.' });
    }
    if (issues.length) throw AppException.validation(issues);
  }
}

function toDto(e: EventRow): AdminCalendarEventDto {
  return {
    id: e.id,
    kind: e.kind,
    title: e.title,
    description: e.description,
    category: e.category,
    audience: e.audience,
    offer: e.offer,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt?.toISOString() ?? null,
    allDay: e.allDay,
    location: e.location,
    joinUrl: e.joinUrl,
    status: e.status,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}
