import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { EnrollmentAccessService } from './enrollment-access.service';
import { EnrollmentLookupService } from './enrollment-lookup.service';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';

/**
 * Inscripciones (Fase 03): Mi formación (HU-07), inscripción gratuita, autorización del portal
 * (`EnrollmentAccessService`) e implementación real de `OfferEnrollmentLookup` para OffersModule.
 * No importa OffersModule (OffersModule importa este módulo).
 */
@Module({
  imports: [NotificationsModule],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService, EnrollmentAccessService, EnrollmentLookupService],
  exports: [EnrollmentsService, EnrollmentAccessService, EnrollmentLookupService],
})
export class EnrollmentsModule {}
