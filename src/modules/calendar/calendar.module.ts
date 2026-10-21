import { Module } from '@nestjs/common';
import { ApplicationsModule } from '../applications/applications.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

/** Calendario central (HU-10). */
@Module({
  imports: [EnrollmentsModule, ApplicationsModule],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
