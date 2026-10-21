import { Module } from '@nestjs/common';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { LiveSessionsModule } from '../live-sessions/live-sessions.module';
import { ClassroomController } from './classroom.controller';
import { ClassroomService } from './classroom.service';

/** Aula (HU-17), materiales (HU-08) y proyecto final. */
@Module({
  imports: [EnrollmentsModule, LiveSessionsModule],
  controllers: [ClassroomController],
  providers: [ClassroomService],
})
export class ClassroomModule {}
