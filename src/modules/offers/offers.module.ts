import { Module } from '@nestjs/common';
import { LocationsModule } from '../locations/locations.module';
import { UsersModule } from '../users/users.module';
import { NoEnrollmentLookup, OFFER_ENROLLMENT_LOOKUP } from './enrollment-lookup';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';

@Module({
  imports: [UsersModule, LocationsModule],
  controllers: [OffersController],
  providers: [
    OffersService,
    // Fase 03 reemplaza esta implementación por la real (inscripciones activas y cupo).
    { provide: OFFER_ENROLLMENT_LOOKUP, useClass: NoEnrollmentLookup },
  ],
  exports: [OffersService],
})
export class OffersModule {}
