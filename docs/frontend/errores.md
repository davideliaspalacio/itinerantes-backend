# Catálogo de códigos de error

Fuente: `src/common/errors/error-codes.ts`. **Cada fase que agregue códigos debe actualizar esta tabla.**
Formato de la respuesta de error: ver [`README.md`](README.md#formato-de-error-único-en-toda-la-api).

Usa `code` para decidir la UI; `message` (español) sirve como texto por defecto. Los códigos no se
renombran una vez publicados.

## Genéricos (Fase 00)

| `code` | HTTP | Mensaje por defecto | Cuándo ocurre / qué hacer en la UI |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | Los datos enviados no son válidos. | Cuerpo/query inválido. Pinta `details[]` por campo. |
| `BAD_REQUEST` | 400 | La solicitud no es válida. | Petición mal formada (p. ej. JSON inválido). Error de integración. |
| `UNAUTHORIZED` | 401 | Necesitas iniciar sesión para continuar. | Sin token o token vencido → refresh o login. |
| `FORBIDDEN` | 403 | No tienes permiso para realizar esta acción. | Falta rol/permiso. |
| `NOT_FOUND` | 404 | El recurso solicitado no existe. | Recurso inexistente o ajeno; también ruta inexistente ("La ruta solicitada no existe."). |
| `CONFLICT` | 409 | La operación entra en conflicto con el estado actual del recurso. | Duplicado (`details[].code = ALREADY_EXISTS`) o estado inválido. |
| `PAYLOAD_TOO_LARGE` | 413 | El contenido enviado excede el tamaño permitido. | Archivo/cuerpo demasiado grande. |
| `BUSINESS_RULE_VIOLATION` | 422 | La operación no cumple una regla de negocio. | Regla de negocio genérica; las fases definen códigos más específicos. |
| `RATE_LIMITED` | 429 | Demasiadas solicitudes. Intenta de nuevo en unos momentos. | Límite de peticiones; espera y reintenta. |
| `INTERNAL_ERROR` | 500 | Ocurrió un error inesperado. Intenta de nuevo más tarde. | Error del servidor. Muestra `requestId` como código de soporte. |
| `SERVICE_UNAVAILABLE` | 503 | El servicio no está disponible temporalmente. | Dependencia caída (p. ej. BD en `/health/ready`). |

## Códigos de campo (`details[].code`)

| `code` | Significado |
|---|---|
| `REQUIRED` | Campo obligatorio ausente o vacío. |
| `UNKNOWN_FIELD` | Se envió un campo que el endpoint no acepta. |
| `ALREADY_EXISTS` | El valor ya está registrado (único). |
| `INVALID` | Valor inválido (genérico). |
| `IS_EMAIL`, `IS_STRING`, `IS_INT`, `IS_ENUM`, `IS_UUID`, `IS_DATE_STRING`, `MIN_LENGTH`, `MAX_LENGTH`, `MIN`, `MAX`, `MATCHES`, ... | Restricción de validación incumplida (nombre de la regla en `SCREAMING_SNAKE_CASE`). |

## Por fase

<!-- Cada fase agrega su sección con sus códigos (p. ej. AUTH_EMAIL_ALREADY_REGISTERED, AUTH_OTP_EXPIRED). -->

_Fase 01 en adelante: pendiente._
