import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../common/errors/app.exception';
import { hmacSha256Hex, maskEmail, randomNumericCode, safeEqual } from '../../common/utils/crypto';
import type { Env } from '../../config/env.schema';
import { OtpCode, OtpPurpose } from '../../generated/prisma/client';
import { MailService } from '../../infra/mail/mail.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { buildOtpEmail } from './auth.mails';
import type { OtpDeliveryDto } from './dto/auth.response.dto';
import {
  checkOtpUsability,
  decideIssue,
  evaluateFailedAttempt,
  OTP_RULES,
  otpExpiresAt,
  resendAvailableAt,
} from './otp.policy';

interface OtpRecipient {
  id: string;
  email: string;
  fullName: string;
}

/** Resultado de un intento de envío que no lanza (login con cuenta sin verificar). */
export interface OtpSendAttempt {
  sent: boolean;
  /** Vencimiento del código vigente (null si no hay uno usable). */
  expiresAt: Date | null;
  resendAvailableAt: Date;
  lockedUntil: Date | null;
}

/**
 * Ciclo de vida del OTP (HU-03 / HU-05): emisión con cooldown, verificación con intentos y bloqueo.
 * Las reglas puras están en otp.policy.ts; aquí solo hay persistencia y correo.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    config: ConfigService<Env, true>,
  ) {
    this.secret = config.get('JWT_ACCESS_SECRET', { infer: true });
  }

  latest(userId: string, purpose: OtpPurpose): Promise<OtpCode | null> {
    return this.prisma.otpCode.findFirst({
      where: { userId, purpose },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Emite un código nuevo (invalida los anteriores) y lo envía por correo.
   * @throws AUTH_OTP_LOCKED | AUTH_OTP_COOLDOWN (con `meta`).
   */
  async issue(user: OtpRecipient, purpose: OtpPurpose, now = new Date()): Promise<OtpDeliveryDto> {
    const decision = decideIssue(await this.latest(user.id, purpose), now);
    if (!decision.allowed) {
      throw decision.reason === 'LOCKED'
        ? new AppException('AUTH_OTP_LOCKED', { meta: { lockedUntil: decision.until } })
        : new AppException('AUTH_OTP_COOLDOWN', { meta: { resendAvailableAt: decision.until } });
    }

    const code = randomNumericCode(OTP_RULES.length);
    const expiresAt = otpExpiresAt(now);
    await this.prisma.$transaction([
      this.prisma.otpCode.updateMany({
        where: { userId: user.id, purpose, consumedAt: null, invalidatedAt: null },
        data: { invalidatedAt: now },
      }),
      this.prisma.otpCode.create({
        data: {
          userId: user.id,
          purpose,
          codeHash: this.hash(user.id, purpose, code),
          expiresAt,
          attempts: decision.carriedAttempts,
          createdAt: now,
        },
      }),
    ]);

    await this.send(user, purpose, code);
    return {
      maskedEmail: maskEmail(user.email),
      codeLength: OTP_RULES.length,
      expiresAt,
      resendAvailableAt: resendAvailableAt(now),
    };
  }

  /** Igual que `issue` pero sin lanzar si el cooldown o el bloqueo lo impiden. */
  async tryIssue(
    user: OtpRecipient,
    purpose: OtpPurpose,
    now = new Date(),
  ): Promise<OtpSendAttempt> {
    try {
      const delivery = await this.issue(user, purpose, now);
      return {
        sent: true,
        expiresAt: delivery.expiresAt,
        resendAvailableAt: delivery.resendAvailableAt,
        lockedUntil: null,
      };
    } catch (error) {
      if (!(error instanceof AppException)) throw error;
      const latest = await this.latest(user.id, purpose);
      const usability = checkOtpUsability(latest, now);
      return {
        sent: false,
        expiresAt: usability.status === 'USABLE' && latest ? latest.expiresAt : null,
        resendAvailableAt: latest ? resendAvailableAt(latest.createdAt) : now,
        lockedUntil: usability.status === 'LOCKED' ? usability.lockedUntil : null,
      };
    }
  }

  /**
   * Verifica el código contra el último emitido. No lo consume (lo hace quien llama, en su
   * transacción). Cada fallo suma un intento; al llegar al máximo se bloquea.
   * @throws AUTH_OTP_LOCKED | AUTH_OTP_EXPIRED | AUTH_OTP_INVALID (con `meta`).
   */
  async verify(
    userId: string,
    purpose: OtpPurpose,
    code: string,
    now = new Date(),
  ): Promise<OtpCode> {
    const latest = await this.latest(userId, purpose);
    const usability = checkOtpUsability(latest, now);
    if (usability.status === 'LOCKED') {
      throw new AppException('AUTH_OTP_LOCKED', { meta: { lockedUntil: usability.lockedUntil } });
    }
    if (usability.status !== 'USABLE' || !latest) {
      throw new AppException('AUTH_OTP_EXPIRED', {
        meta: { resendAvailableAt: latest ? resendAvailableAt(latest.createdAt) : now },
      });
    }

    if (safeEqual(this.hash(userId, purpose, code), latest.codeHash)) return latest;

    const updated = await this.prisma.otpCode.update({
      where: { id: latest.id },
      data: { attempts: { increment: 1 } },
    });
    const outcome = evaluateFailedAttempt(updated.attempts, now);
    if (outcome.locked) {
      await this.prisma.otpCode.update({
        where: { id: latest.id },
        data: { lockedUntil: outcome.lockedUntil, invalidatedAt: now },
      });
      throw new AppException('AUTH_OTP_LOCKED', { meta: { lockedUntil: outcome.lockedUntil } });
    }
    throw new AppException('AUTH_OTP_INVALID', {
      meta: { attemptsRemaining: outcome.attemptsRemaining },
    });
  }

  private hash(userId: string, purpose: OtpPurpose, code: string): string {
    return hmacSha256Hex(this.secret, `${userId}:${purpose}:${code}`);
  }

  /** El fallo del correo no rompe el flujo: el usuario puede reenviar el código. */
  private async send(user: OtpRecipient, purpose: OtpPurpose, code: string): Promise<void> {
    const { subject, layout } = buildOtpEmail(purpose, {
      fullName: user.fullName,
      code,
      ttlMinutes: OTP_RULES.ttlMinutes,
    });
    try {
      await this.mail.sendLayout(user.email, subject, layout);
    } catch (error) {
      this.logger.error({ err: error, userId: user.id, purpose }, 'No se pudo enviar el OTP');
    }
  }
}
