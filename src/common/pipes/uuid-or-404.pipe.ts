import { ParseUUIDPipe } from '@nestjs/common';
import { AppException } from '../errors/app.exception';

/**
 * Valida un `:id` UUID de ruta; si no es UUID responde 404 `NOT_FOUND` (un id mal formado es un
 * recurso inexistente, no un error de validación).
 *
 * @example markRead(@Param('id', uuidOr404('La notificación no existe.')) id: string) {}
 */
export function uuidOr404(message?: string): ParseUUIDPipe {
  return new ParseUUIDPipe({ exceptionFactory: () => AppException.notFound(message) });
}
