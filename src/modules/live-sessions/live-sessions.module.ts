import { Module } from '@nestjs/common';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LiveSessionsController } from './live-sessions.controller';
import { LiveSessionsService } from './live-sessions.service';
import { PortalJobsService } from './portal-jobs.service';

/** Sesiones en vivo (HU-12), asistencia (HU-18) y jobs de avisos del portal (HU-13). */
@Module({
  imports: [EnrollmentsModule, NotificationsModule],
  controllers: [LiveSessionsController],
  providers: [LiveSessionsService, PortalJobsService],
  exports: [LiveSessionsService, PortalJobsService],
})
export class LiveSessionsModule {}
