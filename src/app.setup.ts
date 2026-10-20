import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { apiReference } from '@scalar/nestjs-api-reference';
import type { Request, Response } from 'express';
import helmet from 'helmet';
import { validationExceptionFactory } from './common/errors/validation-errors';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import type { Env } from './config/env.schema';
import { API_PREFIX, createOpenApiDocument, DOCS_PATH, OPENAPI_JSON_PATH } from './config/openapi';

/**
 * Configuración HTTP compartida por main.ts y las pruebas e2e (así los tests ejercitan lo mismo
 * que producción). Debe llamarse ANTES de `app.init()` / `app.listen()`.
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Railway (y la mayoría de PaaS) ponen un proxy delante: necesario para la IP real en el throttler.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Helmet: CSP estricta para la API (solo JSON). /docs (Scalar) carga su bundle desde CDN, así que
  // ahí se desactiva la CSP.
  const apiHelmet = helmet();
  const docsHelmet = helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false });
  app.use((req: Request, res: Response, next: () => void) =>
    req.path.startsWith(DOCS_PATH) ? docsHelmet(req, res, next) : apiHelmet(req, res, next),
  );

  // CORS por lista blanca (CORS_ORIGINS separado por comas).
  const allowedOrigins = config.get('CORS_ORIGINS', { infer: true });
  app.enableCors({
    origin: (origin, callback) => {
      // Sin header Origin (curl, server-to-server, mismo origen) → permitido.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  });

  app.setGlobalPrefix(API_PREFIX, { exclude: [{ path: 'docs', method: RequestMethod.ALL }] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  if (config.get('DOCS_ENABLED', { infer: true })) {
    setupDocs(app, config.get('APP_PUBLIC_URL', { infer: true }));
  }
}

/** Sirve OpenAPI JSON en /docs/openapi.json y la UI de Scalar en /docs. */
function setupDocs(app: INestApplication, serverUrl: string): void {
  const document = createOpenApiDocument(app, { serverUrl });
  const http = app.getHttpAdapter();
  http.get(OPENAPI_JSON_PATH, (_req: Request, res: Response) => {
    res.json(document);
  });
  http.get(
    DOCS_PATH,
    apiReference({
      url: OPENAPI_JSON_PATH,
      pageTitle: 'Escuela Itinerante del Agua — API',
      theme: 'default',
    }),
  );
}
