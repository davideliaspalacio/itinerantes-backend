import { Module } from '@nestjs/common';
import { ApplicationLookupService } from '../applications/application-lookup.service';
import { ApplicationsModule } from '../applications/applications.module';
import { EnrollmentLookupService } from '../enrollments/enrollment-lookup.service';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { LocationsModule } from '../locations/locations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { AdminContentJobsService } from './admin/admin-content-jobs.service';
import { AdminContentController } from './admin/admin-content.controller';
import { AdminContentService } from './admin/admin-content.service';
import { AdminImagesService } from './admin/admin-images.service';
import { AdminOffersController, AdminUploadsController } from './admin/admin-offers.controller';
import { AdminOffersService } from './admin/admin-offers.service';
import { AdminTeachersController } from './admin/admin-teachers.controller';
import { AdminTeachersService } from './admin/admin-teachers.service';
import { OFFER_APPLICATION_LOOKUP } from './application-lookup';
import { OFFER_ENROLLMENT_LOOKUP } from './enrollment-lookup';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';

@Module({
  imports: [
    UsersModule,
    LocationsModule,
    EnrollmentsModule,
    ApplicationsModule,
    NotificationsModule,
  ],
  controllers: [
    OffersController,
    // Fase 06 — Panel (HU-27/28): ofertas, docentes, imágenes y contenido del aula.
    AdminOffersController,
    AdminUploadsController,
    AdminTeachersController,
    AdminContentController,
  ],
  providers: [
    OffersService,
    AdminOffersService,
    AdminImagesService,
    AdminTeachersService,
    AdminContentService,
    AdminContentJobsService,
    // Fase 03: inscripciones reales → "Inscrito", GO_TO_CLASSROOM y "Cupo agotado" (HU-15/16).
    { provide: OFFER_ENROLLMENT_LOOKUP, useExisting: EnrollmentLookupService },
    // Fase 04: postulaciones → [Ver mi postulación] / [Pagar saldo] (HU-16/21).
    { provide: OFFER_APPLICATION_LOOKUP, useExisting: ApplicationLookupService },
  ],
  exports: [OffersService],
})
export class OffersModule {}
