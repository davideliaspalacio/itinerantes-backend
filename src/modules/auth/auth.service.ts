import { Injectable } from '@nestjs/common';
import { isEmail } from 'class-validator';
import { AppException } from '../../common/errors/app.exception';
import { maskEmail, randomToken, sha256Hex } from '../../common/utils/crypto';
import { BUSINESS_RULES } from '../../config/business-rules';
import { OtpPurpose, User, UserStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { MoodleAccessService } from '../moodle/moodle-access.service';
import { USERNAME_PATTERN } from '../users/dto/user-fields';
import { PasswordService } from '../users/password.service';
import { UsersService } from '../users/users.service';
import {
  evaluateFailedLogin,
  isLoginLocked,
  normalizeEmail,
  normalizeUsername,
} from './auth.policy';
import type {
  ChangePasswordRequestDto,
  LoginRequestDto,
  RegisterRequestDto,
  ResetPasswordRequestDto,
} from './dto/auth.request.dto';
import type {
  AvailabilityResponseDto,
  LoginResponseDto,
  OtpDeliveryDto,
  RegisterResponseDto,
  ResetTokenResponseDto,
  TokenPairDto,
  VerifyEmailResponseDto,
} from './dto/auth.response.dto';
import { OTP_RULES, otpExpiresAt, resendAvailableAt } from './otp.policy';
import { OtpService } from './otp.service';
import { TokensService } from './tokens.service';

/**
 * Casos de uso de identidad: registro (HU-02), verificación (HU-03), login (HU-04),
 * recuperación (HU-05) y cambio de contraseña (HU-14 "Seguridad").
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly otp: OtpService,
    private readonly tokens: TokensService,
    private readonly moodle: MoodleAccessService,
  ) {}

  // --- HU-02 -------------------------------------------------------------------------------------

  async register(dto: RegisterRequestDto): Promise<RegisterResponseDto> {
    const passwordHash = await this.passwords.hash(dto.password);
    const user = await this.users.create({
      fullName: dto.fullName,
      username: dto.username,
      email: dto.email,
      passwordHash,
      phone: dto.phone,
      location: dto.location,
      timezone: dto.timezone,
    });
    const otp = await this.otp.issue(user, OtpPurpose.EMAIL_VERIFICATION);
    return { userId: user.id, email: user.email, status: user.status, otp };
  }

  async availability(email?: string, username?: string): Promise<AvailabilityResponseDto> {
    if (email === undefined && username === undefined) {
      throw AppException.validation([
        { field: 'email', code: 'REQUIRED', message: 'Envía email o username.' },
      ]);
    }
    const normalizedEmail = email !== undefined ? normalizeEmail(email) : undefined;
    const normalizedUsername = username !== undefined ? normalizeUsername(username) : undefined;
    const emailValid = normalizedEmail !== undefined && isEmail(normalizedEmail);
    const usernameValid =
      normalizedUsername !== undefined && USERNAME_PATTERN.test(normalizedUsername);
    const free = await this.users.availability(
      emailValid ? normalizedEmail : undefined,
      usernameValid ? normalizedUsername : undefined,
    );
    return {
      ...(normalizedEmail !== undefined
        ? {
            email: {
              value: normalizedEmail,
              valid: emailValid,
              available: emailValid && free.email === true,
            },
          }
        : {}),
      ...(normalizedUsername !== undefined
        ? {
            username: {
              value: normalizedUsername,
              valid: usernameValid,
              available: usernameValid && free.username === true,
            },
          }
        : {}),
    };
  }

  // --- HU-03 -------------------------------------------------------------------------------------

  async verifyEmail(email: string, code: string): Promise<VerifyEmailResponseDto> {
    const user = await this.users.findByEmail(email);
    if (!user) throw new AppException('AUTH_OTP_INVALID');
    if (user.status === UserStatus.ACTIVE) throw new AppException('AUTH_ALREADY_VERIFIED');
    if (user.status === UserStatus.DISABLED) throw new AppException('AUTH_ACCOUNT_DISABLED');

    const otp = await this.otp.verify(user.id, OtpPurpose.EMAIL_VERIFICATION, code);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: now } }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.ACTIVE, emailVerifiedAt: now },
      }),
    ]);
    // HU-25: si el correo está en la lista de una oferta Moodle, la formación se vincula sola.
    await this.moodle.linkAfterVerification(user.id);
    return { verified: true, email: user.email };
  }

  /** HU-03 / HU-05: reenviar el código. */
  async resendOtp(email: string, purpose: OtpPurpose): Promise<OtpDeliveryDto> {
    if (purpose === OtpPurpose.PASSWORD_RESET) return this.forgotPassword(email);

    const user = await this.users.findByEmail(email);
    if (!user) throw new AppException('AUTH_ACCOUNT_NOT_FOUND');
    if (user.status === UserStatus.ACTIVE) throw new AppException('AUTH_ALREADY_VERIFIED');
    if (user.status === UserStatus.DISABLED) throw new AppException('AUTH_ACCOUNT_DISABLED');
    return this.otp.issue(user, OtpPurpose.EMAIL_VERIFICATION);
  }

  // --- HU-04 -------------------------------------------------------------------------------------

  async login(dto: LoginRequestDto, userAgent?: string): Promise<LoginResponseDto> {
    const now = new Date();
    const user = await this.users.findByEmail(dto.email);
    if (!user) {
      await this.passwords.verifyDummy(dto.password);
      throw new AppException('AUTH_INVALID_CREDENTIALS');
    }
    if (isLoginLocked(user.loginLockedUntil, now)) {
      throw new AppException('AUTH_LOGIN_LOCKED', { meta: { lockedUntil: user.loginLockedUntil } });
    }

    if (!(await this.passwords.verify(user.passwordHash, dto.password))) {
      await this.registerFailedLogin(user, now);
    }

    if (user.status === UserStatus.DISABLED) throw new AppException('AUTH_ACCOUNT_DISABLED');
    if (user.status === UserStatus.PENDING_VERIFICATION) {
      await this.resetLoginCounters(user);
      // HU-02/HU-03: pedir verificación; reenviar el OTP solo si el cooldown lo permite.
      const attempt = await this.otp.tryIssue(user, OtpPurpose.EMAIL_VERIFICATION, now);
      throw new AppException('AUTH_EMAIL_NOT_VERIFIED', {
        meta: {
          email: user.email,
          maskedEmail: maskEmail(user.email),
          otpSent: attempt.sent,
          codeLength: OTP_RULES.length,
          expiresAt: attempt.expiresAt,
          resendAvailableAt: attempt.resendAvailableAt,
          lockedUntil: attempt.lockedUntil,
        },
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, loginLockedUntil: null, lastLoginAt: now },
    });
    const tokens = await this.tokens.createSession(user, dto.rememberMe ?? false, userAgent, now);
    return { ...tokens, user: await this.users.toProfile(user.id) };
  }

  refresh(refreshToken: string, userAgent?: string): Promise<TokenPairDto> {
    return this.tokens.rotate(refreshToken, userAgent);
  }

  logout(refreshToken: string): Promise<void> {
    return this.tokens.revokeByToken(refreshToken);
  }

  // --- HU-05 -------------------------------------------------------------------------------------

  /** Paso 1: envía el OTP de recuperación. */
  async forgotPassword(email: string): Promise<OtpDeliveryDto> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      if (BUSINESS_RULES.REVEAL_UNKNOWN_EMAIL_ON_RESET) {
        throw new AppException('AUTH_ACCOUNT_NOT_FOUND');
      }
      // Modo anti-enumeración: misma respuesta que si la cuenta existiera.
      const now = new Date();
      return {
        maskedEmail: maskEmail(normalizeEmail(email)),
        codeLength: OTP_RULES.length,
        expiresAt: otpExpiresAt(now),
        resendAvailableAt: resendAvailableAt(now),
      };
    }
    if (user.status === UserStatus.DISABLED) throw new AppException('AUTH_ACCOUNT_DISABLED');
    return this.otp.issue(user, OtpPurpose.PASSWORD_RESET);
  }

  /** Paso 2: verifica el OTP y entrega un resetToken de un solo uso. */
  async verifyResetOtp(email: string, code: string): Promise<ResetTokenResponseDto> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      throw new AppException(
        BUSINESS_RULES.REVEAL_UNKNOWN_EMAIL_ON_RESET
          ? 'AUTH_ACCOUNT_NOT_FOUND'
          : 'AUTH_OTP_INVALID',
      );
    }
    const otp = await this.otp.verify(user.id, OtpPurpose.PASSWORD_RESET, code);
    const now = new Date();
    const resetToken = randomToken();
    const expiresAt = new Date(
      now.getTime() + BUSINESS_RULES.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60_000,
    );
    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: {
        verifiedAt: now,
        resetTokenHash: sha256Hex(resetToken),
        resetTokenExpiresAt: expiresAt,
      },
    });
    return { resetToken, expiresAt };
  }

  /** Paso 3: nueva contraseña. Invalida el OTP y cierra todas las sesiones. */
  async resetPassword(dto: ResetPasswordRequestDto): Promise<void> {
    const now = new Date();
    const otp = await this.prisma.otpCode.findUnique({
      where: { resetTokenHash: sha256Hex(dto.resetToken) },
      include: { user: true },
    });
    const usable =
      otp &&
      otp.purpose === OtpPurpose.PASSWORD_RESET &&
      otp.verifiedAt &&
      !otp.consumedAt &&
      !otp.invalidatedAt &&
      otp.resetTokenExpiresAt &&
      otp.resetTokenExpiresAt.getTime() > now.getTime();
    if (!usable) throw new AppException('AUTH_RESET_TOKEN_INVALID');
    if (otp.user.status === UserStatus.DISABLED) throw new AppException('AUTH_ACCOUNT_DISABLED');

    const passwordHash = await this.passwords.hash(dto.newPassword);
    const consumed = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.otpCode.updateMany({
        where: { id: otp.id, consumedAt: null, invalidatedAt: null },
        data: { consumedAt: now },
      });
      if (claim.count === 0) return false;
      await tx.otpCode.updateMany({
        where: {
          userId: otp.userId,
          purpose: OtpPurpose.PASSWORD_RESET,
          consumedAt: null,
          invalidatedAt: null,
        },
        data: { invalidatedAt: now },
      });
      await tx.user.update({
        where: { id: otp.userId },
        data: {
          passwordHash,
          failedLoginAttempts: 0,
          loginLockedUntil: null,
          // Recuperar por OTP demuestra que el correo es suyo: activa una cuenta pendiente.
          ...(otp.user.status === UserStatus.PENDING_VERIFICATION
            ? { status: UserStatus.ACTIVE, emailVerifiedAt: now }
            : {}),
        },
      });
      return true;
    });
    if (!consumed) throw new AppException('AUTH_RESET_TOKEN_INVALID');
    await this.tokens.revokeAllForUser(otp.userId, undefined, now);
  }

  // --- HU-14 "Seguridad" -------------------------------------------------------------------------

  /** Cambia la contraseña validando la actual; cierra las demás sesiones (no la actual). */
  async changePassword(
    userId: string,
    sessionId: string,
    dto: ChangePasswordRequestDto,
  ): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user || user.status !== UserStatus.ACTIVE) throw new AppException('UNAUTHORIZED');
    if (!(await this.passwords.verify(user.passwordHash, dto.currentPassword))) {
      throw new AppException('AUTH_CURRENT_PASSWORD_INVALID', {
        details: [
          {
            field: 'currentPassword',
            code: 'INVALID',
            message: 'La contraseña actual es incorrecta.',
          },
        ],
      });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.passwords.hash(dto.newPassword) },
    });
    await this.tokens.revokeAllForUser(userId, sessionId);
  }

  // --- internos ----------------------------------------------------------------------------------

  /** Suma un intento fallido (atómico) y bloquea al llegar al máximo. Siempre lanza. */
  private async registerFailedLogin(user: User, now: Date): Promise<never> {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
    const outcome = evaluateFailedLogin(updated.failedLoginAttempts, now);
    if (outcome.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: outcome.attempts, loginLockedUntil: outcome.lockedUntil },
      });
      throw new AppException('AUTH_LOGIN_LOCKED', { meta: { lockedUntil: outcome.lockedUntil } });
    }
    throw new AppException('AUTH_INVALID_CREDENTIALS');
  }

  private async resetLoginCounters(user: User): Promise<void> {
    if (user.failedLoginAttempts === 0 && !user.loginLockedUntil) return;
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, loginLockedUntil: null },
    });
  }
}
