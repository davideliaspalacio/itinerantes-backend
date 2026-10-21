import { Module } from '@nestjs/common';
import { ApplicationsModule } from '../applications/applications.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { AdminCalendarController } from './admin/admin-calendar.controller';
import { AdminCalendarService } from './admin/admin-calendar.service';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

/** Calendario central (HU-10). */
@Module({
  imports: [EnrollmentsModule, ApplicationsModule],
  controllers: [CalendarController, AdminCalendarController],
  // Fase 06 (HU-29): calendario del panel y eventos manuales.
  providers: [CalendarService, AdminCalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
