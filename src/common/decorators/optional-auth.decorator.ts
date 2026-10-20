import { applyDecorators, SetMetadata } from '@nestjs/common';
import { BEARER_AUTH_NAME } from '../../config/openapi';

export const OPTIONAL_AUTH_KEY = 'optionalAuth';

/** Clave de metadatos de @nestjs/swagger para `security` (DECORATORS.API_SECURITY). */
const SWAGGER_API_SECURITY = 'swagger/apiSecurity';

/** OpenAPI: el token es opcional (`security: [{ bearer: [] }, {}]`). */
const ApiOptionalAuth = (): MethodDecorator & ClassDecorator =>
  ((target: object, _key?: string | symbol, descriptor?: PropertyDescriptor) => {
    Reflect.defineMetadata(
      SWAGGER_API_SECURITY,
      [{ [BEARER_AUTH_NAME]: [] }, {}],
      descriptor ? (descriptor.value as object) : target,
    );
    return descriptor ?? target;
  }) as MethodDecorator & ClassDecorator;

/**
 * Autenticación OPCIONAL: la ruta es pública, pero si llega `Authorization: Bearer <token>` válido,
 * el JwtAuthGuard coloca el usuario en `request.user` (lee con `@CurrentUser()`, que puede ser
 * `undefined`). Un token ausente, vencido o inválido NO produce 401: la petición sigue como
 * anónima (útil para páginas públicas que se personalizan con sesión, p. ej. catálogo HU-15).
 */
export const OptionalAuth = (): MethodDecorator & ClassDecorator =>
  applyDecorators(SetMetadata(OPTIONAL_AUTH_KEY, true), ApiOptionalAuth());
