import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { Env, validateEnv } from './config/env.schema';
import { buildLoggerParams } from './config/logger.config';
import { MailModule } from './infra/mail/mail.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { StorageModule } from './infra/storage/storage.module';
import { HealthModule } from './modules/health/health.module';

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

    // Infraestructura (global)
    PrismaModule,
    MailModule,
    StorageModule,

    // Dominio
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Fase 01: agregar aquí { provide: APP_GUARD, useClass: JwtAuthGuard } y RolesGuard
    // (respetando @Public() vía IS_PUBLIC_KEY).
  ],
})
export class AppModule {}
