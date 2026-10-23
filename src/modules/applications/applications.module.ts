import { Module } from '@nestjs/common';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { LocationsModule } from '../locations/locations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ScholarshipTypesModule } from '../scholarship-types/scholarship-types.module';
import { AdminApplicationsController } from './admin/admin-applications.controller';
import { AdminApplicationsService } from './admin/admin-applications.service';
import { AdminFollowUpController } from './admin/admin-follow-up.controller';
import { AdminFollowUpService } from './admin/admin-follow-up.service';
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
 * - Fase 06 (panel, HU-31/32): `AdminApplicationsService` (revisión, evaluaciones, entrevistas,
 *   decisión) y `AdminFollowUpService` (embudo y seguimiento), bajo `/admin/...`.
 * No importa Offers/Calendar/Dashboard (ellos importan este módulo).
 */
@Module({
  imports: [EnrollmentsModule, NotificationsModule, LocationsModule, ScholarshipTypesModule],
  controllers: [ApplicationsController, AdminApplicationsController, AdminFollowUpController],
  providers: [
    ApplicationsService,
    AdminApplicationsService,
    AdminFollowUpService,
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
