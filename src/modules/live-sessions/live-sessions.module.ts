import { Module } from '@nestjs/common';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminAttendanceController } from './admin/admin-attendance.controller';
import { AdminAttendanceService } from './admin/admin-attendance.service';
import { AdminSessionsController } from './admin/admin-sessions.controller';
import { AdminSessionsService } from './admin/admin-sessions.service';
import { LiveSessionsController } from './live-sessions.controller';
import { LiveSessionsService } from './live-sessions.service';
import { PortalJobsService } from './portal-jobs.service';

/** Sesiones en vivo (HU-12), asistencia (HU-18) y jobs de avisos del portal (HU-13). */
@Module({
  imports: [EnrollmentsModule, NotificationsModule],
  controllers: [LiveSessionsController, AdminSessionsController, AdminAttendanceController],
  // Fase 06 (HU-29/30): sesiones y asistencia del panel.
  providers: [LiveSessionsService, PortalJobsService, AdminSessionsService, AdminAttendanceService],
  exports: [LiveSessionsService, PortalJobsService],
})
export class LiveSessionsModule {}
