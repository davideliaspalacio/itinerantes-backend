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
| `PASSWORD_MISMATCH` | La confirmación no coincide con la nueva contraseña (Fase 01). |
| `PASSWORD_HAS_LETTER`, `PASSWORD_HAS_DIGIT` | La contraseña no incluye una letra / un número (Fase 01). |
| `IS_IANA_TIMEZONE` | Zona horaria IANA no válida (Fase 01). |
| `INVALID_LOCATION` | País / estado / municipio inexistente o que no corresponde al nivel superior (Fase 01). |
| `INVALID_PHONE` | Longitud del teléfono no válida para el indicativo (Fase 01). |
| `IS_EMAIL`, `IS_STRING`, `IS_INT`, `IS_ENUM`, `IS_UUID`, `IS_DATE_STRING`, `MIN_LENGTH`, `MAX_LENGTH`, `MIN`, `MAX`, `MATCHES`, ... | Restricción de validación incumplida (nombre de la regla en `SCREAMING_SNAKE_CASE`). |

## Por fase

<!-- Cada fase agrega su sección con sus códigos. -->

### Fase 01 — Identidad y Contacto

Guía de pantallas: [`fase-01-identidad.md`](fase-01-identidad.md). Algunos errores traen `meta` (datos
para la UI, p. ej. la hora de desbloqueo); ver la columna `meta`.

| `code` | HTTP | Mensaje por defecto | `meta` | Cuándo ocurre / qué hacer en la UI |
|---|---|---|---|---|
| `AUTH_EMAIL_ALREADY_REGISTERED` | 409 | Ya existe una cuenta con este correo. | — | Registro (HU-02). Error bajo `email` (`details`); ofrecer ir al login. |
| `AUTH_USERNAME_TAKEN` | 409 | Ese nombre de usuario ya está en uso. | — | Registro (HU-02). Error bajo `username`. |
| `AUTH_INVALID_CREDENTIALS` | 401 | Correo o contraseña incorrectos. | — | Login (HU-04). Mensaje genérico; limpiar contraseña. |
| `AUTH_EMAIL_NOT_VERIFIED` | 403 | Debes verificar tu correo antes de iniciar sesión. | `email`, `maskedEmail`, `otpSent`, `codeLength`, `expiresAt`, `resendAvailableAt`, `lockedUntil` | Login con contraseña correcta y cuenta sin verificar → redirigir a HU-03. |
| `AUTH_ACCOUNT_DISABLED` | 403 | Tu cuenta está deshabilitada. Contacta al equipo de la Escuela. | — | Login, verificación o recuperación de una cuenta deshabilitada. |
| `AUTH_LOGIN_LOCKED` | 429 | Demasiados intentos fallidos. Intenta de nuevo más tarde. | `lockedUntil` | 5 fallos de login consecutivos → bloqueo temporal (HU-04). |
| `AUTH_ACCOUNT_NOT_FOUND` | 404 | No existe una cuenta con ese correo. | — | Recuperación (HU-05) o reenvío de OTP con un correo sin cuenta. Configurable (riesgo de enumeración). |
| `AUTH_ALREADY_VERIFIED` | 409 | Tu correo ya está verificado. Inicia sesión. | — | Verificar/reenviar OTP de una cuenta ya activa → login. |
| `AUTH_OTP_INVALID` | 400 | El código es incorrecto. | `attemptsRemaining` | Código OTP incorrecto (HU-03/HU-05). |
| `AUTH_OTP_EXPIRED` | 400 | El código expiró o ya no es válido. Solicita uno nuevo. | `resendAvailableAt` | Código vencido, ya usado o reemplazado → ofrecer reenvío. |
| `AUTH_OTP_LOCKED` | 429 | Demasiados intentos con el código. Espera antes de intentarlo de nuevo. | `lockedUntil` | 5 fallos de OTP consecutivos: no se puede verificar ni reenviar hasta `lockedUntil`. |
| `AUTH_OTP_COOLDOWN` | 429 | Espera un momento antes de solicitar un nuevo código. | `resendAvailableAt` | Reenvío antes de que termine la cuenta regresiva. |
| `AUTH_REFRESH_INVALID` | 401 | Tu sesión expiró. Inicia sesión de nuevo. | — | Refresh vencido, revocado o reutilizado → borrar tokens e ir al login. |
| `AUTH_RESET_TOKEN_INVALID` | 400 | El enlace de recuperación expiró o ya se usó. Solicita un nuevo código. | — | Paso 3 de HU-05 con `resetToken` vencido/usado → volver al paso 1. |
| `AUTH_CURRENT_PASSWORD_INVALID` | 400 | La contraseña actual es incorrecta. | — | Cambio de contraseña (HU-14). Error bajo `currentPassword`. |
| `CONTACT_CAPTCHA_FAILED` | 400 | No pudimos verificar que no eres un robot. Intenta de nuevo más tarde. | — | Contacto (HU-38) con captcha activo y token inválido/ausente. |

### Fase 02 — Oferta formativa

Guía de pantallas: [`fase-02-oferta.md`](fase-02-oferta.md).

| `code` | HTTP | Mensaje por defecto | `meta` | Cuándo ocurre / qué hacer en la UI |
|---|---|---|---|---|
| `OFFER_NOT_AVAILABLE` | 404 | Esta oferta ya no está disponible. | — | Ficha (HU-16) de una oferta inexistente, en borrador o archivada → "Esta oferta ya no está disponible" + enlace al catálogo. |

Validación del catálogo (`400 VALIDATION_ERROR`): `q` con menos de 3 caracteres
(`details[].field = "q"`, `code = "MIN_LENGTH"`); `type`, `status`, `modality`, `topic` o `topics`
fuera del enum (`IS_ENUM` / `IS_IN`).
