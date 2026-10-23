import { Module } from '@nestjs/common';
import { AdminScholarshipTypesController } from './admin/admin-scholarship-types.controller';
import { ScholarshipTypesController } from './scholarship-types.controller';
import { ScholarshipTypesService } from './scholarship-types.service';

/**
 * Tipos de beca parametrizables (catálogo público + CRUD del panel). Lo importan `offers`
 * (asistente, ficha) y `applications` (formulario, decisión); no depende de ellos.
 */
@Module({
  controllers: [ScholarshipTypesController, AdminScholarshipTypesController],
  providers: [ScholarshipTypesService],
  exports: [ScholarshipTypesService],
})
export class ScholarshipTypesModule {}
