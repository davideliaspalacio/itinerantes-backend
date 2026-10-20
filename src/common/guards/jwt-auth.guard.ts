import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AuthUser } from '../decorators/current-user.decorator';
import { OPTIONAL_AUTH_KEY } from '../decorators/optional-auth.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AppException } from '../errors/app.exception';

/** Payload del access token (firmado con JWT_ACCESS_SECRET). */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  roles: AuthUser['roles'];
  sid: string;
}

/**
 * Guard global (APP_GUARD): exige `Authorization: Bearer <accessToken>` salvo en rutas @Public().
 * Coloca el usuario en `request.user` (ver @CurrentUser()). En rutas @OptionalAuth() el token es
 * opcional: si es válido se usa; si falta o no es válido, la petición sigue como anónima.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = extractBearerToken(request.headers.authorization);

    if (this.reflector.getAllAndOverride<boolean | undefined>(OPTIONAL_AUTH_KEY, targets)) {
      if (token) request.user = (await this.verify(token)) ?? undefined;
      return true;
    }
    if (this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, targets)) return true;

    if (!token) throw new AppException('UNAUTHORIZED');
    const user = await this.verify(token);
    if (!user) {
      throw new AppException('UNAUTHORIZED', {
        message: 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.',
      });
    }
    request.user = user;
    return true;
  }

  /** Usuario del token, o null si la firma/vigencia no es válida. */
  private async verify(token: string): Promise<AuthUser | null> {
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      return {
        id: payload.sub,
        email: payload.email,
        roles: payload.roles ?? [],
        sessionId: payload.sid,
      };
    } catch {
      return null;
    }
  }
}

export function extractBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, value] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && value ? value : undefined;
}
