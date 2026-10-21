import { Module } from '@nestjs/common';
import { ApplicationsModule } from '../applications/applications.module';
import { CalendarModule } from '../calendar/calendar.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { LibraryModule } from '../library/library.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/** Dashboard del participante (HU-06). */
@Module({
  imports: [
    EnrollmentsModule,
    CalendarModule,
    LibraryModule,
    NotificationsModule,
    ApplicationsModule,
    PaymentsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
