import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { isCurrency } from '../../common/utils/money';
import { nowUtc } from '../../common/utils/time';
import type {
  Application,
  ApplicationActorType,
  ApplicationStatus,
  ApplicationStatusEvent,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  type ApplicationMessageContext,
  interviewScheduledMessage,
  statusChangeMessage,
} from './policies/application-messages.policy';
import {
  balanceAfterScholarship,
  formatFolio,
  interviewRequired,
  resolveScholarshipAssignment,
  responseDeadline,
} from './policies/application-rules.policy';
import { OFFER_SCHOLARSHIP_TYPES_RELATION } from '../scholarship-types/scholarship-type.select';
import { canTransition, isAwaitingResponse } from './policies/application-status.policy';

/** Quién provoca el cambio: participante (su id), integrante del equipo (su id) o el sistema. */
export interface ApplicationActor {
  type: ApplicationActorType;
  id?: string | null;
}

export const SYSTEM_ACTOR: ApplicationActor = { type: 'SYSTEM', id: null };

export interface TransitionOptions {
  /** Campos extra a guardar junto con el cambio de estado. */
  data?: Prisma.ApplicationUncheckedUpdateManyInput;
  /** Condición extra del update atómico (p. ej. `responseDueAt <= now` al vencer). */
  where?: Prisma.ApplicationWhereInput;
  /** Nota interna del historial (nunca visible al postulante). */
  note?: string | null;
  /** Efectos dentro de la misma transacción (inscripción, entrevista...). */
  afterUpdate?: (tx: Prisma.TransactionClient, application: Application) => Promise<void>;
  /** Notificar al postulante (por defecto sí). */
  notify?: boolean;
  /**
   * Fase 06 (HU-31 "Correo al postulante: plantilla editable"): párrafo del equipo que se agrega al
   * cuerpo de la notificación y del correo del cambio de estado.
   */
  participantMessage?: string | null;
}

export interface TransitionResult {
  application: Application;
  event: ApplicationStatusEvent;
}

export interface ScheduleInterviewInput {
  startsAt: Date;
  endsAt: Date;
  /** Enlace de Zoom del participante (HU-31: URL zoom.us). */
  joinUrl: string;
}

export interface ApproveInput {
  /** Beca: tipo asignado (puede diferir del solicitado; HU-31). Debe estar habilitado en la oferta. */
  assignedScholarshipTypeId?: string | null;
  /**
   * % final dentro del rango efectivo del tipo en la oferta. Rango fijo → opcional (se toma solo).
   */
  assignedPercent?: number | null;
  note?: string | null;
  /** Fase 06: párrafo editable que se agrega al aviso/correo de la decisión. */
  participantMessage?: string | null;
}

/**
 * Transiciones de la postulación (máquina de estados de `application-status.policy.ts`).
 *
 * Los usa la Fase 04 (enviar, confirmar participación, vencimientos) y quedan listos para:
 * - Fase 06 (panel, HU-31/32): `startReview`, `scheduleInterview`, `completeInterview`,
 *   `cancelInterview`, `approve`, `reject`, `extendDeadline`.
 * - Fase 05 (pagos, HU-23): `markEnrolled` (pago confirmado / transferencia validada) y
 *   `setPendingTransfer` (comprobante "Pendiente de validación": la postulación no vence).
 *
 * Cada transición: update condicionado al estado previo (concurrencia optimista) + evento de
 * historial + efectos (inscripción) en UNA transacción; la notificación va después del commit con
 * `dedupeKey = app-status:{id}:{estado}:{eventId}` (un fallo de aviso nunca revierte el cambio).
 */
@Injectable()
export class ApplicationWorkflowService {
  private readonly logger = new Logger(ApplicationWorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollments: EnrollmentsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Núcleo: valida la transición para el actor y la aplica de forma atómica. */
  async transition(
    applicationId: string,
    to: ApplicationStatus,
    actor: ApplicationActor,
    options: TransitionOptions = {},
  ): Promise<TransitionResult> {
    const now = nowUtc();
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.application.findUnique({
        where: { id: applicationId },
        select: { status: true },
      });
      if (!current) throw AppException.notFound('La postulación no existe.');
      if (!canTransition(current.status, to, actor.type)) {
        throw invalidTransition(current.status, to);
      }
      const updated = await tx.application.updateMany({
        where: { id: applicationId, status: current.status, ...options.where },
        data: { ...options.data, status: to, statusChangedAt: now },
      });
      // Otro proceso cambió el estado (o no se cumple la condición extra) entre la lectura y el update.
      if (updated.count === 0) throw invalidTransition(current.status, to);
      const event = await tx.applicationStatusEvent.create({
        data: {
          applicationId,
          fromStatus: current.status,
          toStatus: to,
          actorType: actor.type,
          actorId: actor.id ?? null,
          note: options.note ?? null,
          createdAt: now,
        },
      });
      const application = await tx.application.findUniqueOrThrow({ where: { id: applicationId } });
      await options.afterUpdate?.(tx, application);
      return { application, event };
    });
    if (options.notify !== false) {
      await this.notifyStatus(result.application, result.event, options.participantMessage);
    }
    return result;
  }

  // --- Fase 06: revisión (HU-31) ------------------------------------------------------------------

  /** HU-31: "pasa a En revisión al abrir el detalle por primera vez". Idempotente. */
  async startReview(applicationId: string, staffId: string): Promise<Application> {
    const application = await this.require(applicationId);
    if (application.status !== 'SUBMITTED') return application;
    const now = nowUtc();
    const { application: updated } = await this.transition(
      applicationId,
      'IN_REVIEW',
      { type: 'STAFF', id: staffId },
      { data: { reviewStartedAt: now } },
    );
    return updated;
  }

  /** Agenda (o reprograma) la entrevista por Zoom y notifica con hora local + CDMX. */
  async scheduleInterview(
    applicationId: string,
    input: ScheduleInterviewInput,
    staffId: string,
  ): Promise<Application> {
    if (input.endsAt.getTime() <= input.startsAt.getTime()) {
      throw AppException.validation([
        { field: 'endsAt', code: 'INVALID', message: 'El fin debe ser posterior al inicio.' },
      ]);
    }
    if (!/^https:\/\//i.test(input.joinUrl)) {
      throw AppException.validation([
        { field: 'joinUrl', code: 'INVALID', message: 'Usa el enlace https de Zoom.' },
      ]);
    }
    const application = await this.require(applicationId);
    const createInterview = async (tx: Prisma.TransactionClient) => {
      await tx.applicationInterview.updateMany({
        where: { applicationId, status: 'SCHEDULED' },
        data: { status: 'CANCELLED' },
      });
      return tx.applicationInterview.create({
        data: { applicationId, ...input, scheduledById: staffId },
      });
    };

    if (application.status === 'INTERVIEW_SCHEDULED') {
      // Reprogramación: sin cambio de estado; aviso con la nueva hora.
      const interview = await this.prisma.$transaction(createInterview);
      await this.safeNotify(application, async (ctx) => {
        await this.notifications.notify({
          userIds: [application.userId],
          ...interviewScheduledMessage({ ...ctx, interview }),
          dedupeKey: `interview-scheduled:${interview.id}`,
        });
      });
      return application;
    }
    const { application: updated } = await this.transition(
      applicationId,
      'INTERVIEW_SCHEDULED',
      { type: 'STAFF', id: staffId },
      {
        afterUpdate: async (tx) => {
          await createInterview(tx);
        },
      },
    );
    return updated;
  }

  /** Marca la entrevista vigente como "Realizada" (o "No asistió"). Sin cambio de estado. */
  async completeInterview(
    applicationId: string,
    staffId: string,
    outcome: 'COMPLETED' | 'NO_SHOW' = 'COMPLETED',
  ): Promise<void> {
    const interview = await this.prisma.applicationInterview.findFirst({
      where: { applicationId, status: 'SCHEDULED' },
      orderBy: { createdAt: 'desc' },
    });
    if (!interview) throw AppException.notFound('No hay una entrevista agendada.');
    await this.prisma.applicationInterview.update({
      where: { id: interview.id },
      data: {
        status: outcome,
        completedAt: nowUtc(),
        scheduledById: interview.scheduledById ?? staffId,
      },
    });
  }

  /** Cancela la entrevista sin reprogramar: la postulación vuelve a "En revisión". */
  async cancelInterview(
    applicationId: string,
    staffId: string,
    note?: string,
  ): Promise<Application> {
    const { application } = await this.transition(
      applicationId,
      'IN_REVIEW',
      { type: 'STAFF', id: staffId },
      {
        note,
        afterUpdate: async (tx) => {
          await tx.applicationInterview.updateMany({
            where: { applicationId, status: 'SCHEDULED' },
            data: { status: 'CANCELLED' },
          });
        },
      },
    );
    return application;
  }

  /**
   * Decisión "Aprobada" (HU-31): calcula % y saldo, plazo de 7 días (sin superar el inicio) y:
   * - saldo > 0 → APPROVED_PENDING_PAYMENT + inscripción PENDING_PAYMENT (la Fase 05 cobra);
   * - sin saldo (convocatoria gratuita) → APPROVED_PENDING_CONFIRMATION (la persona confirma).
   * Convocatorias y tipos de beca con `requiresInterview` exigen entrevista "Realizada".
   */
  async approve(applicationId: string, input: ApproveInput, staffId: string): Promise<Application> {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        offer: {
          select: { startsAt: true, scholarshipTypes: OFFER_SCHOLARSHIP_TYPES_RELATION },
        },
        interviews: { where: { status: 'COMPLETED' }, select: { id: true } },
      },
    });
    if (!application) throw AppException.notFound('La postulación no existe.');

    let assignedScholarshipTypeId: string | null = null;
    let assignedScholarshipTypeName: string | null = null;
    let assignedPercent: number | null = null;
    let typeRequiresInterview = false;
    if (application.kind === 'SCHOLARSHIP') {
      const assignment = resolveScholarshipAssignment(
        application.offer.scholarshipTypes,
        input.assignedScholarshipTypeId,
        input.assignedPercent,
      );
      if (!assignment.ok) throw AppException.validation([assignment.issue]);
      const { option } = assignment;
      assignedScholarshipTypeId = option.id;
      assignedScholarshipTypeName = option.name;
      assignedPercent = assignment.percent;
      typeRequiresInterview = option.requiresInterview;
    }
    if (
      interviewRequired(application.kind, typeRequiresInterview) &&
      application.interviews.length === 0
    ) {
      throw new AppException('APPLICATION_INTERVIEW_REQUIRED');
    }

    const balanceCents =
      application.kind === 'SCHOLARSHIP'
        ? balanceAfterScholarship(application.originalAmountCents, assignedPercent ?? 0)
        : Math.max(application.originalAmountCents ?? 0, 0);
    const responseKind = balanceCents > 0 ? 'PAYMENT' : 'CONFIRMATION';
    const now = nowUtc();
    const { application: updated } = await this.transition(
      applicationId,
      responseKind === 'PAYMENT' ? 'APPROVED_PENDING_PAYMENT' : 'APPROVED_PENDING_CONFIRMATION',
      { type: 'STAFF', id: staffId },
      {
        note: input.note,
        participantMessage: input.participantMessage,
        data: {
          assignedScholarshipTypeId,
          assignedScholarshipTypeName,
          assignedPercent,
          balanceCents,
          decidedAt: now,
          decidedById: staffId,
          decisionNote: input.note ?? null,
          responseDueAt: responseDeadline(now, responseKind, application.offer.startsAt),
          dueReminderSentAt: null,
        },
        afterUpdate: async (tx, app) => {
          if (responseKind === 'PAYMENT') await this.reserveEnrollment(tx, app, now);
        },
      },
    );
    return updated;
  }

  /** Decisión "No seleccionada" (HU-31). */
  async reject(
    applicationId: string,
    staffId: string,
    note?: string,
    participantMessage?: string | null,
  ): Promise<Application> {
    const now = nowUtc();
    const { application } = await this.transition(
      applicationId,
      'NOT_SELECTED',
      { type: 'STAFF', id: staffId },
      {
        note,
        participantMessage,
        data: { decidedAt: now, decidedById: staffId, decisionNote: note ?? null },
      },
    );
    return application;
  }

  /**
   * HU-32 "Extender plazo" (nueva fecha ≤ inicio de clases, motivo obligatorio): actualiza la fecha
   * límite y, si estaba Vencida, la reactiva (y vuelve a reservar la inscripción si hay saldo).
   */
  async extendDeadline(
    applicationId: string,
    newDueAt: Date,
    staffId: string,
    reason: string,
  ): Promise<Application> {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { offer: { select: { startsAt: true } } },
    });
    if (!application) throw AppException.notFound('La postulación no existe.');
    const now = nowUtc();
    const startsAt = application.offer.startsAt;
    if (newDueAt.getTime() <= now.getTime() || (startsAt && newDueAt > startsAt)) {
      throw AppException.validation([
        {
          field: 'responseDueAt',
          code: 'INVALID',
          message: 'La nueva fecha debe ser futura y no posterior al inicio de clases.',
        },
      ]);
    }
    const data = { responseDueAt: newDueAt, dueReminderSentAt: null, expiredAt: null };
    if (isAwaitingResponse(application.status)) {
      return this.prisma.application.update({ where: { id: applicationId }, data });
    }
    const payment = (application.balanceCents ?? 0) > 0;
    const { application: updated } = await this.transition(
      applicationId,
      payment ? 'APPROVED_PENDING_PAYMENT' : 'APPROVED_PENDING_CONFIRMATION',
      { type: 'STAFF', id: staffId },
      {
        note: reason,
        data,
        afterUpdate: async (tx, app) => {
          if (payment) await this.reserveEnrollment(tx, app, now);
        },
      },
    );
    return updated;
  }

  // --- Fase 05: pagos (HU-23) ---------------------------------------------------------------------

  /** Pago del saldo confirmado (Stripe) o transferencia validada: Inscrita + inscripción ACTIVE. */
  async markEnrolled(
    applicationId: string,
    actor: ApplicationActor = SYSTEM_ACTOR,
  ): Promise<Application> {
    const now = nowUtc();
    const { application } = await this.transition(applicationId, 'ENROLLED', actor, {
      data: { enrolledAt: now, pendingTransferSince: null, expiredAt: null },
      afterUpdate: async (tx, app) => this.activateEnrollment(tx, app, now),
    });
    return application;
  }

  /**
   * Comprobante de transferencia "Pendiente de validación" (true) o resuelto/rechazado (false).
   * Mientras esté pendiente, el job de vencimientos no la vence (HU-21/23).
   */
  async setPendingTransfer(
    applicationId: string,
    pending: boolean,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const now = nowUtc();
    const current = await tx.application.findUnique({
      where: { id: applicationId },
      select: { paymentStartedAt: true },
    });
    await tx.application.update({
      where: { id: applicationId },
      data: {
        pendingTransferSince: pending ? now : null,
        ...(pending
          ? { paymentStartedAt: current?.paymentStartedAt ?? now, transferRejectedAt: null }
          : {}),
      },
    });
  }

  /**
   * Fase 05 (HU-23/33): el equipo rechazó el comprobante. Deja de estar "Pendiente de validación"
   * (vuelve a correr el plazo) y la persona ve [Subir comprobante].
   */
  async markTransferRejected(
    applicationId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.application.update({
      where: { id: applicationId },
      data: { pendingTransferSince: null, transferRejectedAt: nowUtc() },
    });
  }

  /** Fase 05: "Con pago iniciado" (embudo HU-32): abrió Stripe o creó un plan. Idempotente. */
  async markPaymentStarted(
    applicationId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.application.updateMany({
      where: { id: applicationId, paymentStartedAt: null },
      data: { paymentStartedAt: nowUtc() },
    });
  }

  // --- Fase 04: participante y jobs ---------------------------------------------------------------

  /** "Confirmar mi participación" (convocatoria sin costo): Inscrita + inscripción ACTIVE. */
  async confirmParticipation(applicationId: string, userId: string): Promise<Application> {
    const now = nowUtc();
    const { application } = await this.transition(
      applicationId,
      'ENROLLED',
      { type: 'PARTICIPANT', id: userId },
      {
        where: { userId, OR: [{ responseDueAt: null }, { responseDueAt: { gt: now } }] },
        data: { enrolledAt: now },
        afterUpdate: async (tx, app) => this.activateEnrollment(tx, app, now),
      },
    );
    return application;
  }

  /**
   * Vence una postulación aprobada sin pago ni confirmación en plazo (job). Condición atómica:
   * `responseDueAt <= now` y sin comprobante pendiente. Devuelve false si ya no aplica.
   */
  async expireIfDue(applicationId: string, now: Date = nowUtc()): Promise<boolean> {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { status: true },
    });
    if (!application || !isAwaitingResponse(application.status)) return false;
    try {
      await this.transition(applicationId, 'EXPIRED', SYSTEM_ACTOR, {
        where: { responseDueAt: { lte: now }, pendingTransferSince: null },
        data: { expiredAt: now },
        afterUpdate: async (tx, app) => {
          await this.enrollments.cancelPendingForApplication(
            tx,
            app.id,
            'Postulación vencida: no se pagó el saldo en el plazo.',
            now,
          );
        },
      });
      return true;
    } catch (error) {
      if (error instanceof AppException && error.code === 'APPLICATION_INVALID_TRANSITION') {
        return false;
      }
      throw error;
    }
  }

  /** Contexto de los mensajes (oferta, folio, zona del perfil, entrevista vigente, saldo). */
  async messageContext(application: Application): Promise<ApplicationMessageContext> {
    const [offer, user, interview, requestedScholarshipType] = await Promise.all([
      this.prisma.offer.findUniqueOrThrow({
        where: { id: application.offerId },
        select: { id: true, name: true },
      }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: application.userId },
        select: { timezone: true },
      }),
      this.prisma.applicationInterview.findFirst({
        where: { applicationId: application.id, status: { not: 'CANCELLED' } },
        orderBy: { createdAt: 'desc' },
        select: { startsAt: true },
      }),
      application.requestedScholarshipTypeId
        ? this.prisma.scholarshipType.findUnique({
            where: { id: application.requestedScholarshipTypeId },
            select: { name: true, requiresInterview: true },
          })
        : Promise.resolve(null),
    ]);
    const currency = application.currency;
    return {
      applicationId: application.id,
      kind: application.kind,
      folio: formatFolio(application.kind, application.number),
      offer,
      userTimezone: user.timezone,
      requestedScholarshipType,
      assignedScholarshipTypeName: application.assignedScholarshipTypeName,
      assignedPercent: application.assignedPercent,
      balance:
        application.balanceCents !== null && currency && isCurrency(currency)
          ? { amountCents: application.balanceCents, currency }
          : null,
      responseDueAt: application.responseDueAt,
      interview,
    };
  }

  // ------------------------------------------------------------------------------------------------

  private async require(applicationId: string): Promise<Application> {
    const application = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!application) throw AppException.notFound('La postulación no existe.');
    return application;
  }

  private async reserveEnrollment(
    tx: Prisma.TransactionClient,
    application: Application,
    now: Date,
  ): Promise<void> {
    await this.enrollments.upsertFromApplication(tx, {
      userId: application.userId,
      offerId: application.offerId,
      applicationId: application.id,
      source: application.kind,
      status: 'PENDING_PAYMENT',
      now,
    });
  }

  private async activateEnrollment(
    tx: Prisma.TransactionClient,
    application: Application,
    now: Date,
  ): Promise<void> {
    await this.enrollments.upsertFromApplication(tx, {
      userId: application.userId,
      offerId: application.offerId,
      applicationId: application.id,
      source: application.kind,
      status: 'ACTIVE',
      now,
    });
  }

  private async notifyStatus(
    application: Application,
    event: ApplicationStatusEvent,
    participantMessage?: string | null,
  ): Promise<void> {
    await this.safeNotify(application, async (ctx) => {
      const message = statusChangeMessage(event.toStatus, ctx);
      if (!message) return;
      const extra = participantMessage?.trim();
      await this.notifications.notify({
        userIds: [application.userId],
        ...message,
        ...(extra ? { body: `${message.body}\n\n${extra}` } : {}),
        dedupeKey: `app-status:${application.id}:${event.toStatus}:${event.id}`,
      });
    });
  }

  /** El aviso nunca revierte el cambio ya guardado (HU-31: "sin perder la decisión"). */
  private async safeNotify(
    application: Application,
    send: (ctx: ApplicationMessageContext) => Promise<void>,
  ): Promise<void> {
    try {
      await send(await this.messageContext(application));
    } catch (error) {
      this.logger.error(
        { err: error, applicationId: application.id },
        'No se pudo notificar el cambio de la postulación',
      );
    }
  }
}

function invalidTransition(from: ApplicationStatus, to: ApplicationStatus): AppException {
  return new AppException('APPLICATION_INVALID_TRANSITION', { meta: { status: from, to } });
}
