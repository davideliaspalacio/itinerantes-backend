import { Module } from '@nestjs/common';
import { LocationsModule } from '../locations/locations.module';
import { MeController } from './me.controller';
import { PasswordService } from './password.service';
import { UsersService } from './users.service';

@Module({
  imports: [LocationsModule],
  controllers: [MeController],
  providers: [UsersService, PasswordService],
  exports: [UsersService, PasswordService],
})
export class UsersModule {}
