import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { endOfDayInZone, nowUtc } from '../../common/utils/time';
import { BUSINESS_RULES } from '../../config/business-rules';
import type { Payment, TransferRejectionReason } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import {
  ApplicationWorkflowService,
  type ApplicationActor,
} from '../applications/application-workflow.service';
import { formatFolio } from '../applications/policies/application-rules.policy';
import { NotificationsService } from '../notifications/notifications.service';
import type { AccessUrlDto } from '../enrollments/dto/portal-shared.dto';
import { CheckoutService } from './checkout.service';
import type {
  SubmitTransferRequestDto,
  TransferUploadUrlRequestDto,
} from './dto/payments.request.dto';
import type { PaymentDto, TransferUploadUrlDto } from './dto/payments.response.dto';
import { PAYMENT_INCLUDE, toPaymentDto } from './payment-view';
import { decideBalancePayment } from './policies/checkout.policy';
import { formatPaymentFolio } from './policies/payment-amounts.policy';
import {
  transferRejectedMessage,
  transferValidatedMessage,
} from './policies/payment-messages.policy';
import {
  decideTransferApproval,
  isValidTransferProof,
  transferAvailability,
  transferProofPrefix,
  transferReference,
} from './policies/transfer.policy';

export interface ApproveTransferInput {
  /** Monto recibido en la cuenta (centavos MXN). Debe ser ≥ al saldo esperado (HU-33). */
  receivedAmountCents: number;
  /** Fecha en que se recibió (≤ hoy). */
  receivedOn: Date;
}

export interface RejectTransferInput {
  reason: TransferRejectionReason;
  note?: string | null;
}

/**
 * Transferencia bancaria México (HU-23; validación del equipo en HU-33 / Fase 06).
 * Participante: URL firmada → PUT → confirmación (tipo y tamaño REALES con `head`) → "Pendiente de
 * validación" (`setPendingTransfer`: la postulación no vence). Reemplazable mientras está pendiente.
 * Equipo (Fase 06, sin endpoints aún): `approveTransfer` / `rejectTransfer`.
 */
@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly workflow: ApplicationWorkflowService,
    private readonly notifications: NotificationsService,
    private readonly checkout: CheckoutService,
  ) {}

  async uploadUrl(userId: string, dto: TransferUploadUrlRequestDto): Promise<TransferUploadUrlDto> {
    await this.requireTransferable(userId, dto.applicationId);
    if (!isValidTransferProof({ mimeType: dto.contentType, sizeBytes: dto.sizeBytes })) {
      throw new AppException('PAYMENT_TRANSFER_INVALID_FILE');
    }
    const key = StorageService.buildKey(transferProofPrefix(dto.applicationId), dto.fileName);
    const signed = await this.storage.getUploadUrl(key, {
      contentType: dto.contentType,
      expiresInSeconds: BUSINESS_RULES.TRANSFER_RECEIPT_UPLOAD_URL_TTL_SECONDS,
    });
    return {
      uploadUrl: signed.url,
      method: 'PUT',
      headers: { 'Content-Type': dto.contentType },
      key,
      expiresAt: signed.expiresAt,
    };
  }

  /** Registra (o reemplaza, si sigue pendiente) el comprobante → "Pendiente de validación". */
  async submit(userId: string, dto: SubmitTransferRequestDto): Promise<PaymentDto> {
    const application = await this.requireTransferable(userId, dto.applicationId);
    const now = nowUtc();
    const paidOn = new Date(`${dto.paidOn}T00:00:00.000Z`);
    if (Number.isNaN(paidOn.getTime()) || paidOn.getTime() > endOfDayInZone(now).getTime()) {
      throw AppException.validation([
        {
          field: 'paidOn',
          code: 'INVALID',
          message: 'La fecha de la transferencia no puede ser futura.',
        },
      ]);
    }
    if (!dto.key.startsWith(`${transferProofPrefix(application.id)}/`) || dto.key.includes('..')) {
      throw new AppException('PAYMENT_TRANSFER_UPLOAD_NOT_FOUND');
    }
    const head = await this.storage.head(dto.key);
    if (!head) throw new AppException('PAYMENT_TRANSFER_UPLOAD_NOT_FOUND');
    const mimeType = head.contentType ?? '';
    const sizeBytes = head.contentLength ?? 0;
    if (!isValidTransferProof({ mimeType, sizeBytes })) {
      await this.deleteFile(dto.key);
      throw new AppException('PAYMENT_TRANSFER_INVALID_FILE');
    }

    const pending = await this.prisma.payment.findFirst({
      where: {
        applicationId: application.id,
        method: 'BANK_TRANSFER',
        status: 'PENDING_VALIDATION',
      },
    });
    const data = {
      declaredAmountCents: dto.declaredAmountCents,
      declaredPaidOn: paidOn,
      trackingKey: dto.trackingKey.toUpperCase(),
      proofFileKey: dto.key,
      proofFileName: dto.fileName ?? dto.key.split('/').pop() ?? 'comprobante',
      proofMimeType: mimeType,
      proofSizeBytes: sizeBytes,
      submittedAt: now,
    };
    const payment = await this.prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.findUnique({
        where: { applicationId: application.id },
        select: { id: true },
      });
      const saved = pending
        ? await tx.payment.update({ where: { id: pending.id }, data })
        : await tx.payment.create({
            data: {
              ...data,
              userId,
              offerId: application.offerId,
              applicationId: application.id,
              enrollmentId: enrollment?.id ?? null,
              concept: 'BALANCE',
              method: 'BANK_TRANSFER',
              status: 'PENDING_VALIDATION',
              amountCents: application.balanceCents!,
              currency: 'MXN',
              transferReference: transferReference(
                formatFolio(application.kind, application.number),
              ),
            },
          });
      await this.workflow.setPendingTransfer(application.id, true, tx);
      return saved;
    });
    if (pending?.proofFileKey && pending.proofFileKey !== dto.key) {
      await this.deleteFile(pending.proofFileKey);
    }
    return this.dto(payment.id);
  }

  async proofDownload(userId: string, paymentId: string): Promise<AccessUrlDto> {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, userId } });
    if (!payment?.proofFileKey) throw AppException.notFound('El comprobante no existe.');
    const signed = await this.storage.getDownloadUrl(payment.proofFileKey, {
      expiresInSeconds: BUSINESS_RULES.PRIVATE_FILE_URL_TTL_SECONDS,
      downloadFileName: payment.proofFileName ?? undefined,
    });
    return {
      kind: 'FILE',
      url: signed.url,
      expiresAt: signed.expiresAt,
      fileName: payment.proofFileName,
    };
  }

  // --- Fase 06 (HU-33): validación del equipo ------------------------------------------------------

  /**
   * "Validar y activar inscripción": exige monto recibido ≥ saldo esperado
   * (`PAYMENT_TRANSFER_AMOUNT_MISMATCH` con `meta.differenceCents`). Pasa a "Validada", inscribe
   * (`markEnrolled`, actor equipo) y notifica TRANSFER_VALIDATED.
   */
  async approveTransfer(
    paymentId: string,
    staffId: string,
    input: ApproveTransferInput,
  ): Promise<Payment> {
    const payment = await this.requirePendingTransfer(paymentId);
    if (input.receivedOn.getTime() > endOfDayInZone(nowUtc()).getTime()) {
      throw AppException.validation([
        { field: 'receivedOn', code: 'INVALID', message: 'La fecha no puede ser futura.' },
      ]);
    }
    const decision = decideTransferApproval(payment.amountCents, input.receivedAmountCents);
    if (!decision.ok) {
      throw new AppException('PAYMENT_TRANSFER_AMOUNT_MISMATCH', {
        meta: { differenceCents: decision.differenceCents, expectedCents: payment.amountCents },
      });
    }
    const now = nowUtc();
    const updated = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: 'PENDING_VALIDATION' },
      data: {
        status: 'VALIDATED',
        paidAt: now,
        reviewedAt: now,
        reviewedById: staffId,
        receivedAmountCents: input.receivedAmountCents,
        receivedOn: input.receivedOn,
      },
    });
    if (updated.count === 0) {
      throw new AppException('PAYMENT_INVALID_STATE', { meta: { status: payment.status } });
    }
    const actor: ApplicationActor = { type: 'STAFF', id: staffId };
    if (payment.applicationId) await this.workflow.markEnrolled(payment.applicationId, actor);
    const enrollment = payment.applicationId
      ? await this.prisma.enrollment.findUnique({ where: { applicationId: payment.applicationId } })
      : null;
    const saved = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { enrollmentId: enrollment?.id ?? payment.enrollmentId },
      include: { offer: { select: { id: true, name: true } } },
    });
    await this.safeNotify(saved.userId, {
      ...transferValidatedMessage({
        offerId: saved.offer.id,
        offerName: saved.offer.name,
        folio: formatPaymentFolio(saved.number),
        amount: { amountCents: saved.amountCents, currency: saved.currency },
      }),
      data: { paymentId, applicationId: saved.applicationId, offerId: saved.offerId },
      dedupeKey: `transfer-validated:${paymentId}`,
    });
    return saved;
  }

  /** "Rechazar" con motivo: "Rechazada", la persona puede subir otro comprobante (HU-23). */
  async rejectTransfer(
    paymentId: string,
    staffId: string,
    input: RejectTransferInput,
  ): Promise<Payment> {
    const payment = await this.requirePendingTransfer(paymentId);
    const now = nowUtc();
    const saved = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: paymentId, status: 'PENDING_VALIDATION' },
        data: {
          status: 'REJECTED',
          reviewedAt: now,
          reviewedById: staffId,
          rejectionReason: input.reason,
          rejectionNote: input.note?.slice(0, 500) ?? null,
        },
      });
      if (updated.count === 0) {
        throw new AppException('PAYMENT_INVALID_STATE', { meta: { status: payment.status } });
      }
      if (payment.applicationId)
        await this.workflow.markTransferRejected(payment.applicationId, tx);
      return tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        include: {
          offer: { select: { name: true } },
          application: { select: { responseDueAt: true } },
        },
      });
    });
    await this.safeNotify(saved.userId, {
      ...transferRejectedMessage({
        applicationId: saved.applicationId ?? '',
        offerName: saved.offer.name,
        reason: input.reason,
        note: input.note ?? null,
        dueAt: saved.application?.responseDueAt ?? null,
      }),
      data: { paymentId, applicationId: saved.applicationId, offerId: saved.offerId },
      dedupeKey: `transfer-rejected:${paymentId}`,
    });
    return saved;
  }

  // ------------------------------------------------------------------------------------------------

  /** Postulación propia con saldo pendiente, en plazo, de México y MXN, con datos bancarios. */
  private async requireTransferable(userId: string, applicationId: string) {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, userId },
      include: { user: { select: { countryCode: true } } },
    });
    if (!application) throw AppException.notFound('La postulación no existe.');
    const decision = decideBalancePayment({
      status: application.status,
      balanceCents: application.balanceCents,
      hasCurrency: !!application.currency,
      responseDueAt: application.responseDueAt,
      // Reemplazar el comprobante pendiente está permitido.
      pendingTransfer: false,
      now: nowUtc(),
    });
    if (!decision.ok) {
      const meta = Object.fromEntries(
        Object.entries(decision.meta).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]),
      );
      throw new AppException(decision.code, { meta });
    }
    const availability = transferAvailability({
      isBalance: true,
      profileCountryCode: application.user.countryCode,
      currency: application.currency,
      bankConfigured: this.checkout.bankConfigured,
    });
    if (!availability.available) {
      throw new AppException('PAYMENT_TRANSFER_NOT_AVAILABLE', {
        meta: { reason: availability.reason },
      });
    }
    return application;
  }

  private async requirePendingTransfer(paymentId: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.method !== 'BANK_TRANSFER') {
      throw AppException.notFound('La transferencia no existe.');
    }
    if (payment.status !== 'PENDING_VALIDATION') {
      throw new AppException('PAYMENT_INVALID_STATE', { meta: { status: payment.status } });
    }
    return payment;
  }

  private async dto(paymentId: string): Promise<PaymentDto> {
    const row = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: PAYMENT_INCLUDE,
    });
    return toPaymentDto(row, nowUtc());
  }

  private async deleteFile(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (error) {
      this.logger.warn({ err: error, key }, 'No se pudo borrar el comprobante');
    }
  }

  private async safeNotify(
    userId: string,
    input: Omit<Parameters<NotificationsService['notify']>[0], 'userIds'>,
  ): Promise<void> {
    try {
      await this.notifications.notify({ userIds: [userId], ...input });
    } catch (error) {
      this.logger.error({ err: error }, 'No se pudo notificar la transferencia');
    }
  }
}
