import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Role } from '../../generated/prisma/client';

/**
 * Usuario autenticado que el JwtAuthGuard coloca en `request.user` (payload del access token).
 */
export interface AuthUser {
  /** Id del usuario (claim `sub`). */
  id: string;
  email: string;
  roles: Role[];
  /** Id de la sesión (familia de refresh tokens) que emitió el token (claim `sid`). */
  sessionId: string;
}

/**
 * Inyecta el usuario autenticado (o una de sus propiedades) en el handler.
 *
 * @example
 * getMe(@CurrentUser() user: AuthUser) {}
 * getMine(@CurrentUser('id') userId: string) {}
 */
export const CurrentUser = createParamDecorator(
  (property: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    return property ? user?.[property] : user;
  },
);
