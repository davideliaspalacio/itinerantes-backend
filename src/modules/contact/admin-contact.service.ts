import { Injectable } from '@nestjs/common';
import { paginate, type PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { AppException } from '../../common/errors/app.exception';
import type { AdminUser } from '../../common/guards/permissions.guard';
import { ContactStatus, type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CONTACT_ORIGIN_LABELS, CONTACT_SUBJECT_LABELS } from './contact.labels';
import {
  type AdminContactMessageDto,
  CONTACT_STATUS_LABELS,
  type ContactInboxSummaryDto,
  type ListContactMessagesQueryDto,
  type UpdateContactMessageRequestDto,
} from './dto/admin-contact.dto';

const MESSAGE_INCLUDE = {
  handledBy: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.ContactMessageInclude;

type MessageRow = Prisma.ContactMessageGetPayload<{ include: typeof MESSAGE_INCLUDE }>;

/**
 * Bandeja de Contacto del panel (HU-38). Los mensajes llegan por `POST /contact-messages`; aquí el
 * equipo los consulta y los marca (NEW → IN_PROGRESS → ANSWERED / ARCHIVED) con una nota interna.
 * La respuesta al visitante se hace por correo (el aviso al equipo trae `replyTo`).
 */
@Injectable()
export class AdminContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    query: ListContactMessagesQueryDto,
  ): Promise<PaginatedResponseDto<AdminContactMessageDto>> {
    const q = query.q?.trim();
    const where: Prisma.ContactMessageWhereInput = {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q.toLowerCase() } },
              { organization: { contains: q, mode: 'insensitive' } },
              { message: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.subject ? { subject: query.subject } : {}),
      ...(query.origin ? { origin: query.origin } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const direction = query.sort === 'CREATED_ASC' ? 'asc' : 'desc';
    const [rows, total] = await Promise.all([
      this.prisma.contactMessage.findMany({
        where,
        include: MESSAGE_INCLUDE,
        orderBy: [{ createdAt: direction }, { id: 'asc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.contactMessage.count({ where }),
    ]);
    return paginate(rows.map(toDto), total, query);
  }

  async summary(): Promise<ContactInboxSummaryDto> {
    const groups = await this.prisma.contactMessage.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const counts = new Map(groups.map((g) => [g.status, g._count._all]));
    const byStatus = Object.values(ContactStatus).map((status) => ({
      status,
      label: CONTACT_STATUS_LABELS[status],
      count: counts.get(status) ?? 0,
    }));
    return { unread: counts.get(ContactStatus.NEW) ?? 0, byStatus };
  }

  async get(id: string): Promise<AdminContactMessageDto> {
    const row = await this.prisma.contactMessage.findUnique({
      where: { id },
      include: MESSAGE_INCLUDE,
    });
    if (!row) throw AppException.notFound('El mensaje no existe.');
    return toDto(row);
  }

  async update(
    actor: AdminUser,
    id: string,
    dto: UpdateContactMessageRequestDto,
  ): Promise<AdminContactMessageDto> {
    const changesStatus = dto.status !== undefined;
    const changesNote = dto.internalNote !== undefined;
    if (!changesStatus && !changesNote) {
      throw AppException.validation([
        { field: 'status', code: 'REQUIRED', message: 'Envía el estado o la nota interna.' },
      ]);
    }
    const nextNote = changesNote ? dto.internalNote || null : undefined;

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.contactMessage.findUnique({ where: { id } });
      if (!current) throw AppException.notFound('El mensaje no existe.');
      const saved = await tx.contactMessage.update({
        where: { id },
        data: {
          ...(changesStatus ? { status: dto.status } : {}),
          ...(changesNote ? { internalNote: nextNote } : {}),
          handledById: actor.id,
          handledAt: new Date(),
        },
        include: MESSAGE_INCLUDE,
      });
      const statusText =
        changesStatus && dto.status !== current.status
          ? ` a «${CONTACT_STATUS_LABELS[saved.status]}»`
          : '';
      await this.audit.record(
        {
          actor,
          action: 'contact.update',
          entityType: 'ContactMessage',
          entityId: id,
          summary: `Actualizó el mensaje de Contacto de ${current.email}${statusText}${changesNote ? ' (nota interna)' : ''}.`,
          before: { status: current.status, internalNote: current.internalNote },
          after: { status: saved.status, internalNote: saved.internalNote },
        },
        tx,
      );
      return toDto(saved);
    });
  }
}

function toDto(row: MessageRow): AdminContactMessageDto {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    organization: row.organization,
    phone: row.phoneNumber ? { countryCode: row.phoneCountryCode, number: row.phoneNumber } : null,
    subject: row.subject,
    subjectLabel: CONTACT_SUBJECT_LABELS[row.subject],
    origin: row.origin,
    originLabel: CONTACT_ORIGIN_LABELS[row.origin],
    projectType: row.projectType,
    projectLocation: row.projectLocation,
    service: row.service,
    message: row.message,
    status: row.status,
    statusLabel: CONTACT_STATUS_LABELS[row.status],
    internalNote: row.internalNote,
    handledBy: row.handledBy
      ? { id: row.handledBy.id, fullName: row.handledBy.fullName, email: row.handledBy.email }
      : null,
    handledAt: row.handledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
