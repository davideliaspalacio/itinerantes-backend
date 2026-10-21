import { Module } from '@nestjs/common';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

/** Calendario central (HU-10). */
@Module({
  imports: [EnrollmentsModule],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
