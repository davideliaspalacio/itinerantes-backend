import { Module } from '@nestjs/common';
import { AdminMeetingsController } from './admin/admin-meetings.controller';
import { MeetingsService } from './meetings.service';

/**
 * Reuniones de Zoom / Google Meet generadas desde el panel (`/admin/meetings`). Usa el puerto global
 * `MEETING_GATEWAY` (`MeetingsInfraModule`) y `AuditService`; no depende de otros dominios.
 */
@Module({
  controllers: [AdminMeetingsController],
  providers: [MeetingsService],
})
export class MeetingsModule {}
