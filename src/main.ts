import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import type { Env } from './config/env.schema';
import { API_PREFIX, DOCS_PATH } from './config/openapi';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  configureApp(app);

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  // Sin host: Node escucha en '::' (IPv4 + IPv6) cuando está disponible. Railway usa IPv6 en su red privada.
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`API escuchando en http://localhost:${port}/${API_PREFIX}`, 'Bootstrap');
  if (config.get('DOCS_ENABLED', { infer: true })) {
    logger.log(`Documentación en http://localhost:${port}${DOCS_PATH}`, 'Bootstrap');
  }
}

void bootstrap();
