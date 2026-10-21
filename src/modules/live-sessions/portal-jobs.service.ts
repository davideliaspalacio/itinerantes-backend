import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { addHours, formatInZone, nowUtc, OFFICIAL_TIMEZONE } from '../../common/utils/time';
import { BUSINESS_RULES } from '../../config/business-rules';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CLASSROOM_ACCESS_STATUSES } from '../enrollments/policies/enrollment.policy';
import { NotificationsService } from '../notifications/notifications.service';
import { PORTAL_LINKS } from '../notifications/portal-links';
import { effectiveAttendanceWindowHours } from './policies/session.policy';

const CDMX_FORMAT = 'd/MM/yyyy, HH:mm';

/**
 * Tareas programadas del portal (HU-13 / HU-18). Corren en proceso con @nestjs/schedule si
 * SCHEDULER_ENABLED=true (una sola instancia). Son idempotentes: marcan la sesión/oferta como
 * notificada (claim atómico) y las notificaciones usan `dedupeKey`.
 */
@Injectable()
export class PortalJobsService {
  private readonly logger = new Logger(PortalJobsService.name);
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    config: ConfigService<Env, true>,
  ) {
    this.enabled = config.get('SCHEDULER_ENABLED', { infer: true });
  }

  @Cron(BUSINESS_RULES.PORTAL_NOTIFICATIONS_CRON, { name: 'portal-notifications' })
  async run(): Promise<void> {
    if (!this.enabled) return;
    try {
      const now = nowUtc();
      const attendance = await this.notifyAttendanceOpen(now);
      const whatsapp = await this.notifyWhatsappAvailable(now);
      if (attendance + whatsapp > 0) {
        this.logger.log({ attendance, whatsapp }, 'Avisos del portal enviados');
      }
    } catch (error) {
      this.logger.error({ err: error }, 'Job de avisos del portal falló');
    }
  }

  /**
   * HU-13 / HU-18: al terminar una sesión, avisa a los inscritos con acceso que el registro de
   * asistencia está abierto (con enlace directo y hora de cierre). Solo sesiones cuya ventana sigue
   * abierta. Devuelve cuántas sesiones procesó.
   */
  async notifyAttendanceOpen(now: Date): Promise<number> {
    const sessions = await this.prisma.offerSession.findMany({
      where: {
        status: 'SCHEDULED',
        attendanceNotifiedAt: null,
        endsAt: {
          lte: now,
          gt: addHours(now, -BUSINESS_RULES.ATTENDANCE_WINDOW_MAX_HOURS),
        },
      },
      select: {
        id: true,
        offerId: true,
        startsAt: true,
        endsAt: true,
        attendanceWindowHours: true,
        offer: { select: { name: true, attendanceWindowHours: true } },
      },
      orderBy: { endsAt: 'asc' },
    });

    let processed = 0;
    for (const session of sessions) {
      const claimed = await this.prisma.offerSession.updateMany({
        where: { id: session.id, attendanceNotifiedAt: null },
        data: { attendanceNotifiedAt: now },
      });
      if (claimed.count === 0) continue;
      processed++;
      const hours = effectiveAttendanceWindowHours(
        session.attendanceWindowHours,
        session.offer.attendanceWindowHours,
      );
      const closesAt = addHours(session.endsAt, hours);
      if (closesAt.getTime() <= now.getTime()) continue;

      const enrollees = await this.prisma.enrollment.findMany({
        where: {
          offerId: session.offerId,
          status: { in: [...CLASSROOM_ACCESS_STATUSES] },
          attendances: { none: { sessionId: session.id } },
        },
        select: { userId: true },
      });
      await this.notifications.notify({
        userIds: enrollees.map((e) => e.userId),
        type: 'ATTENDANCE_OPEN',
        title: 'Registra tu asistencia',
        body:
          `Terminó la sesión del ${formatInZone(session.startsAt, OFFICIAL_TIMEZONE, CDMX_FORMAT)} ` +
          `(hora CDMX) de ${session.offer.name}. El registro cierra en ${hours} h: hasta el ` +
          `${formatInZone(closesAt, OFFICIAL_TIMEZONE, CDMX_FORMAT)} hora CDMX.`,
        action: { label: 'Registrar asistencia', path: PORTAL_LINKS.attendance(session.id) },
        data: {
          offerId: session.offerId,
          sessionId: session.id,
          closesAt: closesAt.toISOString(),
        },
        dedupeKey: `attendance-open:${session.id}`,
      });
    }
    return processed;
  }

  /**
   * HU-13 / HU-17: cuando llega `whatsappVisibleFrom`, avisa a los inscritos que el grupo de WhatsApp
   * ya está en su aula (quien se inscribe después recibe el aviso al inscribirse).
   */
  async notifyWhatsappAvailable(now: Date): Promise<number> {
    const offers = await this.prisma.offer.findMany({
      where: {
        publicationStatus: 'PUBLISHED',
        whatsappGroupUrl: { not: null },
        whatsappNotifiedAt: null,
        OR: [{ whatsappVisibleFrom: null }, { whatsappVisibleFrom: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      },
      select: { id: true, name: true },
    });

    let processed = 0;
    for (const offer of offers) {
      const claimed = await this.prisma.offer.updateMany({
        where: { id: offer.id, whatsappNotifiedAt: null },
        data: { whatsappNotifiedAt: now },
      });
      if (claimed.count === 0) continue;
      processed++;
      const enrollees = await this.prisma.enrollment.findMany({
        where: { offerId: offer.id, status: { in: [...CLASSROOM_ACCESS_STATUSES] } },
        select: { userId: true },
      });
      await this.notifications.notify({
        userIds: enrollees.map((e) => e.userId),
        type: 'WHATSAPP_GROUP_AVAILABLE',
        title: `Grupo de WhatsApp: ${offer.name}`,
        body: 'El grupo de WhatsApp de tu formación ya está disponible en tu aula.',
        action: { label: 'Unirme al grupo', path: PORTAL_LINKS.classroom(offer.id) },
        data: { offerId: offer.id },
        dedupeKey: `whatsapp:${offer.id}`,
      });
    }
    return processed;
  }
}
