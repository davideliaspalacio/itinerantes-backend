# Guía de integración para el frontend

Documento para el equipo (y la IA) que construye el frontend. Es la referencia transversal; cada fase
agrega su guía específica en `docs/frontend/fase-XX-<nombre>.md`.

## Índice

| Documento | Contenido | Estado |
|---|---|---|
| Este archivo | Convenciones generales de la API | Fase 00 ✔ |
| [`errores.md`](errores.md) | Catálogo de códigos de error | Se amplía en cada fase |
| [`fase-01-identidad.md`](fase-01-identidad.md) | Registro, OTP, login, recuperación, perfil, ubicaciones, zonas horarias, contacto | Fase 01 ✔ |
| [`fase-02-oferta.md`](fase-02-oferta.md) | Catálogo, ficha (acciones/CTA, moneda, beca) y disponibilidad por temática (HU-34) | Fase 02 ✔ |
| [`fase-03-portal.md`](fase-03-portal.md) | Dashboard, Mi formación, inscripción gratuita, Aula, materiales, sesiones en vivo, asistencia, calendario, biblioteca, notificaciones | Fase 03 ✔ |
| [`fase-04-postulaciones.md`](fase-04-postulaciones.md) | Becas disponibles, convocatorias abiertas, formulario con borrador y evidencias, envío, Mis postulaciones (línea de tiempo, entrevista, resultado, confirmación) + widgets, calendario y acciones de la ficha | Fase 04 ✔ |
| [`fase-05-pagos.md`](fase-05-pagos.md) | Stripe Checkout (pago completo y saldo tras beca), transferencia México, cuotas con cobro automático (fallos, mora, actualizar tarjeta), acceso Moodle, Mis pagos y recibos PDF + acciones de ficha/postulaciones, Dashboard y notificaciones | Fase 05 ✔ |
| `fase-06-admin.md` | Panel administrativo | Fase 06 (pendiente) |

## URLs

| Entorno | API base | Documentación interactiva | Contrato OpenAPI |
|---|---|---|---|
| Local | `http://localhost:3000/api/v1` | `http://localhost:3000/docs` | `http://localhost:3000/docs/openapi.json` |
| Producción | `https://<dominio-api>/api/v1` | `https://<dominio-api>/docs` | `https://<dominio-api>/docs/openapi.json` |

El contrato también está versionado en el repo: [`openapi/openapi.json`](../../openapi/openapi.json)
(OpenAPI 3.1). Es la **fuente de verdad** de rutas, cuerpos, respuestas y errores por endpoint.

## Tipos TypeScript desde OpenAPI

Recomendado: [`openapi-typescript`](https://openapi-ts.dev/) + [`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/).

```bash
# Desde el repo del frontend (archivo local o URL del backend)
npx openapi-typescript ../Itinerantes-backend/openapi/openapi.json -o src/api/schema.d.ts
# o
npx openapi-typescript http://localhost:3000/docs/openapi.json -o src/api/schema.d.ts
```

```ts
import createClient from 'openapi-fetch';
import type { paths, components } from './schema';

export const api = createClient<paths>({ baseUrl: import.meta.env.VITE_API_URL }); // .../ (sin /api/v1)
type ApiError = components['schemas']['ErrorResponseDto'];

const { data, error } = await api.GET('/api/v1/health');
```

Regenera los tipos cada vez que el backend publique una fase (el commit `feat(fase-XX)` actualiza
`openapi/openapi.json`).

## Autenticación

Detalle completo (pantallas HU-02 a HU-05, HU-14): [`fase-01-identidad.md`](fase-01-identidad.md).

- `POST /api/v1/auth/login { email, password, rememberMe? }` →
  `{ accessToken, tokenType, expiresIn, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt, user }`.
- Enviar `Authorization: Bearer <accessToken>` en cada petición protegida. El access token dura
  15 min (`expiresIn` en segundos).
- `POST /api/v1/auth/refresh { refreshToken }` → par nuevo. El refresh anterior queda **invalidado**
  (rotación): guarda siempre el último y haz **un solo refresh a la vez**; reusar un refresh ya
  rotado cierra la sesión completa. Vida del refresh: 7 días (30 con "Recordarme").
- `POST /api/v1/auth/logout { refreshToken }` → `204`.
- Todas las rutas requieren token salvo las marcadas como públicas (en Scalar aparecen sin candado;
  en OpenAPI tienen `security: []`).
- Algunas rutas públicas tienen **auth opcional** (desde Fase 02, p. ej. `GET /offers`): en OpenAPI
  `security: [{ bearer: [] }, {}]`. Con token válido se personalizan; sin token o con token vencido
  responden como visitante (nunca 401).
- `401 UNAUTHORIZED` → intenta refresh una vez; si responde `AUTH_REFRESH_INVALID`, manda a login.
- `403 AUTH_EMAIL_NOT_VERIFIED` en el login → pantalla de verificación OTP (HU-03).
- `403 FORBIDDEN` → el usuario no tiene el rol/permiso.
- Recursos del usuario autenticado: `GET/PATCH /api/v1/me`, `PATCH /me/timezone`, `POST /me/password`
  y, desde Fase 03, el portal bajo `/me/...` (`/me/dashboard`, `/me/enrollments`, `/me/classrooms/{offerId}`,
  `/me/sessions`, `/me/calendar`, `/me/notifications`) más `/library` y, desde Fase 04,
  `/me/applications` (postulaciones a becas y convocatorias) y, desde Fase 05, `/me/payments`
  (pagos, cuotas, transferencias, recibos) y `/me/moodle-access` (vinculación Moodle).
- Acceso a una formación sin inscripción → `403 ENROLLMENT_REQUIRED` (`meta.offerSlug` para ofrecer la
  ficha); recursos ajenos u ocultos → `404`. Ver [`fase-03-portal.md`](fase-03-portal.md).

## Formato de error (único en toda la API)

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Los datos enviados no son válidos.",
  "details": [
    { "field": "email", "code": "IS_EMAIL", "message": "Debe ser un correo electrónico válido." }
  ],
  "requestId": "3f1c2a9e-5b7d-4c1e-9f0a-2d8b6e4c1a7f"
}
```

| Campo | Uso en el frontend |
|---|---|
| `statusCode` | Igual al status HTTP. |
| `code` | **Estable.** Decide la UI con esto (no con `message`). Catálogo: [`errores.md`](errores.md). |
| `message` | Texto en español, apto para mostrar como fallback genérico. |
| `details` | Opcional. Errores por campo: pinta `details[].message` bajo el input `details[].field` (ruta con puntos para anidados: `address.city`, `items.0.qty`). |
| `meta` | Opcional. Datos extra para la UI según el `code` (p. ej. `lockedUntil`, `resendAvailableAt`, `attemptsRemaining`). Ver [`errores.md`](errores.md). |
| `requestId` | Muéstralo en errores 5xx ("Código de soporte: …"). También llega en el header `X-Request-Id`. |

Códigos de campo (`details[].code`) comunes: `REQUIRED`, `IS_EMAIL`, `MIN_LENGTH`, `MAX_LENGTH`,
`MIN`, `MAX`, `IS_ENUM`, `IS_UUID`, `MATCHES`, `UNKNOWN_FIELD` (campo no permitido), `ALREADY_EXISTS`
(valor duplicado). Cada guía de fase lista los específicos de sus formularios.

Ejemplo de manejo:

```ts
if (error) {
  switch (error.code) {
    case 'VALIDATION_ERROR':
      error.details?.forEach((d) => form.setError(d.field, { message: d.message }));
      break;
    case 'RATE_LIMITED':
      toast('Demasiados intentos. Espera un momento.');
      break;
    default:
      toast(error.message);
  }
}
```

## Paginación

```
GET /api/v1/<recurso>?page=1&pageSize=20&<filtros>
```

```json
{ "data": [ ... ], "meta": { "page": 1, "pageSize": 20, "total": 57, "totalPages": 3 } }
```

- `page` empieza en 1; `pageSize` por defecto 20, máximo 100.
- Un recurso individual (`GET /recurso/{id}`) se devuelve como objeto plano, sin envoltorio.

## Fechas y zonas horarias

- Todas las fechas viajan en **ISO 8601 UTC**: `2026-11-07T16:00:00.000Z`.
- El frontend las convierte a la zona del usuario (perfil → `timezone`, por defecto
  `America/Mexico_City`). Ejemplo con `Intl`:
  `new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }).format(new Date(iso))`.
- La **hora oficial** de las actividades es CDMX (`America/Mexico_City`, UTC−6 todo el año). Cuando la HU
  pide "hora CDMX junto a la local" (HU-11), formatea el mismo instante en ambas zonas.
- Al **enviar** fechas, manda ISO 8601 con zona (`Z` u offset). Fechas sin hora (cumpleaños, fechas
  excluidas) se envían como `YYYY-MM-DD` cuando el endpoint lo indique.

## Dinero

- Siempre en **centavos enteros** + moneda: `{ "amountCents": 1020000, "currency": "MXN" }` = $10,200.00 MXN.
- Monedas: `MXN` (participantes de México) y `USD` (resto). **Nunca** se suman ni convierten entre sí.
- Formateo: `new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(amountCents / 100)`.
- Los montos a cobrar los calcula SIEMPRE el backend (Fase 05): el frontend nunca envía un monto a
  pagar; solo elige la oferta/postulación y el número de cuotas. Los pagos con tarjeta ocurren en
  Stripe Checkout (redirección); ver [`fase-05-pagos.md`](fase-05-pagos.md).

## Enums

- Llegan en inglés `SCREAMING_SNAKE_CASE` (`PENDING_PAYMENT`, `DIPLOMA`, ...).
- La guía de cada fase incluye la tabla **enum → texto en español** que se muestra en la UI
  (los textos del documento de HUs).

## Otros

- **CORS**: el backend solo acepta orígenes en su lista blanca (`CORS_ORIGINS`). Si el navegador
  bloquea la petición en un entorno nuevo, pide agregar el origen.
- **Rate limiting**: `429 RATE_LIMITED`. Login, OTP y contacto tienen límites más estrictos.
- **Archivos**: se suben/descargan con URLs firmadas temporales (S3). La fase correspondiente documenta
  el flujo (pedir URL → `PUT` del archivo con el `Content-Type` indicado → confirmar).
- **Salud**: `GET /api/v1/health` (vivo) y `GET /api/v1/health/ready` (BD disponible).
