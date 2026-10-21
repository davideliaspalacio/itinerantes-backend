import { Module } from '@nestjs/common';
import { ApplicationLookupService } from '../applications/application-lookup.service';
import { ApplicationsModule } from '../applications/applications.module';
import { EnrollmentLookupService } from '../enrollments/enrollment-lookup.service';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { LocationsModule } from '../locations/locations.module';
import { UsersModule } from '../users/users.module';
import { OFFER_APPLICATION_LOOKUP } from './application-lookup';
import { OFFER_ENROLLMENT_LOOKUP } from './enrollment-lookup';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';

@Module({
  imports: [UsersModule, LocationsModule, EnrollmentsModule, ApplicationsModule],
  controllers: [OffersController],
  providers: [
    OffersService,
    // Fase 03: inscripciones reales → "Inscrito", GO_TO_CLASSROOM y "Cupo agotado" (HU-15/16).
    { provide: OFFER_ENROLLMENT_LOOKUP, useExisting: EnrollmentLookupService },
    // Fase 04: postulaciones → [Ver mi postulación] / [Pagar saldo] (HU-16/21).
    { provide: OFFER_APPLICATION_LOOKUP, useExisting: ApplicationLookupService },
  ],
  exports: [OffersService],
})
export class OffersModule {}
