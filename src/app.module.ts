import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { Env, validateEnv } from './config/env.schema';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { buildLoggerParams } from './config/logger.config';
import { CaptchaModule } from './infra/captcha/captcha.module';
import { MailModule } from './infra/mail/mail.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { StorageModule } from './infra/storage/storage.module';
import { MeetingsInfraModule } from './infra/meetings/meetings-infra.module';
import { StripeModule } from './infra/stripe/stripe.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { ClassroomModule } from './modules/classroom/classroom.module';
import { ContactModule } from './modules/contact/contact.module';
import { SiteModule } from './modules/site/site.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { HealthModule } from './modules/health/health.module';
import { LibraryModule } from './modules/library/library.module';
import { LiveSessionsModule } from './modules/live-sessions/live-sessions.module';
import { LocationsModule } from './modules/locations/locations.module';
import { MeetingsModule } from './modules/meetings/meetings.module';
import { MoodleModule } from './modules/moodle/moodle.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OffersModule } from './modules/offers/offers.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ScholarshipTypesModule } from './modules/scholarship-types/scholarship-types.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    // Config global validada con zod. En pruebas se usa .env.test; las variables del proceso
    // siempre tienen prioridad sobre el archivo.
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: process.env.NODE_ENV === 'test' ? ['.env.test'] : ['.env'],
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        buildLoggerParams({
          NODE_ENV: config.get('NODE_ENV', { infer: true }),
          LOG_LEVEL: config.get('LOG_LEVEL', { infer: true }),
        }),
    }),
    // Rate limit global por IP. Endpoints sensibles (login, OTP, contacto) usan @Throttle(...) más estricto.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [
        {
          ttl: config.get('THROTTLE_TTL_SECONDS', { infer: true }) * 1000,
          limit: config.get('THROTTLE_LIMIT', { infer: true }),
        },
      ],
    }),
    // JWT de acceso (global: lo usa el JwtAuthGuard global y TokensService).
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),

    // Tareas programadas en proceso (Fase 03). Cada job respeta SCHEDULER_ENABLED.
    ScheduleModule.forRoot(),

    // Infraestructura (global)
    PrismaModule,
    MailModule,
    StorageModule,
    CaptchaModule,
    StripeModule,
    MeetingsInfraModule,

    // Dominio
    HealthModule,
    LocationsModule,
    UsersModule,
    AuthModule,
    ContactModule,
    SiteModule,
    ScholarshipTypesModule,
    OffersModule,
    // Fase 03 — Portal del participante
    NotificationsModule,
    EnrollmentsModule,
    LiveSessionsModule,
    ClassroomModule,
    CalendarModule,
    LibraryModule,
    DashboardModule,
    // Fase 04 — Postulaciones
    ApplicationsModule,
    // Fase 05 — Pagos y acceso Moodle
    PaymentsModule,
    MoodleModule,
    // Fase 06 — Panel administrativo (los controladores admin-* viven en cada dominio)
    AuditModule,
    // Reuniones de Zoom / Google Meet generadas desde el panel (apoyo a HU-29 y HU-31)
    MeetingsModule,
  ],
  providers: [
    // Orden: rate limit → autenticación (respeta @Public()) → roles (@Roles()) → permisos del panel
    // (@RequirePermissions(), con los roles actuales de la BD).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
