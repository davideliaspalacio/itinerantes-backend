import { Module } from '@nestjs/common';
import { EnrollmentLookupService } from '../enrollments/enrollment-lookup.service';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { LocationsModule } from '../locations/locations.module';
import { UsersModule } from '../users/users.module';
import { OFFER_ENROLLMENT_LOOKUP } from './enrollment-lookup';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';

@Module({
  imports: [UsersModule, LocationsModule, EnrollmentsModule],
  controllers: [OffersController],
  providers: [
    OffersService,
    // Fase 03: inscripciones reales → "Inscrito", GO_TO_CLASSROOM y "Cupo agotado" (HU-15/16).
    { provide: OFFER_ENROLLMENT_LOOKUP, useExisting: EnrollmentLookupService },
  ],
  exports: [OffersService],
})
export class OffersModule {}
