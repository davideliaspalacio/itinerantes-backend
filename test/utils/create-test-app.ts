import type { Type } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';

export interface TestAppOptions {
  /** Controladores extra solo para pruebas (p. ej. sondas de validación). */
  controllers?: Type<unknown>[];
  /** Permite `overrideProvider(...)` (p. ej. MailService) antes de compilar. */
  customize?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
}

/** Crea la app completa (mismos pipes, filtros, prefijo y docs que producción) para supertest. */
export async function createTestApp(options: TestAppOptions = {}): Promise<NestExpressApplication> {
  let builder = Test.createTestingModule({
    imports: [AppModule],
    controllers: options.controllers ?? [],
  });
  if (options.customize) builder = options.customize(builder);
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}
