import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../common/errors/app.exception';
import { paginate, type PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { nowUtc } from '../../common/utils/time';
import type { Env } from '../../config/env.schema';
import type {
  Notification,
  NotificationPriority,
  NotificationType,
  Prisma,
} from '../../generated/prisma/client';
import { MailService } from '../../infra/mail/mail.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { ListNotificationsQueryDto } from './dto/notifications.query.dto';
import type { NotificationDto, UnreadCountDto } from './dto/notifications.response.dto';
import {
  defaultPriority,
  frontendLink,
  isPinnedOnCreate,
  NOTIFICATION_CATEGORY_BY_TYPE,
  shouldEmail,
} from './notifications.policy';

/** Entrada de `NotificationsService.notify` (servicio interno reutilizable por las Fases 04–06). */
export interface NotifyInput {
  /** Destinatarios (una notificación por persona). */
  userIds: readonly string[];
  type: NotificationType;
  /** Título corto (campana y asunto del correo). */
  title: string;
  /** Texto de la notificación (también el cuerpo del correo). */
  body: string;
  /** Botón hacia la sección del portal. `path` = ruta relativa del frontend (ver PORTAL_LINKS). */
  action?: { label: string; path: string };
  /** Ids relacionados para que el frontend arme sus rutas (offerId, sessionId...). */
  data?: Record<string, string | number | boolean | null>;
  /** Por defecto según el tipo (HIGH para cobro fallido / mora). */
  priority?: NotificationPriority;
  /**
   * Correo (HU-13: todos los eventos van al portal y por correo). `false` = solo portal
   * (p. ej. "En revisión"). Con objeto se personaliza el correo; por defecto replica la notificación.
   */
  email?: boolean | { subject?: string; paragraphs?: string[] };
  /**
   * Idempotencia: la misma clave no se notifica dos veces a la misma persona (jobs, reintentos).
   * Convención: `<tipo>:<id>` (p. ej. `attendance-open:<sessionId>`).
   */
  dedupeKey?: string;
}

/**
 * Notificaciones in-app + correo (HU-13).
 *
 * ```ts
 * await this.notifications.notify({
 *   userIds: [userId],
 *   type: 'SCHOLARSHIP_APPROVED',
 *   title: 'Tu beca fue aprobada',
 *   body: 'Nivel Aguas Libres (50%). Saldo: $5,100 MXN. Fecha límite: 14/11/2026.',
 *   action: { label: 'Pagar saldo', path: `/portal/postulaciones/${applicationId}` },
 *   data: { applicationId },
 *   dedupeKey: `scholarship-approved:${applicationId}`,
 * });
 * ```
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    config: ConfigService<Env, true>,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', { infer: true });
  }

  /**
   * Crea la notificación para cada destinatario (omitiendo duplicados por `dedupeKey`) y envía el
   * correo. Un fallo de correo nunca rompe el flujo: queda `emailStatus = FAILED` en la notificación.
   * Devuelve las notificaciones creadas.
   */
  async notify(input: NotifyInput): Promise<Notification[]> {
    const userIds = [...new Set(input.userIds)];
    if (userIds.length === 0) return [];
    const priority = input.priority ?? defaultPriority(input.type);
    const email = shouldEmail(input.email);

    const created = await this.prisma.notification.createManyAndReturn({
      data: userIds.map((userId) => ({
        userId,
        type: input.type,
        category: NOTIFICATION_CATEGORY_BY_TYPE[input.type],
        priority,
        pinned: isPinnedOnCreate(priority),
        title: input.title,
        body: input.body,
        actionLabel: input.action?.label ?? null,
        actionPath: input.action?.path ?? null,
        data: input.data ?? undefined,
        dedupeKey: input.dedupeKey ?? null,
        emailStatus: email ? 'PENDING' : 'NOT_REQUESTED',
      })),
      skipDuplicates: true,
    });

    if (email && created.length > 0) await this.sendEmails(created, input);
    return created;
  }

  /**
   * Regulariza (desfija) las notificaciones de prioridad alta de una persona: p. ej. al pagar la
   * cuota fallida (Fase 05). Filtra por tipos y/o por `dedupeKey` (exacta o por prefijo, p. ej.
   * `plan-failed:{planId}:` para todos los avisos de cobro fallido de un plan).
   */
  async resolve(
    userId: string,
    filter: { types?: NotificationType[]; dedupeKey?: string; dedupeKeyPrefix?: string },
  ): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        pinned: true,
        ...(filter.types ? { type: { in: filter.types } } : {}),
        ...(filter.dedupeKey ? { dedupeKey: filter.dedupeKey } : {}),
        ...(filter.dedupeKeyPrefix ? { dedupeKey: { startsWith: filter.dedupeKeyPrefix } } : {}),
      },
      data: { pinned: false, resolvedAt: nowUtc() },
    });
    return result.count;
  }

  // --- Endpoints de la campana (HU-13) ------------------------------------------------------------

  async list(
    userId: string,
    query: ListNotificationsQueryDto,
  ): Promise<PaginatedResponseDto<NotificationDto>> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.unread ? { readAt: null } : {}),
      ...(query.category ? { category: query.category } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return paginate(rows.map(toDto), total, query);
  }

  async unreadCount(userId: string): Promise<UnreadCountDto> {
    const [unread, pinned] = await Promise.all([
      this.prisma.notification.count({ where: { userId, readAt: null } }),
      this.prisma.notification.count({ where: { userId, pinned: true } }),
    ]);
    return { unread, pinned };
  }

  async markRead(userId: string, id: string): Promise<NotificationDto> {
    const existing = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!existing) throw new AppException('NOT_FOUND', { message: 'La notificación no existe.' });
    if (existing.readAt) return toDto(existing);
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: nowUtc() },
    });
    return toDto(updated);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: nowUtc() },
    });
    return { updated: result.count };
  }

  // ------------------------------------------------------------------------------------------------

  private async sendEmails(created: Notification[], input: NotifyInput): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: created.map((n) => n.userId) } },
      select: { id: true, email: true, fullName: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const custom = typeof input.email === 'object' ? input.email : undefined;

    for (const notification of created) {
      const user = byId.get(notification.userId);
      if (!user) continue;
      const firstName = user.fullName.split(' ')[0] ?? user.fullName;
      try {
        await this.mail.sendLayout(user.email, custom?.subject ?? input.title, {
          title: input.title,
          preheader: input.body.slice(0, 120),
          paragraphs: [`Hola, ${firstName}:`, ...(custom?.paragraphs ?? [input.body])],
          action: input.action
            ? { label: input.action.label, url: frontendLink(this.frontendUrl, input.action.path) }
            : undefined,
          footerNote:
            'Recibes este correo porque tienes una cuenta en el portal de la Escuela Itinerante del ' +
            'Agua. También puedes ver este aviso en la campana de notificaciones del portal.',
        });
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { emailStatus: 'SENT', emailSentAt: nowUtc() },
        });
      } catch (error) {
        this.logger.error(
          { err: error, notificationId: notification.id, type: notification.type },
          'No se pudo enviar el correo de la notificación',
        );
        await this.prisma.notification
          .update({ where: { id: notification.id }, data: { emailStatus: 'FAILED' } })
          .catch(() => undefined);
      }
    }
  }
}

function toDto(n: Notification): NotificationDto {
  return {
    id: n.id,
    type: n.type,
    category: n.category,
    priority: n.priority,
    pinned: n.pinned,
    title: n.title,
    body: n.body,
    action: n.actionLabel && n.actionPath ? { label: n.actionLabel, path: n.actionPath } : null,
    data: (n.data as Record<string, unknown> | null) ?? null,
    read: n.readAt !== null,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}
