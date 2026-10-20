# Contribuir

Lee primero [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (convenciones obligatorias) y
[`docs/ROADMAP.md`](docs/ROADMAP.md) (alcance de cada fase).

## Checklist: agregar un módulo / cerrar una fase

1. **Modelos y migración**
   - Agrega modelos/enums a `prisma/schema.prisma` (UUID, `@map`/`@@map` snake_case, `Timestamptz`,
     dinero en `Int` centavos + `Currency`).
   - `pnpm db:migrate --name faseXX_<dominio>` → commitea `prisma/migrations/...`.
   - Datos demo idempotentes en `prisma/seed.ts` (`upsert` con claves estables).
2. **Módulo** en `src/modules/<dominio>/`: `*.module.ts`, `*.controller.ts` (solo HTTP),
   `*.service.ts` (casos de uso), `*.policy.ts` (reglas puras, opcional), `dto/`.
   Regístralo en `src/app.module.ts`. Rutas de admin en `admin-<dominio>.controller.ts` bajo `/admin/...`.
3. **DTOs**: `*.request.dto.ts` con class-validator (mensajes en español cuando importen) y
   `*.response.dto.ts`; `@ApiProperty({ example })` en todos los campos. Listados: extiende
   `PaginationQueryDto` y responde con `paginate(...)`.
4. **Reglas configurables**: nada de números mágicos → `src/config/business-rules.ts` (cita la HU / Anexo A).
   Variables nuevas → `src/config/env.schema.ts` + `.env.example` (+ `.env.test` si aplica).
5. **Errores**: lanza `AppException('<CODE>', { message, details })`. Códigos nuevos en
   `src/common/errors/error-codes.ts` (prefijo del dominio: `AUTH_*`, `OFFER_*`, ...) **y** en
   `docs/frontend/errores.md`.
6. **Swagger**: `@ApiTags`, `@ApiOperation({ summary, description })` (la descripción menciona la HU),
   respuestas OK tipadas, `@ApiErrorResponses(...)` con TODOS los `code` posibles,
   `@ApiPaginatedResponse(Item)` en listados, `@Public()` en rutas sin auth.
7. **Pruebas**: unitarias de reglas puras (`*.spec.ts` junto al código) y e2e por endpoint principal
   (`test/<dominio>.e2e-spec.ts` con `createTestApp()`).
8. **Contrato**: `pnpm openapi:export` → commitea `openapi/openapi.json`.
9. **Guía frontend**: `docs/frontend/fase-XX-<nombre>.md` → por HU: endpoints, flujo paso a paso,
   estados de UI ↔ respuestas/códigos de error, tabla enum → texto en español. Actualiza el índice en
   `docs/frontend/README.md`.
10. **Verificación**: `pnpm build && pnpm lint && pnpm test && pnpm test:e2e` en verde.
11. **Docs**: marca la fase en la tabla "Estado" de `docs/ROADMAP.md`; si cambiaste una convención,
    actualiza `docs/ARCHITECTURE.md`.
12. **Commit**: uno por fase, `feat(fase-XX): <resumen>` (Conventional Commits). Nunca commitees `.env`.

## Estilo

- TypeScript estricto; sin `any` salvo justificación.
- Prettier (100 columnas, comillas simples) + ESLint: `pnpm lint:fix`.
- Código e identificadores en inglés; mensajes al usuario y documentación en español.
