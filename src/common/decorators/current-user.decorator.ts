import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Usuario autenticado que el guard JWT (Fase 01) coloca en `request.user`.
 * La Fase 01 debe ajustar esta interfaz al payload real del token.
 */
export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
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
