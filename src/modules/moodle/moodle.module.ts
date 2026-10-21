import { Module } from '@nestjs/common';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminMoodleController } from './admin/admin-moodle.controller';
import { AdminMoodleService } from './admin/admin-moodle.service';
import { MoodleController } from './moodle.controller';
import { MoodleAccessService } from './moodle-access.service';

/**
 * Acceso Moodle (Fase 05, HU-25): lista de correos y códigos de acceso → inscripción de origen
 * MOODLE. `AuthModule` lo importa para vincular al verificar el correo. Fase 06: panel
 * (`AdminMoodleController`: lista de correos y códigos).
 */
@Module({
  imports: [EnrollmentsModule, NotificationsModule],
  controllers: [MoodleController, AdminMoodleController],
  providers: [MoodleAccessService, AdminMoodleService],
  exports: [MoodleAccessService],
})
export class MoodleModule {}
