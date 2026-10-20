/**
 * Exporta el contrato OpenAPI a openapi/openapi.json SIN conectarse a la base de datos ni a
 * servicios externos. Uso: `pnpm openapi:export`.
 *
 * Cómo funciona: arma la app con Test.createTestingModule (de @nestjs/testing), reemplaza
 * PrismaService por un stub y genera el documento con la misma función que usa main.ts.
 * Se ejecuta con ts-node (necesita emitDecoratorMetadata; tsx/esbuild no lo soporta).
 */
// Debe ir primero: fija variables de entorno ficticias antes de cargar AppModule.
import './openapi-export.env';

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { API_PREFIX, createOpenApiDocument } from '../src/config/openapi';
import { PrismaService } from '../src/infra/prisma/prisma.service';

const OUTPUT = resolve(__dirname, '..', 'openapi', 'openapi.json');
/** Servidor documentado en el archivo exportado (estable para que el diff sea limpio). */
const DOCUMENTED_SERVER = 'http://localhost:3000';

async function main(): Promise<void> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({ ping: () => Promise.resolve(), $connect: () => Promise.resolve() })
    .compile();

  const app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix(API_PREFIX);

  const document = createOpenApiDocument(app, { serverUrl: DOCUMENTED_SERVER });

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  await app.close();

  const operations = Object.values(document.paths).reduce(
    (count, item) => count + Object.keys(item ?? {}).length,
    0,
  );
  console.log(`OpenAPI exportado: ${OUTPUT} (${operations} operaciones)`);
}

main().catch((error: unknown) => {
  console.error('Error exportando OpenAPI:', error);
  process.exit(1);
});
