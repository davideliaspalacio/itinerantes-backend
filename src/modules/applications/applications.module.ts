import { Module } from '@nestjs/common';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { LocationsModule } from '../locations/locations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ApplicationJobsService } from './application-jobs.service';
import { ApplicationLookupService } from './application-lookup.service';
import { ApplicationWorkflowService } from './application-workflow.service';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

/**
 * Postulaciones a becas y convocatorias (Fase 04: HU-19, 20, 21).
 * - `ApplicationsService`: endpoints del participante (`/me/applications…`), widgets del Dashboard y
 *   entrevistas del Calendario.
 * - `ApplicationWorkflowService`: máquina de estados (transiciones reutilizables por las Fases 05/06).
 * - `ApplicationLookupService`: `OfferApplicationLookup` para las acciones de la ficha (OffersModule).
 * - `ApplicationJobsService`: vencimientos y recordatorios (SCHEDULER_ENABLED).
 * No importa Offers/Calendar/Dashboard (ellos importan este módulo).
 */
@Module({
  imports: [EnrollmentsModule, NotificationsModule, LocationsModule],
  controllers: [ApplicationsController],
  providers: [
    ApplicationsService,
    ApplicationWorkflowService,
    ApplicationLookupService,
    ApplicationJobsService,
  ],
  exports: [
    ApplicationsService,
    ApplicationWorkflowService,
    ApplicationLookupService,
    ApplicationJobsService,
  ],
})
export class ApplicationsModule {}
