import { Injectable, Logger } from '@nestjs/common';
import { paginate, type PaginatedResponseDto } from '../../common/dto/pagination.dto';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { summarizeChanges } from './audit.policy';
import type { AuditLogDto, ListAuditLogsQueryDto } from './dto/audit.dto';

/** Quién hizo la acción (el `request.user` del panel sirve tal cual). */
export interface AuditActor {
  id: string;
  email: string;
}

export interface AuditEntry {
  actor: AuditActor;
  /** Acción estable `dominio.verbo` (p. ej. `offer.publish`). Ver la tabla en docs/frontend/fase-06-admin.md. */
  action: string;
  /** Entidad afectada (`Offer`, `OfferModule`, `Application`, `Payment`, `InstallmentPlan`, `User`...). */
  entityType: string;
  entityId?: string | null;
  /** Resumen legible en español ("Publicó la oferta «Diplomado…»"). */
  summary: string;
  /** Estado previo de los campos relevantes (se guardan solo los que cambian). */
  before?: Record<string, unknown> | null;
  /** Estado posterior / datos de la acción. */
  after?: Record<string, unknown> | null;
}

/**
 * Registro de auditoría del panel (Fase 06). TODA acción de escritura de `/admin/...` llama a
 * `record()` después de aplicarse (o dentro de su transacción con `tx`). Un fallo al auditar fuera
 * de una transacción se registra en logs y no revierte la acción ya hecha.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, tx?: Prisma.TransactionClient): Promise<void> {
    const changes = summarizeChanges(entry.before ?? null, entry.after ?? null);
    const data: Prisma.AdminAuditLogUncheckedCreateInput = {
      actorId: entry.actor.id,
      actorEmail: entry.actor.email,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary.slice(0, 500),
      changes: (changes ?? undefined) as Prisma.InputJsonValue | undefined,
    };
    if (tx) {
      await tx.adminAuditLog.create({ data });
      return;
    }
    try {
      await this.prisma.adminAuditLog.create({ data });
    } catch (error) {
      this.logger.error({ err: error, action: entry.action }, 'No se pudo registrar la auditoría');
    }
  }

  async list(query: ListAuditLogsQueryDto): Promise<PaginatedResponseDto<AuditLogDto>> {
    const where: Prisma.AdminAuditLogWhereInput = {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.action ? { action: { startsWith: query.action } } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: query.skip,
        take: query.take,
        include: { actor: { select: { fullName: true } } },
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);
    return paginate(
      rows.map((row) => ({
        id: row.id,
        actor: { id: row.actorId, email: row.actorEmail, fullName: row.actor?.fullName ?? null },
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        summary: row.summary,
        changes: (row.changes as AuditLogDto['changes']) ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      query,
    );
  }
}
