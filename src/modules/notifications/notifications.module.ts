import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

/**
 * Notificaciones in-app + correo (HU-13). Exporta `NotificationsService.notify(...)` para que otros
 * módulos (inscripciones, jobs, Fases 04–06) emitan avisos.
 */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
