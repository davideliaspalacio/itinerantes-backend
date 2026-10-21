import { Module } from '@nestjs/common';
import { MoodleModule } from '../moodle/moodle.module';
import { UsersModule } from '../users/users.module';
import { AccountSecurityController } from './account-security.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { TokensService } from './tokens.service';

/** JwtModule es global (registrado en AppModule) porque lo usa el JwtAuthGuard global. */
@Module({
  imports: [UsersModule, MoodleModule],
  controllers: [AuthController, AccountSecurityController],
  providers: [AuthService, OtpService, TokensService],
})
export class AuthModule {}
