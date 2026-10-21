import { Injectable, Logger } from '@nestjs/common';
import { isEmail } from 'class-validator';
import { AppException } from '../../common/errors/app.exception';
import { nowUtc } from '../../common/utils/time';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PORTAL_LINKS } from '../notifications/portal-links';
import type { MoodleLinkResultDto, MoodleRosterImportResult } from './dto/moodle.dto';
import {
  accessCodeHint,
  decideAccessCode,
  generateAccessCode,
  hashAccessCode,
  normalizeAccessCode,
} from './policies/moodle-code.policy';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Acceso de participantes inscritos por Moodle (HU-25). Sin API de Moodle (Anexo A): el equipo carga
 * la lista de correos por oferta/cohorte o genera códigos de un solo uso (Fase 06, HU-27). Vincular
 * crea una inscripción ACTIVE de origen MOODLE (`source` MOODLE_LIST / MOODLE_ACCESS_CODE) y notifica
 * MOODLE_ENROLLMENT_LINKED. Sin inscripción no hay acceso al Aula (EnrollmentAccessService).
 */
@Injectable()
export class MoodleAccessService {
  private readonly logger = new Logger(MoodleAccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollments: EnrollmentsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** "¿No ves tu formación?" y al verificar el correo (HU-03): vincula por correo. */
  async linkByEmail(userId: string): Promise<MoodleLinkResultDto> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.status !== 'ACTIVE') return { found: false, linked: [] };
    const entries = await this.prisma.moodleRosterEntry.findMany({
      where: {
        email: normalizeEmail(user.email),
        offer: { origin: 'MOODLE' },
        OR: [{ linkedUserId: null }, { linkedUserId: userId }],
      },
      select: { id: true, offerId: true },
    });
    const linkedOfferIds: string[] = [];
    for (const entry of entries) {
      const now = nowUtc();
      const result = await this.prisma.$transaction(async (tx) => {
        const linked = await this.enrollments.linkMoodle(tx, {
          userId,
          offerId: entry.offerId,
          source: 'MOODLE_LIST',
          now,
        });
        await tx.moodleRosterEntry.update({
          where: { id: entry.id },
          data: { linkedUserId: userId, linkedAt: now },
        });
        return linked;
      });
      if (result.linked) {
        linkedOfferIds.push(entry.offerId);
        await this.notifyLinked(userId, entry.offerId, result.enrollment.id);
      }
    }
    const linked = await Promise.all(
      linkedOfferIds.map((offerId) => this.enrollments.cardFor(userId, offerId)),
    );
    return { found: entries.length > 0, linked };
  }

  /** Best effort tras verificar el correo: nunca rompe el registro. */
  async linkAfterVerification(userId: string): Promise<void> {
    try {
      await this.linkByEmail(userId);
    } catch (error) {
      this.logger.error({ err: error, userId }, 'No se pudo vincular la inscripción Moodle');
    }
  }

  /** Código de acceso (HU-25): un solo uso, vigente hasta el fin de la cohorte. */
  async redeemCode(userId: string, rawCode: string): Promise<MoodleLinkResultDto> {
    const code = normalizeAccessCode(rawCode);
    if (!code) throw new AppException('MOODLE_CODE_INVALID');
    const now = nowUtc();
    const record = await this.prisma.moodleAccessCode.findUnique({
      where: { codeHash: hashAccessCode(code) },
      include: { offer: { select: { origin: true } } },
    });
    const decision = decideAccessCode(
      record
        ? { usedAt: record.usedAt, expiresAt: record.expiresAt, offerOrigin: record.offer.origin }
        : null,
      now,
    );
    if (!decision.ok) throw new AppException(decision.code);
    const access = record!;
    const existing = await this.prisma.enrollment.findUnique({
      where: { userId_offerId: { userId, offerId: access.offerId } },
      select: { status: true },
    });
    if (existing && ['ACTIVE', 'COMPLETED', 'SUSPENDED'].includes(existing.status)) {
      throw new AppException('ENROLLMENT_ALREADY_EXISTS', {
        meta: { enrollmentStatus: existing.status },
      });
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.moodleAccessCode.updateMany({
        where: { id: access.id, usedAt: null },
        data: { usedAt: now, usedById: userId },
      });
      if (claimed.count === 0) throw new AppException('MOODLE_CODE_USED');
      return this.enrollments.linkMoodle(tx, {
        userId,
        offerId: access.offerId,
        source: 'MOODLE_ACCESS_CODE',
        now,
      });
    });
    await this.notifyLinked(userId, access.offerId, result.enrollment.id);
    return { found: true, linked: [await this.enrollments.cardFor(userId, access.offerId)] };
  }

  // --- Fase 06 (HU-27 paso "Origen y precio") ------------------------------------------------------

  /**
   * Carga la lista de correos inscritos en una oferta Moodle (idempotente, sin duplicados) y vincula
   * de inmediato a quienes ya tienen cuenta verificada ("o el equipo carga la lista", HU-25).
   */
  async importRoster(
    offerId: string,
    emails: readonly string[],
    staffId: string | null,
  ): Promise<MoodleRosterImportResult> {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      select: { origin: true },
    });
    if (!offer) throw AppException.notFound('La oferta no existe.');
    if (offer.origin !== 'MOODLE') {
      throw new AppException('PAYMENT_NOT_ALLOWED', {
        message: 'Solo las ofertas de origen Moodle tienen lista de inscritos.',
      });
    }
    const normalized = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
    const invalid = normalized.filter((e) => !isEmail(e));
    const valid = normalized.filter((e) => isEmail(e));
    const created = await this.prisma.moodleRosterEntry.createMany({
      data: valid.map((email) => ({ offerId, email, createdById: staffId })),
      skipDuplicates: true,
    });
    const users = await this.prisma.user.findMany({
      where: { email: { in: valid }, status: 'ACTIVE' },
      select: { id: true },
    });
    let linkedUsers = 0;
    for (const user of users) {
      const result = await this.linkByEmail(user.id);
      linkedUsers += result.linked.length > 0 ? 1 : 0;
    }
    return {
      added: created.count,
      duplicates: valid.length - created.count + (emails.length - normalized.length),
      invalid,
      linkedUsers,
    };
  }

  /**
   * Genera `count` códigos de acceso (se devuelven en claro UNA sola vez; solo se guarda el hash).
   * Vencen al fin de la cohorte (`offer.endsAt`).
   */
  async generateCodes(offerId: string, count: number, staffId: string | null): Promise<string[]> {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      select: { origin: true, endsAt: true },
    });
    if (!offer || offer.origin !== 'MOODLE') throw AppException.notFound('La oferta no existe.');
    const codes: string[] = [];
    while (codes.length < count) {
      const code = generateAccessCode();
      const result = await this.prisma.moodleAccessCode.createMany({
        data: [
          {
            offerId,
            codeHash: hashAccessCode(code),
            codeHint: accessCodeHint(code),
            expiresAt: offer.endsAt,
            createdById: staffId,
          },
        ],
        skipDuplicates: true,
      });
      if (result.count === 1) codes.push(code);
    }
    return codes;
  }

  private async notifyLinked(userId: string, offerId: string, enrollmentId: string): Promise<void> {
    try {
      const offer = await this.prisma.offer.findUniqueOrThrow({
        where: { id: offerId },
        select: { name: true },
      });
      await this.notifications.notify({
        userIds: [userId],
        type: 'MOODLE_ENROLLMENT_LINKED',
        title: `Tu formación ya está en el portal: ${offer.name}`,
        body:
          `Vinculamos tu inscripción de Moodle a ${offer.name}. Encuéntrala en Mi formación ` +
          '(etiqueta "Vía Moodle") con sus materiales y sesiones. No necesitas pagar de nuevo.',
        action: { label: 'Ir a mi aula', path: PORTAL_LINKS.classroom(offerId) },
        data: { offerId, enrollmentId },
        dedupeKey: `moodle-linked:${enrollmentId}`,
      });
    } catch (error) {
      this.logger.error({ err: error, offerId }, 'No se pudo notificar la vinculación Moodle');
    }
  }
}
