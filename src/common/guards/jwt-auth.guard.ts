import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AuthUser } from '../decorators/current-user.decorator';
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
 * Coloca el usuario en `request.user` (ver @CurrentUser()).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) throw new AppException('UNAUTHORIZED');

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      request.user = {
        id: payload.sub,
        email: payload.email,
        roles: payload.roles ?? [],
        sessionId: payload.sid,
      };
      return true;
    } catch {
      throw new AppException('UNAUTHORIZED', {
        message: 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.',
      });
    }
  }
}

export function extractBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, value] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && value ? value : undefined;
}
