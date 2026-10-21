import { Module } from '@nestjs/common';
import { LocationsModule } from '../locations/locations.module';
import { AdminUsersController } from './admin/admin-users.controller';
import { AdminUsersService } from './admin/admin-users.service';
import { MeController } from './me.controller';
import { PasswordService } from './password.service';
import { UsersService } from './users.service';

@Module({
  imports: [LocationsModule],
  controllers: [MeController, AdminUsersController],
  providers: [UsersService, PasswordService, AdminUsersService],
  exports: [UsersService, PasswordService],
})
export class UsersModule {}
