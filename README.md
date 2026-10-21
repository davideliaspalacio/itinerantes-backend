# Escuela Itinerante del Agua — Backend

API REST de la plataforma eLearning **Escuela Itinerante del Agua** (sitio público, portal del
participante y panel administrativo). Público estimado: 200–500 usuarios/mes.

- Requerimientos: [`docs/requirements/HU_EIA_Fases_1-3.md`](docs/requirements/HU_EIA_Fases_1-3.md)
- Convenciones obligatorias: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Plan por fases y estado: [`docs/ROADMAP.md`](docs/ROADMAP.md)
- Guía para el frontend: [`docs/frontend/README.md`](docs/frontend/README.md)
- Despliegue (Railway + Supabase): [`docs/DEPLOY.md`](docs/DEPLOY.md)
- Cómo agregar un módulo/fase: [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Stack

Node.js 22 · TypeScript 6 (estricto) · NestJS 11 (Express) · Prisma 7 + PostgreSQL 16 ·
class-validator · zod (env) · OpenAPI 3.1 + Scalar · nestjs-pino · helmet · @nestjs/throttler ·
Luxon · nodemailer/Resend · S3 (MinIO / Supabase Storage / R2) · Jest + supertest · pnpm ·
Docker · Railway.

## Correr en local (5 pasos)

Requisitos: Node 22, pnpm 11, Docker.

```bash
# 1. Dependencias (también genera el cliente Prisma)
pnpm install

# 2. Servicios: Postgres (5434), MinIO (9000/9001) y Mailpit (1025/8025)
docker compose up -d

# 3. Variables de entorno (los valores por defecto funcionan con docker compose)
cp .env.example .env

# 4. Migraciones + datos demo
pnpm db:migrate && pnpm db:seed

# 5. Levantar la API en modo watch
pnpm dev
```

- API: <http://localhost:3000/api/v1> (p. ej. `GET /api/v1/health`)
- Documentación (Scalar): <http://localhost:3000/docs> · JSON: <http://localhost:3000/docs/openapi.json>
- Correos de desarrollo (Mailpit): <http://localhost:8025> (OTP de registro/recuperación, acuses de Contacto)
- Consola de MinIO: <http://localhost:9001> (usuario `eia`, clave `eia-secret-key`; buckets `eia-dev` y `eia-test`)

### Usuarios demo (solo desarrollo / pruebas)

`pnpm db:seed` crea (o restablece) estas cuentas verificadas. **No** se crean con `NODE_ENV=production`.

| Rol | Correo | Contraseña |
|---|---|---|
| Participante (`PARTICIPANT`) | `participante@example.com` | `Demo12345` |
| Admin (`SUPER_ADMIN`) | `admin@example.com` | `Admin12345` |

Desde la Fase 03 el participante demo tiene inscripciones, asistencias y notificaciones de ejemplo
(ver `docs/frontend/fase-03-portal.md` → "Datos demo").

El seed también carga los países (LatAm + España + EE. UU.), los 32 estados de México y sus 2,478
municipios (catálogo INEGI, `prisma/data/mx-inegi-municipalities.json`).

> Puertos ocupados: `POSTGRES_PORT=5435 docker compose up -d` (y ajusta `DATABASE_URL`). Ver
> `docker-compose.yml`.

## Scripts

| Script | Qué hace |
|---|---|
| `pnpm dev` | API en modo watch |
| `pnpm build` | `prisma generate` + compilación a `dist/` |
| `pnpm start:prod` | Ejecuta `dist/main.js` |
| `pnpm lint` / `pnpm lint:fix` | ESLint + Prettier |
| `pnpm format` | Prettier sobre el código |
| `pnpm typecheck` | `tsc --noEmit` de todo el repo (src, test, scripts) |
| `pnpm test` | Pruebas unitarias (`src/**/*.spec.ts`, sin BD) |
| `pnpm test:e2e` | Pruebas e2e (`test/**/*.e2e-spec.ts`) contra la BD `eia_test` de Docker |
| `pnpm openapi:export` | Genera `openapi/openapi.json` sin conectarse a la BD |
| `pnpm db:migrate` | `prisma migrate dev` (crea/aplica migraciones en dev; `-- --name faseXX_algo`) |
| `pnpm db:deploy` | `prisma migrate deploy` (aplica migraciones pendientes; lo usa Railway) |
| `pnpm db:seed` | Datos demo idempotentes (`prisma/seed.ts`): catálogos, usuarios demo y ofertas demo (`SEED_DEMO_DATA`) |
| `pnpm build:seed` | Compila el seed a `dist/seed/` (lo usa la imagen Docker al arrancar) |
| `pnpm db:reset` | Borra la BD de dev, re-aplica migraciones y corre el seed |
| `pnpm db:studio` | Prisma Studio |

Las e2e aplican las migraciones a `eia_test` automáticamente (`test/setup/global-setup.ts`). Para
dejarla en blanco: `DATABASE_URL="$(grep ^DATABASE_URL .env.test | cut -d= -f2-)" pnpm db:reset`.

## Estructura

```
src/
  main.ts               # bootstrap (logger, listen)
  app.setup.ts          # helmet, CORS, prefijo /api/v1, ValidationPipe, filtro de errores, /docs
  app.module.ts         # config, logger, throttler, infra y módulos de dominio
  config/               # env.schema.ts (zod), business-rules.ts, openapi.ts, logger.config.ts
  common/               # transversal, sin lógica de negocio
    errors/             # AppException, error-codes.ts, validación → details
    filters/            # filtro global → formato de error único
    decorators/         # @Public(), @CurrentUser(), @Roles()
    guards/             # JwtAuthGuard, RolesGuard (globales)
    swagger/            # @ApiErrorResponses(), @ApiPaginatedResponse()
    dto/                # PaginationQueryDto, PaginatedResponseDto, ErrorResponseDto
    utils/              # time (CDMX ↔ UTC), money (centavos), slug
  infra/                # adaptadores externos: prisma/, mail/, storage/, captcha/, stripe/ (Fase 05)
  modules/              # un módulo por dominio: health, auth, users (/me), locations (+ /timezones), contact
  generated/prisma/     # cliente Prisma generado (no versionado)
prisma/                 # schema.prisma, migrations/, seed.ts, data/ (catálogos)  (+ prisma.config.ts en la raíz)
test/                   # e2e + helpers (createTestApp)
scripts/                # export-openapi.ts
openapi/openapi.json    # contrato versionado
docs/                   # arquitectura, roadmap, deploy, guía frontend
```

## Producción

Railway construye el `Dockerfile` y, antes de cada deploy, ejecuta `prisma migrate deploy`
(`railway.json`). Detalles, variables y Supabase en [`docs/DEPLOY.md`](docs/DEPLOY.md).
