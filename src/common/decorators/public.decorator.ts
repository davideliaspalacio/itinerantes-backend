import { applyDecorators, SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Clave de metadatos de @nestjs/swagger para `security` (DECORATORS.API_SECURITY). */
const SWAGGER_API_SECURITY = 'swagger/apiSecurity';

/** Marca la operación como sin autenticación en OpenAPI (`security: []`, sin candado en Scalar). */
const ApiNoAuth = (): MethodDecorator & ClassDecorator =>
  ((target: object, _key?: string | symbol, descriptor?: PropertyDescriptor) => {
    Reflect.defineMetadata(
      SWAGGER_API_SECURITY,
      [],
      descriptor ? (descriptor.value as object) : target,
    );
    return descriptor ?? target;
  }) as MethodDecorator & ClassDecorator;

/**
 * Marca un endpoint (o controlador completo) como público:
 * - El guard JWT global (Fase 01) lo deja pasar sin token (lee IS_PUBLIC_KEY).
 * - En OpenAPI aparece sin requisito de autenticación.
 *
 * Todas las rutas son protegidas por defecto.
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  applyDecorators(SetMetadata(IS_PUBLIC_KEY, true), ApiNoAuth());
