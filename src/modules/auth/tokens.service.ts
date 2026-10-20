import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { AppException } from '../../common/errors/app.exception';
import type { AccessTokenPayload } from '../../common/guards/jwt-auth.guard';
import { randomToken, sha256Hex } from '../../common/utils/crypto';
import { parseDurationToSeconds } from '../../common/utils/duration';
import type { Env } from '../../config/env.schema';
import { Role, UserStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { checkRefreshToken, refreshTokenExpiresAt, RefreshTtlConfig } from './auth.policy';
import type { TokenPairDto } from './dto/auth.response.dto';

interface TokenSubject {
  id: string;
  email: string;
  roles: Role[];
}

/**
 * Emisión de tokens: access JWT corto + refresh token opaco rotativo (solo hash en BD).
 * Una "sesión" = una familia de refresh tokens (`familyId`, claim `sid` del access token).
 */
@Injectable()
export class TokensService {
  private readonly accessTtlSeconds: number;
  private readonly refreshTtl: RefreshTtlConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    this.accessTtlSeconds = parseDurationToSeconds(config.get('JWT_ACCESS_TTL', { infer: true }));
    this.refreshTtl = {
      ttlDays: config.get('JWT_REFRESH_TTL_DAYS', { infer: true }),
      rememberTtlDays: config.get('JWT_REFRESH_REMEMBER_TTL_DAYS', { infer: true }),
    };
  }

  /** Nueva sesión (login). */
  async createSession(
    user: TokenSubject,
    rememberMe: boolean,
    userAgent?: string,
    now = new Date(),
  ): Promise<TokenPairDto> {
    const familyId = randomUUID();
    const refreshToken = randomToken();
    const expiresAt = refreshTokenExpiresAt(now, rememberMe, this.refreshTtl);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash: sha256Hex(refreshToken),
        rememberMe,
        expiresAt,
        userAgent: userAgent?.slice(0, 255),
        createdAt: now,
      },
    });
    return this.buildPair(user, familyId, refreshToken, expiresAt, now);
  }

  /**
   * Rota el refresh token: invalida el recibido y emite otro de la misma familia. Si llega uno ya
   * rotado (reuso → posible robo) se revoca toda la familia.
   * @throws AUTH_REFRESH_INVALID
   */
  async rotate(refreshToken: string, userAgent?: string, now = new Date()): Promise<TokenPairDto> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256Hex(refreshToken) },
      include: { user: { select: { id: true, email: true, roles: true, status: true } } },
    });
    const check = checkRefreshToken(record, now);
    if (check === 'REUSED' && record) await this.revokeFamily(record.familyId, now);
    if (check !== 'VALID' || !record) throw new AppException('AUTH_REFRESH_INVALID');
    if (record.user.status !== UserStatus.ACTIVE) {
      await this.revokeFamily(record.familyId, now);
      throw new AppException('AUTH_REFRESH_INVALID');
    }

    const nextId = randomUUID();
    const nextToken = randomToken();
    const nextExpiresAt = refreshTokenExpiresAt(now, record.rememberMe, this.refreshTtl);
    const rotated = await this.prisma.$transaction(async (tx) => {
      // Reclamo atómico: si dos peticiones usan el mismo token, solo una gana.
      const claimed = await tx.refreshToken.updateMany({
        where: { id: record.id, revokedAt: null },
        data: { revokedAt: now, replacedById: nextId },
      });
      if (claimed.count === 0) return false;
      await tx.refreshToken.create({
        data: {
          id: nextId,
          userId: record.userId,
          familyId: record.familyId,
          tokenHash: sha256Hex(nextToken),
          rememberMe: record.rememberMe,
          expiresAt: nextExpiresAt,
          userAgent: userAgent?.slice(0, 255),
          createdAt: now,
        },
      });
      return true;
    });
    if (!rotated) {
      await this.revokeFamily(record.familyId, now);
      throw new AppException('AUTH_REFRESH_INVALID');
    }
    return this.buildPair(record.user, record.familyId, nextToken, nextExpiresAt, now);
  }

  /** Logout: revoca la sesión (familia) del token. Idempotente. */
  async revokeByToken(refreshToken: string, now = new Date()): Promise<void> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256Hex(refreshToken) },
      select: { familyId: true },
    });
    if (record) await this.revokeFamily(record.familyId, now);
  }

  /** Cierra todas las sesiones del usuario (reset de contraseña), opcionalmente salvo una. */
  async revokeAllForUser(userId: string, exceptFamilyId?: string, now = new Date()): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptFamilyId ? { familyId: { not: exceptFamilyId } } : {}),
      },
      data: { revokedAt: now },
    });
  }

  private async revokeFamily(familyId: string, now: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  private async buildPair(
    user: TokenSubject,
    familyId: string,
    refreshToken: string,
    refreshTokenExpiresAt: Date,
    now: Date,
  ): Promise<TokenPairDto> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      sid: familyId,
    };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: this.accessTtlSeconds });
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTtlSeconds,
      accessTokenExpiresAt: new Date(now.getTime() + this.accessTtlSeconds * 1000),
      refreshToken,
      refreshTokenExpiresAt,
    };
  }
}
