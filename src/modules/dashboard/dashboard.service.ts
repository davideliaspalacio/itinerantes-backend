import { Injectable, Logger } from '@nestjs/common';
import { addDaysInZone, nowUtc } from '../../common/utils/time';
import { BUSINESS_RULES } from '../../config/business-rules';
import { ApplicationsService } from '../applications/applications.service';
import { CalendarService } from '../calendar/calendar.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { LibraryService } from '../library/library.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { DashboardBlock, DashboardDto } from './dashboard.dto';

/**
 * Dashboard del participante (HU-06). Compone los bloques en paralelo; un fallo en uno no afecta a
 * los demás (HU-06 criterio 5). Fase 04: widgets de Becas/Convocatorias. La Fase 05 agregará el
 * aviso de cuota.
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly enrollments: EnrollmentsService,
    private readonly calendar: CalendarService,
    private readonly library: LibraryService,
    private readonly notifications: NotificationsService,
    private readonly applications: ApplicationsService,
  ) {}

  async get(userId: string): Promise<DashboardDto> {
    const failed: DashboardBlock[] = [];
    const block = async <T>(name: DashboardBlock, run: () => Promise<T>): Promise<T | null> => {
      try {
        return await run();
      } catch (error) {
        this.logger.error({ err: error, block: name }, 'Bloque del Dashboard falló');
        failed.push(name);
        return null;
      }
    };

    const now = nowUtc();
    const [
      nextActivity,
      formations,
      upcomingEvents,
      recommendedResources,
      notifications,
      scholarships,
      openCalls,
    ] = await Promise.all([
      block('nextActivity', async () => {
        const items = await this.calendar.range(
          userId,
          now,
          addDaysInZone(now, BUSINESS_RULES.CALENDAR_MAX_RANGE_DAYS - 1),
        );
        return (
          items.find(
            (i) =>
              i.status !== 'CANCELLED' &&
              i.category !== 'IMPORTANT_DATES' &&
              new Date(i.endsAt ?? i.startsAt) > now,
          ) ?? null
        );
      }),
      block('formations', () => this.enrollments.activeCards(userId)),
      block('upcomingEvents', () => this.calendar.upcoming(userId)),
      block('recommendedResources', () => this.library.recommended(userId)),
      block('notifications', () => this.notifications.unreadCount(userId)),
      block('scholarships', () => this.applications.widget(userId, 'SCHOLARSHIP')),
      block('openCalls', () => this.applications.widget(userId, 'OPEN_CALL')),
    ]);

    return {
      nextActivity,
      formations,
      upcomingEvents,
      recommendedResources,
      notifications,
      scholarships,
      openCalls,
      failedBlocks: failed,
    };
  }
}
