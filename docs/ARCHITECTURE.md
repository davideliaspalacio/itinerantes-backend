# Arquitectura y convenciones

Este documento es la referencia para cualquier persona (o agente) que agregue código. Si una decisión cambia, se actualiza aquí.

## Stack

| Área | Elección | Motivo |
|---|---|---|
| Runtime | Node.js 22 LTS, TypeScript 6 estricto | LTS, tipado |
| Framework | NestJS 11 (adaptador Express) | Módulos por dominio, DI, OpenAPI integrado; fácil de mantener |
| ORM | Prisma 7 + PostgreSQL (driver adapter `@prisma/adapter-pg`) | Migraciones versionadas, tipos generados, portable (Supabase / Neon / Railway) |
| Validación | class-validator + class-transformer (DTOs) | Se integra con @nestjs/swagger: un DTO = validación + documentación |
| Config | `@nestjs/config` + validación con zod al arrancar | Falla rápido si falta una variable |
| Docs API | `@nestjs/swagger` (OpenAPI 3.1) + Scalar UI | `/docs` (UI) y `/docs/openapi.json` (JSON), fuera del prefijo `/api/v1`. Export versionado en `openapi/openapi.json` |
| Auth | JWT de acceso (corto) + refresh token opaco rotativo guardado con hash en BD | Sin dependencia de proveedor externo |
| Hash | argon2 | Recomendado para contraseñas |
| Logs | nestjs-pino | JSON estructurado con requestId |
| Seguridad | helmet, CORS por lista blanca, @nestjs/throttler | Rate limit en login/OTP/contacto |
| Correo | `MailService` con driver `console`/`smtp` en dev (Mailpit) y `resend` en prod | Intercambiable |
| Archivos | `StorageService` sobre API S3 (MinIO en dev; Supabase Storage S3 o Cloudflare R2 en prod) | URLs firmadas temporales |
| Pagos | Stripe (Checkout, Subscriptions/Invoices, Customer Portal, webhooks) | Fase 05 |
| Tareas programadas | `@nestjs/schedule` (cron en proceso; una sola instancia en Railway) | Cierre de asistencia, vencimientos, recordatorios |
| Fechas | Luxon | Zonas IANA; hora oficial `America/Mexico_City` |
| Pruebas | Jest + supertest; e2e contra Postgres de Docker | |
| Paquetes | pnpm | |
| Deploy | Railway (Dockerfile + `railway.json`, `prisma migrate deploy` antes de arrancar) | |

## Estructura de carpetas

```
src/
  main.ts                 # bootstrap: logger pino, listen
  app.setup.ts            # configureApp(): helmet, CORS, prefijo, pipes, filtro, /docs (main + e2e)
  app.module.ts
  config/                 # env.schema.ts (zod), business-rules.ts (reglas configurables),
                          # openapi.ts (config OpenAPI reutilizable), logger.config.ts (pino + requestId)
  common/                 # transversal, sin lógica de negocio
    errors/               # AppException + catálogo de códigos de error (error-codes.ts)
    filters/              # filtro global de excepciones -> formato de error único
    guards/ decorators/   # JwtAuthGuard, RolesGuard (Fase 01), @Public(), @CurrentUser(), @Roles()
    swagger/              # @ApiErrorResponses(...codes), @ApiPaginatedResponse(Item)
    dto/                  # PaginationQueryDto, PaginatedResponseDto, ErrorResponseDto
    utils/                # time (CDMX <-> UTC), money, slug, etc.
  infra/                  # adaptadores a servicios externos
    prisma/  mail/  storage/  stripe/
  modules/                # un módulo por dominio
    <dominio>/
      <dominio>.module.ts
      <dominio>.controller.ts        # solo HTTP: valida DTO, llama al servicio, mapea respuesta
      <dominio>.service.ts           # casos de uso y reglas de negocio
      <dominio>.policy.ts (opcional) # reglas puras (fácil de probar sin BD)
      dto/                           # *.request.dto.ts / *.response.dto.ts
      <dominio>.service.spec.ts
  generated/prisma/       # cliente Prisma generado (no versionado; `prisma generate`)
prisma/
  schema.prisma  migrations/  seed.ts
prisma.config.ts          # config del CLI de Prisma 7 (URL de migraciones, seed)
scripts/                  # export-openapi.ts
test/                     # e2e (*.e2e-spec.ts) + helpers (utils/create-test-app.ts)
openapi/openapi.json      # export versionado del contrato
docs/frontend/            # guía de integración por fase
```

Reglas:
- Los controladores no tienen lógica de negocio. Las reglas puras van en funciones/policies probables sin BD.
- Un módulo no importa la BD de otro dominio a escondidas: si necesita algo, usa el servicio exportado del otro módulo.
- Rutas de admin en controladores separados (`admin-<dominio>.controller.ts`) bajo `/admin/...`.

## Convenciones REST

- Prefijo global: `/api/v1`.
- Recursos en plural y kebab-case: `/offers`, `/offers/{slug}`, `/me/enrollments`, `/admin/offers/{id}/sessions`.
- Recursos del usuario autenticado bajo `/me/...`.
- Panel bajo `/admin/...` (requiere roles).
- Verbos: GET leer, POST crear/acciones (`/sessions/{id}/attendance`), PATCH actualización parcial, PUT reemplazo, DELETE borrar.
- Acciones que no son CRUD: sub-recurso con verbo POST (`/auth/otp/resend`, `/admin/transfers/{id}/validate`).
- Códigos: 200 OK, 201 creado, 204 sin contenido, 400 validación, 401 sin sesión, 403 sin permiso, 404, 409 conflicto (duplicado/estado inválido), 422 regla de negocio, 429 rate limit.
- JSON en camelCase. BD en snake_case (`@map`/`@@map` en Prisma).
- IDs: UUID.
- Fechas: ISO 8601 en UTC (`2026-11-07T16:00:00.000Z`). El frontend convierte a la zona del usuario. Cuando sea útil, la respuesta incluye además `timezone` de referencia (`America/Mexico_City`).
- Dinero: enteros en centavos + moneda: `{ "amountCents": 1020000, "currency": "MXN" }`. Nunca floats. MXN y USD nunca se suman.
- Enums en la API: `SCREAMING_SNAKE_CASE` en inglés (`PENDING_PAYMENT`). El frontend traduce a los textos del documento (la guía de cada fase incluye la tabla enum → texto en español).

### Listas y paginación

`GET /offers?page=1&pageSize=20&type=DIPLOMA` →
```json
{ "data": [ ... ], "meta": { "page": 1, "pageSize": 20, "total": 57, "totalPages": 3 } }
```
Un recurso individual se devuelve como objeto plano (sin envoltorio).

### Formato de error (único en toda la API)

```json
{
  "statusCode": 409,
  "code": "AUTH_EMAIL_ALREADY_REGISTERED",
  "message": "El correo ya está registrado.",
  "details": [{ "field": "email", "code": "ALREADY_EXISTS", "message": "..." }],
  "requestId": "b1f..."
}
```
- `code` es estable y es lo que el frontend debe usar para decidir qué mostrar. `message` está en español y es legible.
- Los códigos viven en `src/common/errors/error-codes.ts` y se listan en `docs/frontend/errores.md`.
- Errores de validación de DTO → `400` con `code: "VALIDATION_ERROR"` y `details` por campo.
- `details` es opcional: se omite cuando no hay errores por campo. `requestId` siempre está (también en el header `X-Request-Id`).
- Códigos genéricos del catálogo: `VALIDATION_ERROR`, `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND` (también rutas inexistentes), `CONFLICT`, `PAYLOAD_TOO_LARGE`, `BUSINESS_RULE_VIOLATION` (422), `RATE_LIMITED`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`. Los de dominio llevan prefijo (`AUTH_*`, `OFFER_*`...).
- Lanzar errores con `new AppException('<CODE>', { message?, details? })`. El filtro global también traduce errores de Prisma (P2002 → 409 `CONFLICT` con `details[].code = ALREADY_EXISTS`, P2025 → 404, P2003 → 409) y del throttler (429).

## Autenticación y roles

- `POST /auth/login` → `{ accessToken, refreshToken, expiresIn, user }`. Acceso por header `Authorization: Bearer <token>`.
- `POST /auth/refresh` rota el refresh token (el anterior queda invalidado). `rememberMe` alarga la vida del refresh.
- Rutas protegidas por defecto (guard global); las públicas se marcan con `@Public()`.
- Roles (enum `Role`): `PARTICIPANT` (Fase 01); en Fase 06 se agregan los del panel (`SUPER_ADMIN`, `ACADEMIC_COORDINATOR`, `REVIEW_COMMITTEE`, `REVIEW_DECIDER`, `FOLLOW_UP`, `FINANCE`). Un usuario puede tener varios roles.
- Nunca revelar si un recurso ajeno existe: acceso a recursos de otro usuario → `404` o `403` según la HU.

## Documentación para el frontend

- Cada endpoint: `@ApiTags`, `@ApiOperation({ summary, description })` (la descripción menciona la HU, p. ej. "HU-04"), respuestas documentadas incluyendo errores con sus `code`, ejemplos en los DTOs (`@ApiProperty({ example })`).
- `pnpm openapi:export` genera `openapi/openapi.json` sin levantar BD.
- `docs/frontend/README.md`: índice, cómo autenticarse, formato de errores, paginación, fechas y dinero.
- `docs/frontend/fase-XX-*.md`: por HU → endpoints, flujo paso a paso, estados de UI ↔ respuestas/códigos de error, tablas de enums con sus textos en español.

## Base de datos

- Desarrollo y pruebas: Postgres en `docker-compose.yml` (puerto host `5434`; BDs `eia_dev` y `eia_test`).
- Prisma 7: la URL NO va en `schema.prisma`. El CLI la toma de `prisma.config.ts` (`DIRECT_URL` si existe, si no `DATABASE_URL`); la app usa `DATABASE_URL` con el driver adapter de `pg` en `PrismaService`. Importa tipos/enums de Prisma desde `src/generated/prisma/client`.
- Producción: Postgres administrado (recomendado Supabase; alternativa Neon o Railway Postgres). Solo se usa `DATABASE_URL` (+ `DIRECT_URL` para migraciones si hay pooler).
- Cada fase crea su migración con nombre descriptivo (`pnpm db:migrate --name fase01_identity`).
- `prisma/seed.ts` crea datos demo idempotentes (ofertas de ejemplo como "Diplomado en Ecotecnologías del Agua", usuario demo, admin demo) para que el frontend tenga con qué integrar.

## Reglas de negocio configurables

`src/config/business-rules.ts` centraliza valores del Anexo A (zona oficial `America/Mexico_City`, OTP 6 dígitos y su expiración, cooldown de reenvío, intentos máximos y bloqueo, ventana de asistencia por defecto 24 h, plazo de pago tras beca 7 días, mora 15 días, cuotas 2–4, niveles de beca, límites de archivos, etc.).

## Pruebas

- Unitarias para reglas puras (cálculo de saldo, generación de sesiones, % de progreso, transiciones de estado).
- e2e por endpoint principal con supertest contra BD de prueba (`.env.test` → `eia_test`; `test/setup/global-setup.ts` aplica `prisma migrate deploy`; se resetea con `prisma migrate reset --force` o truncado). Usa `createTestApp()` (`test/utils/create-test-app.ts`), que aplica la misma configuración HTTP que producción.
- `pnpm test:e2e` corre Jest con `--experimental-vm-modules` (Prisma 7 carga su query compiler con `import()` dinámico).
- `pnpm test`, `pnpm test:e2e`, `pnpm lint`, `pnpm build` deben pasar antes de cerrar una fase.
