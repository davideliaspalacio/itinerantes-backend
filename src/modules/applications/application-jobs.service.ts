import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { addHours, nowUtc } from '../../common/utils/time';
import { BUSINESS_RULES } from '../../config/business-rules';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ApplicationWorkflowService } from './application-workflow.service';
import {
  balanceReminderMessage,
  interviewReminderMessage,
} from './policies/application-messages.policy';
import { AWAITING_RESPONSE_STATUSES } from './policies/application-status.policy';

/**
 * Tareas programadas de postulaciones (HU-13 / HU-21 / HU-32). Corren con @nestjs/schedule solo si
 * SCHEDULER_ENABLED=true (una instancia). Idempotentes: claim atómico (`dueReminderSentAt`,
 * `reminderSentAt`, update condicionado al estado) + `dedupeKey` en las notificaciones.
 */
@Injectable()
export class ApplicationJobsService {
  private readonly logger = new Logger(ApplicationJobsService.name);
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly workflow: ApplicationWorkflowService,
    config: ConfigService<Env, true>,
  ) {
    this.enabled = config.get('SCHEDULER_ENABLED', { infer: true });
  }

  @Cron(BUSINESS_RULES.APPLICATION_JOBS_CRON, { name: 'applications' })
  async run(): Promise<void> {
    if (!this.enabled) return;
    try {
      const now = nowUtc();
      const expired = await this.expireOverdue(now);
      const balance = await this.remindBalanceDue(now);
      const interviews = await this.remindInterviews(now);
      if (expired + balance + interviews > 0) {
        this.logger.log({ expired, balance, interviews }, 'Job de postulaciones');
      }
    } catch (error) {
      this.logger.error({ err: error }, 'Job de postulaciones falló');
    }
  }

  /**
   * HU-21 / HU-32: aprobadas sin pago ni confirmación al vencer `responseDueAt` → "Vencida" (cuenta
   * como pérdida; se cancela la reserva de inscripción). Con comprobante de transferencia
   * "Pendiente de validación" (`pendingTransferSince`) no vence. Devuelve cuántas venció.
   */
  async expireOverdue(now: Date): Promise<number> {
    const due = await this.prisma.application.findMany({
      where: {
        status: { in: [...AWAITING_RESPONSE_STATUSES] },
        responseDueAt: { lte: now },
        pendingTransferSince: null,
      },
      select: { id: true },
      orderBy: { responseDueAt: 'asc' },
    });
    let expired = 0;
    for (const { id } of due) {
      if (await this.workflow.expireIfDue(id, now)) expired++;
    }
    return expired;
  }

  /** Anexo A HU-13: recordatorio de saldo N horas antes del plazo (una vez por plazo). */
  async remindBalanceDue(now: Date): Promise<number> {
    const candidates = await this.prisma.application.findMany({
      where: {
        status: 'APPROVED_PENDING_PAYMENT',
        dueReminderSentAt: null,
        pendingTransferSince: null,
        responseDueAt: {
          gt: now,
          lte: addHours(now, BUSINESS_RULES.BALANCE_REMINDER_HOURS_BEFORE),
        },
      },
    });
    let sent = 0;
    for (const application of candidates) {
      const claimed = await this.prisma.application.updateMany({
        where: { id: application.id, dueReminderSentAt: null, status: 'APPROVED_PENDING_PAYMENT' },
        data: { dueReminderSentAt: now },
      });
      if (claimed.count === 0) continue;
      sent++;
      const ctx = await this.workflow.messageContext(application);
      await this.notifications.notify({
        userIds: [application.userId],
        ...balanceReminderMessage(ctx),
        dedupeKey: `balance-reminder:${application.id}:${application.responseDueAt?.getTime() ?? 0}`,
      });
    }
    return sent;
  }

  /** HU-13: recordatorio de la entrevista por Zoom N horas antes (una vez por entrevista). */
  async remindInterviews(now: Date): Promise<number> {
    const interviews = await this.prisma.applicationInterview.findMany({
      where: {
        status: 'SCHEDULED',
        reminderSentAt: null,
        startsAt: { gt: now, lte: addHours(now, BUSINESS_RULES.INTERVIEW_REMINDER_HOURS_BEFORE) },
        application: { status: 'INTERVIEW_SCHEDULED' },
      },
      include: { application: true },
    });
    let sent = 0;
    for (const interview of interviews) {
      const claimed = await this.prisma.applicationInterview.updateMany({
        where: { id: interview.id, reminderSentAt: null, status: 'SCHEDULED' },
        data: { reminderSentAt: now },
      });
      if (claimed.count === 0) continue;
      sent++;
      const ctx = await this.workflow.messageContext(interview.application);
      await this.notifications.notify({
        userIds: [interview.application.userId],
        ...interviewReminderMessage({ ...ctx, interview: { startsAt: interview.startsAt } }),
        dedupeKey: `interview-reminder:${interview.id}`,
      });
    }
    return sent;
  }
}
