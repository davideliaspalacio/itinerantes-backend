import { Module } from '@nestjs/common';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';

/** Biblioteca digital (HU-09). */
@Module({
  imports: [EnrollmentsModule],
  controllers: [LibraryController],
  providers: [LibraryService],
  exports: [LibraryService],
})
export class LibraryModule {}
