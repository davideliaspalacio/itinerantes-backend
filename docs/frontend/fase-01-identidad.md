# Fase 01 — Identidad y Contacto público

Guía para implementar en el frontend las pantallas de **HU-02** (registro), **HU-03** (verificación
OTP), **HU-04** (login), **HU-05** (recuperación), **HU-14** (perfil, sin "Mis pagos"), el soporte de
**HU-11** (zonas horarias) y el formulario de **HU-38 / HU-01** (Contacto).

- Convenciones generales (errores, fechas, paginación): [`README.md`](README.md)
- Catálogo de códigos de error: [`errores.md`](errores.md#fase-01--identidad-y-contacto)
- Contrato exacto: [`openapi/openapi.json`](../../openapi/openapi.json) o `http://localhost:3000/docs`

Todas las rutas van con el prefijo `/api/v1`. Todas las fechas viajan en **UTC ISO 8601**.

## Resumen de endpoints

| Método y ruta | Auth | HU | Uso |
|---|---|---|---|
| `GET /locations/countries` | pública | 02, 14 | Selector de país (México y Centroamérica primero) |
| `GET /locations/countries/{code}/divisions` | pública | 02, 14 | Estados/departamentos del país |
| `GET /locations/divisions/{id}/municipalities` | pública | 02, 14 | Municipios del estado |
| `GET /timezones?at=` | pública | 02, 11, 14 | Zonas sugeridas + tabla "Ver en otros países" |
| `GET /auth/availability?email=&username=` | pública | 02 | Validación en línea de correo/username |
| `POST /auth/register` | pública | 02 | Crear cuenta (envía OTP) |
| `POST /auth/verify-email` | pública | 03 | Verificar con OTP |
| `POST /auth/otp/resend` | pública | 03, 05 | Reenviar código |
| `POST /auth/login` | pública | 04 | Iniciar sesión |
| `POST /auth/refresh` | pública | 04 | Renovar tokens (rotación) |
| `POST /auth/logout` | pública | 04 | Cerrar sesión |
| `POST /auth/password/forgot` | pública | 05 | Paso 1: enviar código |
| `POST /auth/password/verify-otp` | pública | 05 | Paso 2: verificar código → `resetToken` |
| `POST /auth/password/reset` | pública | 05 | Paso 3: nueva contraseña |
| `GET /me` | token | 14 | Mi perfil |
| `PATCH /me` | token | 14 | Editar datos personales |
| `PATCH /me/timezone` | token | 11, 14 | "Usar siempre esta zona" |
| `POST /me/password` | token | 14 | Cambiar contraseña (pestaña "Seguridad") |
| `POST /contact-messages` | pública | 38, 01 | Formulario de Contacto |

## Reglas que la UI debe conocer

| Regla | Valor | Fuente |
|---|---|---|
| Contraseña | mínimo 8 caracteres, al menos una letra y un número (máx. 128) | HU-02 |
| Nombre completo | solo letras (con tildes/ñ) y espacios; máx. 120 | HU-02 |
| Username | 3–30: letras, números, `.` y `_`; se guarda en minúsculas; no editable | HU-02 (supuesto) |
| Correo | se normaliza a minúsculas sin espacios; no editable | HU-02 |
| Teléfono | indicativo `+52` + número solo dígitos; longitud según el país del indicativo (`phoneMinLength`–`phoneMaxLength`) | HU-02 |
| OTP | 6 dígitos, vence en **10 min** | HU-03 |
| Reenvío de OTP | cada **30 s** (cuenta regresiva) | HU-03 |
| Intentos de OTP | **5** fallos consecutivos → bloqueo de **15 min** (ni verificar ni reenviar) | HU-03 |
| Intentos de login | **5** fallos consecutivos → bloqueo de **15 min** | HU-04 |
| `resetToken` (HU-05) | un solo uso, vence en **10 min** | HU-05 |
| Access token | 15 min (`expiresIn` en segundos) | — |
| Refresh token | 7 días; **30 días con "Recordarme"**; se renueva en cada refresh | HU-04 |

Los valores viven en `src/config/business-rules.ts` y pueden cambiar: **usa siempre los instantes que
devuelve la API** (`expiresAt`, `resendAvailableAt`, `lockedUntil`) en lugar de fijar 30 s/10 min en
el frontend. Cuenta regresiva = `new Date(resendAvailableAt).getTime() - Date.now()`.

## Errores con `meta`

Desde esta fase el formato de error puede traer `meta` (datos para la UI):

```json
{
  "statusCode": 429,
  "code": "AUTH_OTP_LOCKED",
  "message": "Demasiados intentos con el código. Espera antes de intentarlo de nuevo.",
  "meta": { "lockedUntil": "2026-11-07T16:15:00.000Z" },
  "requestId": "…"
}
```

| `code` | `meta` |
|---|---|
| `AUTH_OTP_INVALID` | `{ attemptsRemaining }` |
| `AUTH_OTP_EXPIRED` | `{ resendAvailableAt }` |
| `AUTH_OTP_LOCKED`, `AUTH_LOGIN_LOCKED` | `{ lockedUntil }` |
| `AUTH_OTP_COOLDOWN` | `{ resendAvailableAt }` |
| `AUTH_EMAIL_NOT_VERIFIED` | `{ email, maskedEmail, otpSent, codeLength, expiresAt, resendAvailableAt, lockedUntil }` |

---

## Tokens: cómo guardarlos y renovarlos

`POST /auth/login` (y `POST /auth/refresh`) devuelven:

```json
{
  "accessToken": "eyJhbGciOi…",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "accessTokenExpiresAt": "2026-11-07T16:15:00.000Z",
  "refreshToken": "q5V3n8x1b0pY7mKkz2c4dWJ9eH6tA1sLrUoG3fQ8yZw",
  "refreshTokenExpiresAt": "2026-11-14T16:00:00.000Z",
  "user": { "...": "perfil completo, igual a GET /me" }
}
```

Recomendación:

1. **accessToken en memoria** (estado de la app). Envíalo como `Authorization: Bearer <accessToken>`.
2. **refreshToken** en almacenamiento persistente solo si el usuario marcó "Recordarme"
   (`localStorage`); si no, en `sessionStorage` (se pierde al cerrar la pestaña). El backend no usa
   cookies.
3. **Rotación**: cada `POST /auth/refresh` devuelve un refreshToken NUEVO y el anterior deja de
   servir. Guarda siempre el último.
4. **Un solo refresh a la vez** (single-flight): si dos peticiones refrescan con el mismo token, la
   segunda se considera reuso y **se cierra la sesión completa** (protección contra robo). Encola las
   peticiones que reciban 401 mientras hay un refresh en curso.
5. Flujo ante `401`:
   - `UNAUTHORIZED` en una ruta protegida → intenta `POST /auth/refresh` una vez y repite la petición.
   - `AUTH_REFRESH_INVALID` en el refresh → borra tokens y manda al login (HU-04: "sesión expirada").
6. Refresco proactivo opcional: renueva ~60 s antes de `accessTokenExpiresAt`.
7. **Logout**: `POST /auth/logout { refreshToken }` → `204` (idempotente; no necesita access token).
   Borra ambos tokens aunque la llamada falle.

```ts
let refreshing: Promise<void> | null = null;

async function refreshTokens() {
  refreshing ??= (async () => {
    const { data, error } = await api.POST('/api/v1/auth/refresh', {
      body: { refreshToken: storage.refreshToken! },
    });
    if (error) { storage.clear(); router.push('/login?expired=1'); throw error; }
    storage.save(data); // accessToken + refreshToken nuevos
  })().finally(() => { refreshing = null; });
  return refreshing;
}
```

---

## HU-02 — Registro

### Endpoints

1. Al cargar: `GET /locations/countries` y `GET /timezones`.
2. Al elegir país con `hasDivisions: true`: `GET /locations/countries/{code}/divisions`.
3. Al elegir estado con `hasMunicipalities: true`: `GET /locations/divisions/{id}/municipalities`.
4. En línea (debounce ~400 ms, al salir del campo): `GET /auth/availability?email=…` y `…?username=…`.
5. Enviar: `POST /auth/register`.

### Ubicación en cascada

| Situación | Qué enviar en `location` |
|---|---|
| País con lista (`hasDivisions: true`, hoy México) y estado con municipios (`hasMunicipalities: true`) | `{ countryCode, divisionId, municipalityId }` |
| País con lista pero estado sin municipios | `{ countryCode, divisionId, municipalityName }` |
| País sin lista (`hasDivisions: false`) | `{ countryCode, divisionName, municipalityName }` (texto libre obligatorio) |

Usa `divisionLabel` / `municipalityLabel` del país como etiqueta ("Estado", "Departamento",
"Provincia"; "Municipio", "Cantón", "Comuna"…). México tiene los 32 estados y los 2,478 municipios
del catálogo INEGI.

**Teléfono:** al elegir país, precarga `phone.countryCode` con su `phoneCode` (editable). Valida en
cliente la longitud con `phoneMinLength`/`phoneMaxLength`.

**Zona horaria:** prellena con `Intl.DateTimeFormat().resolvedOptions().timeZone`. Si falla o no es
válida, usa `defaultTimezone` de `GET /timezones` (`America/Mexico_City`) y muestra el aviso
"Detectamos tu zona horaria: [zona]. Puedes cambiarla." / aviso para confirmarla. El selector puede
mostrar `zones` (con búsqueda por `label` o `countryCode`), pero acepta cualquier zona IANA.

### Petición

```http
POST /api/v1/auth/register
```
```json
{
  "fullName": "María José Núñez",
  "username": "mariajose",
  "email": "maria.nunez@example.com",
  "password": "Agua2026segura",
  "phone": { "countryCode": "+52", "number": "5512345678" },
  "location": {
    "countryCode": "MX",
    "divisionId": "3f6c1f0e-8a7b-4c1e-9f0a-2d8b6e4c1a7f",
    "municipalityId": "9b2d4c1e-5b7d-4c1e-9f0a-2d8b6e4c1a7f"
  },
  "timezone": "America/Mexico_City"
}
```

### Respuesta `201`

```json
{
  "userId": "a3c1e2f4-…",
  "email": "maria.nunez@example.com",
  "status": "PENDING_VERIFICATION",
  "otp": {
    "maskedEmail": "m***@example.com",
    "codeLength": 6,
    "expiresAt": "2026-11-07T16:10:00.000Z",
    "resendAvailableAt": "2026-11-07T16:00:30.000Z"
  }
}
```

Guarda `email` y `otp` (estado de navegación) y ve a la pantalla de verificación (HU-03).

### Estados de UI

| Estado HU-02 | Disparador | Qué mostrar |
|---|---|---|
| Default | carga inicial | Formulario; país con México/Centroamérica primero; zona prellenada |
| Warning (zona) | detección del navegador falló | `America/Mexico_City` + aviso para confirmar |
| Error en línea | `availability.email.available === false` (con `valid: true`) | "Ya existe una cuenta con este correo" + enlace a login |
| Error en línea | `availability.username.available === false` | "Ese nombre de usuario ya está en uso" |
| Loading | envío en curso | "Crear cuenta" deshabilitado |
| Error | `400 VALIDATION_ERROR` | Pinta `details[].message` bajo `details[].field` (`location.divisionId`, `phone.number`…) |
| Error | `409 AUTH_EMAIL_ALREADY_REGISTERED` / `AUTH_USERNAME_TAKEN` | Error bajo el campo (`details[].field`) |
| Error | `429 RATE_LIMITED` | "Demasiados intentos, espera un momento" |
| Success | `201` | Redirección automática a HU-03 |

Códigos de campo específicos: `MATCHES` (formato de nombre/username/teléfono), `MIN_LENGTH`,
`PASSWORD_HAS_LETTER`, `PASSWORD_HAS_DIGIT`, `IS_IANA_TIMEZONE`, `INVALID_PHONE` (longitud para el
indicativo), `INVALID_LOCATION` (país/estado/municipio que no existe o no corresponde), `REQUIRED`,
`ALREADY_EXISTS`, `UNKNOWN_FIELD`.

> Si el correo ya existe pero nunca se verificó, el registro responde
> `AUTH_EMAIL_ALREADY_REGISTERED`: lleva al usuario al login; al entrar con su contraseña se le
> redirige a HU-03 (ver HU-04).

---

## HU-03 — Verificación de correo (OTP)

### Secuencia

1. Llega desde el registro (con `otp`) o desde el login (`AUTH_EMAIL_NOT_VERIFIED`, con `meta`).
2. Muestra `maskedEmail`, 6 casillas (`codeLength`), cuenta regresiva hasta `resendAvailableAt`.
3. `POST /auth/verify-email { email, code }` → `200 { verified: true, email }`.
4. Éxito → redirige al login (HU-04) con el correo precargado (o al Dashboard si ya hay sesión).
   **Opcional — entrar directo:** envía `{ email, code, startSession: true, rememberMe? }` y la
   respuesta trae `session` (mismo formato que `POST /auth/login`: tokens + `user`); guárdala y lleva
   a la persona al Dashboard sin pedirle la contraseña otra vez.
5. "Reenviar código" (habilitado cuando la cuenta regresiva llega a 0):
   `POST /auth/otp/resend { email, purpose: "EMAIL_VERIFICATION" }` → `200` con el nuevo
   `{ maskedEmail, codeLength, expiresAt, resendAvailableAt }`. El código anterior deja de servir.

### Estados de UI

| Estado HU-03 | Respuesta | Qué mostrar |
|---|---|---|
| Default | — | Casillas vacías; "Verificar" se habilita al completar 6 dígitos |
| Loading | petición en curso | "Verificar" deshabilitado |
| Error | `400 AUTH_OTP_INVALID` | "El código es incorrecto. Te quedan `meta.attemptsRemaining` intentos." Limpia casillas |
| Error | `400 AUTH_OTP_EXPIRED` | "El código expiró. Solicita uno nuevo." Habilita reenvío desde `meta.resendAvailableAt` |
| Error | `429 AUTH_OTP_LOCKED` | "Demasiados intentos. Intenta de nuevo a las HH:MM" (`meta.lockedUntil`); deshabilita verificar y reenviar hasta entonces |
| Error | `429 AUTH_OTP_COOLDOWN` (reenvío) | Reinicia la cuenta regresiva con `meta.resendAvailableAt` |
| Error | `409 AUTH_ALREADY_VERIFIED` | "Tu correo ya está verificado" → login |
| Error | `403 AUTH_ACCOUNT_DISABLED` | "Tu cuenta está deshabilitada…" |
| Success | `200` | Mensaje breve y redirección al login |

Los 5 intentos son **consecutivos**: reenviar un código no los reinicia (sí lo hace un bloqueo
cumplido o una verificación exitosa).

---

## HU-04 — Inicio de sesión

### Petición

```json
POST /api/v1/auth/login
{ "email": "maria.nunez@example.com", "password": "Agua2026segura", "rememberMe": true }
```

`200` → guarda los tokens (ver arriba) y redirige al Dashboard (HU-06) o a la ruta solicitada.
`user` trae el perfil (nombre para "Hola, [Nombre]", `timezone` para HU-11, `currency`).

### Estados de UI

| Estado HU-04 | Respuesta | Qué mostrar |
|---|---|---|
| Default | — | Foco en correo; "Ingresar" deshabilitado si hay campos vacíos |
| Loading | petición en curso | "Ingresando…" deshabilitado |
| Error | `401 AUTH_INVALID_CREDENTIALS` | Mensaje genérico ("Correo o contraseña incorrectos"); conserva el correo y limpia la contraseña |
| Error | `429 AUTH_LOGIN_LOCKED` | "Demasiados intentos fallidos. Intenta de nuevo a las HH:MM" (`meta.lockedUntil`) |
| Redirección | `403 AUTH_EMAIL_NOT_VERIFIED` | Navega a HU-03 con `meta.email` y `{ maskedEmail, codeLength, expiresAt, resendAvailableAt }` de `meta`. Si `meta.otpSent` es `true` di "Te enviamos un código nuevo"; si es `false` el último código sigue vigente (si `expiresAt` es `null`, deja que el usuario pida otro cuando termine la cuenta regresiva). Si `meta.lockedUntil` no es `null`, muestra el bloqueo |
| Error | `403 AUTH_ACCOUNT_DISABLED` | "Tu cuenta está deshabilitada. Contacta al equipo." |
| Error | `400 VALIDATION_ERROR` | Validación en línea |
| Error | `429 RATE_LIMITED` | Límite por IP (10/min): "Espera un momento" |
| Success | `200` | Dashboard o página solicitada |

`AUTH_EMAIL_NOT_VERIFIED` solo aparece si la contraseña es correcta (no revela cuentas). Sesión
expirada (HU-04, rutas `/portal`) → ver "Tokens" (`AUTH_REFRESH_INVALID` → login).

---

## HU-05 — Recuperación de contraseña

### Secuencia (3 pasos)

| Paso | Petición | Respuesta OK |
|---|---|---|
| 1. Correo | `POST /auth/password/forgot { email }` | `200 { maskedEmail, codeLength, expiresAt, resendAvailableAt }` |
| 2. Código | `POST /auth/password/verify-otp { email, code }` | `200 { resetToken, expiresAt }` (guárdalo en memoria) |
| 2b. Reenviar | `POST /auth/otp/resend { email, purpose: "PASSWORD_RESET" }` | igual que el paso 1 |
| 3. Nueva contraseña | `POST /auth/password/reset { resetToken, newPassword, confirmPassword }` | `204` |

Tras el `204`: confirmación y redirección automática al login. El backend invalida el OTP, **cierra
todas las sesiones** (los refresh tokens anteriores dejan de servir), desbloquea el login y, si la
cuenta estaba pendiente de verificación, la activa (el OTP demuestra que el correo es suyo).

### Estados de UI

| Estado HU-05 | Respuesta | Qué mostrar |
|---|---|---|
| Paso 1 · Error | `404 AUTH_ACCOUNT_NOT_FOUND` | "No existe una cuenta con ese correo" (no avanza) |
| Paso 1 · Error | `429 AUTH_OTP_COOLDOWN` | Ya se envió un código hace poco: avanza al paso 2 con la cuenta regresiva de `meta.resendAvailableAt` |
| Paso 1/2 · Error | `429 AUTH_OTP_LOCKED` | Bloqueo hasta `meta.lockedUntil` |
| Paso 1 · Error | `403 AUTH_ACCOUNT_DISABLED` | Cuenta deshabilitada |
| Paso 2 · Error | `400 AUTH_OTP_INVALID` / `AUTH_OTP_EXPIRED` | Igual que HU-03 (mismas casillas y cuenta regresiva) |
| Paso 3 · Error | `400 VALIDATION_ERROR` con `details[].code = PASSWORD_MISMATCH` | "Las contraseñas no coinciden" bajo `confirmPassword` (valida también en tiempo real en cliente) |
| Paso 3 · Error | `400 AUTH_RESET_TOKEN_INVALID` | "El enlace expiró o ya se usó" → vuelve al paso 1 |
| Success | `204` | "Contraseña actualizada" → login |

> **Riesgo de enumeración (decisión del cliente).** HU-05 pide informar que la cuenta no existe, lo
> que permite a un tercero comprobar si un correo está registrado. Se implementó así pero es
> configurable: `BUSINESS_RULES.REVEAL_UNKNOWN_EMAIL_ON_RESET` (`revealUnknownEmailOnReset`). Si se
> pone en `false`, el paso 1 responde siempre `200` (sin enviar nada si no hay cuenta) y el paso 2
> responde `AUTH_OTP_INVALID`; la UI debe decir "Si el correo está registrado, te enviamos un
> código". `GET /auth/availability` también revela si un correo existe (lo exige HU-02); ambos
> endpoints tienen límite por IP.

---

## HU-14 — Perfil (sin "Mis pagos")

### Endpoints por pestaña

| Pestaña | Lectura | Escritura |
|---|---|---|
| Datos personales | `GET /me` | `PATCH /me { fullName?, phone?, location?, timezone? }` |
| Zona horaria | `GET /me` (`timezone`) + `GET /timezones` | `PATCH /me/timezone { timezone }` |
| Seguridad | — | `POST /me/password { currentPassword, newPassword, confirmPassword }` → `204` |
| Mis pagos | Fase 05 (HU-26) | — |

`GET /me`:

```json
{
  "id": "a3c1e2f4-…",
  "fullName": "María José Núñez",
  "username": "mariajose",
  "email": "maria.nunez@example.com",
  "phone": { "countryCode": "+52", "number": "5512345678" },
  "location": {
    "countryCode": "MX", "countryName": "México",
    "divisionId": "3f6c…", "divisionName": "Ciudad de México",
    "municipalityId": "9b2d…", "municipalityName": "Coyoacán"
  },
  "timezone": "America/Mexico_City",
  "currency": "MXN",
  "roles": ["PARTICIPANT"],
  "status": "ACTIVE",
  "emailVerifiedAt": "2026-11-07T16:00:00.000Z",
  "lastLoginAt": "2026-11-07T16:00:00.000Z",
  "createdAt": "2026-11-07T16:00:00.000Z",
  "updatedAt": "2026-11-07T16:00:00.000Z"
}
```

- `username` y `email` en solo lectura (fondo gris). Enviarlos en `PATCH /me` → `400` con
  `details[].code = UNKNOWN_FIELD`.
- `currency` es **calculado**: `MX` → `MXN`, resto → `USD`. Al cambiar de país solo cambian los pagos
  nuevos.
- `location` en `PATCH /me` se envía **completa** (misma cascada que HU-02). `divisionId` /
  `municipalityId` son `null` cuando se capturaron como texto libre.
- Todas las respuestas de escritura devuelven el perfil actualizado (`200`).
- Cambiar la contraseña **cierra las demás sesiones**; la actual sigue activa.

| Estado HU-14 | Respuesta | Qué mostrar |
|---|---|---|
| Default | `GET /me` | Formulario prellenado |
| Loading | petición | "Guardar cambios" deshabilitado |
| Success | `200` / `204` | "Cambios guardados" |
| Error | `400 VALIDATION_ERROR` | Error en línea sin perder datos (`INVALID_LOCATION`, `INVALID_PHONE`, `IS_IANA_TIMEZONE`, …) |
| Error | `400 AUTH_CURRENT_PASSWORD_INVALID` | "La contraseña actual es incorrecta" bajo `currentPassword` |
| Error | `401 UNAUTHORIZED` | Refresh / login |

---

## HU-11 — Zonas horarias (soporte backend)

`GET /timezones?at=<ISO opcional>`:

```json
{
  "officialTimezone": "America/Mexico_City",
  "defaultTimezone": "America/Mexico_City",
  "at": "2026-11-07T16:00:00.000Z",
  "zones": [
    { "id": "America/Mexico_City", "label": "Ciudad de México (CDMX)", "countryCode": "MX", "utcOffset": "-06:00", "offsetMinutes": -360 },
    { "id": "America/Bogota", "label": "Bogotá (Colombia)", "countryCode": "CO", "utcOffset": "-05:00", "offsetMinutes": -300 }
  ],
  "referenceZones": [
    { "id": "America/Mexico_City", "label": "Ciudad de México (hora CDMX)", "utcOffset": "-06:00", "offsetMinutes": -360, "isOfficial": true },
    { "id": "America/Guatemala", "label": "Centroamérica (Guatemala, El Salvador, Honduras, Nicaragua, Costa Rica)", "utcOffset": "-06:00", "offsetMinutes": -360, "isOfficial": false },
    { "id": "America/Bogota", "label": "Bogotá / Lima", "…": "…" },
    { "id": "America/Santiago", "label": "Santiago", "…": "…" },
    { "id": "America/Argentina/Buenos_Aires", "label": "Buenos Aires", "…": "…" },
    { "id": "Europe/Madrid", "label": "Madrid", "…": "…" }
  ]
}
```

- El backend **no convierte horarios**: todas las fechas viajan en UTC y la hora oficial de las
  actividades es `America/Mexico_City`. Convierte en el cliente con `Intl.DateTimeFormat(…, { timeZone })`
  (incluye horario de verano). Los offsets de esta respuesta son solo para mostrar/ordenar; para la
  tabla "Ver en otros países" de una actividad formatea su instante en cada `referenceZones[].id`.
- Zona activa: `user.timezone` (perfil) → navegador → `defaultTimezone`.
- "Usar siempre esta zona" (solo con sesión) → `PATCH /me/timezone`.

---

## HU-38 / HU-01 — Contacto

`POST /contact-messages` (público; mismo componente en la página Contacto y en la landing):

```json
{
  "name": "Lucía Hernández",
  "email": "lucia@example.com",
  "organization": "Cooperativa Agua Viva",
  "phone": { "countryCode": "+52", "number": "5512345678" },
  "subject": "DESIGN_CONSULTING",
  "projectType": "COLLECTIVE",
  "projectLocation": "San Cristóbal de las Casas, Chiapas",
  "service": "RAINWATER_HARVESTING_DESIGN",
  "message": "Queremos captar agua de lluvia en el centro comunitario.",
  "privacyAccepted": true,
  "origin": "DESIGN_CONSULTING_PAGE",
  "website": "",
  "captchaToken": "…"
}
```

→ `201 { "id": "…", "status": "NEW", "createdAt": "…" }`. Se envía acuse al visitante y aviso al
buzón del equipo.

- Obligatorios: `name` (≥ 3), `email`, `subject`, `message` (10–2000), `privacyAccepted: true`, `origin`.
- Opcionales: `organization`, `phone` (Teléfono / WhatsApp).
- Con `subject = DESIGN_CONSULTING` son obligatorios `projectType`, `projectLocation` y `service`
  (se ignoran con otro asunto).
- `origin`: el componente lo fija según la página (landing → `LANDING`). Lee de la URL `asunto`,
  `servicio` y `origen` para precargar (HU-35/36) e ignora valores que no estén en las tablas.
- **Honeypot**: incluye un input oculto `website` (fuera de pantalla, `tabindex=-1`,
  `autocomplete=off`) y envíalo vacío. Si llega con texto el backend responde `201` igual pero
  descarta el mensaje.
- **Captcha**: el backend tiene preparado Cloudflare Turnstile. Solo se exige `captchaToken` si el
  backend tiene `TURNSTILE_SECRET_KEY` configurada (hoy desactivado). Integra el widget invisible y
  manda el token siempre que exista.
- Límite: **5 envíos por IP por hora** → `429 RATE_LIMITED`.

| Estado HU-38 | Respuesta | Qué mostrar |
|---|---|---|
| Default | — | Asunto preseleccionado si viene en la URL; botón deshabilitado hasta completar obligatorios |
| Loading | envío | Botón en carga, campos bloqueados |
| Success | `201` | "¡Gracias! Recibimos tu mensaje." + "Enviar otro mensaje" (limpia el formulario) |
| Error | `400 VALIDATION_ERROR` | Errores en línea, conserva lo escrito |
| Error | `400 CONTACT_CAPTCHA_FAILED` / `429 RATE_LIMITED` | "Intenta de nuevo más tarde" con reintentar |

### Enums → texto

`subject` (`ContactSubject`):

| Valor | Texto |
|---|---|
| `SCHOOL` | Escuela |
| `DESIGN_CONSULTING` | Diseño y asesoría |
| `REGENERATIVE_TECH_HAWA` | Tecnologías regenerativas – HAWA |
| `SCHOLARSHIPS_CALLS` | Becas y convocatorias |
| `OTHER` | Otro |

`projectType` (`ContactProjectType`):

| Valor | Texto |
|---|---|
| `HOUSEHOLD` | Domiciliario |
| `COMMERCIAL` | Comercial |
| `COLLECTIVE` | Colectivo / organización |
| `PRODUCTIVE` | Productivo |
| `OTHER` | Otro |

`service` (`ContactService`, los 5 de HU-35 + "Aún no lo sé"):

| Valor | Texto |
|---|---|
| `WASTEWATER_TREATMENT_DESIGN` | Diseño de sistemas de tratamiento de aguas residuales |
| `RAINWATER_HARVESTING_DESIGN` | Diseño de sistemas de captación de lluvias |
| `INFILTRATION_REHYDRATION_DESIGN` | Diseño de sistemas de infiltración y rehidratación del paisaje |
| `WATER_RESILIENCE_DIAGNOSTICS` | Diagnósticos y estrategias para la resiliencia hídrica |
| `TECHNOLOGY_IMPLEMENTATION_ADVICE` | Asesoría para implementación de tecnologías |
| `NOT_SURE` | Aún no lo sé |

`origin` (`ContactOrigin`):

| Valor | Texto |
|---|---|
| `CONTACT_PAGE` | Página de Contacto |
| `LANDING` | Landing |
| `DESIGN_CONSULTING_PAGE` | Diseño y Asesoría |
| `REGENERATIVE_TECH_PAGE` | Tecnologías regenerativas |
| `ABOUT_PAGE` | Nuestra trayectoria |

`status` (`ContactStatus`): `NEW` → Nuevo.

## Otros enums

| Enum | Valor | Texto |
|---|---|---|
| `UserStatus` | `PENDING_VERIFICATION` | Pendiente de verificación |
| | `ACTIVE` | Activa |
| | `DISABLED` | Deshabilitada |
| `Role` | `PARTICIPANT` | Participante |
| | `SUPER_ADMIN` | Superadministración |
| | `ACADEMIC_COORDINATOR` | Coordinación académica |
| | `REVIEW_COMMITTEE` | Comité de revisión |
| | `REVIEW_DECIDER` | Decisión de postulaciones |
| | `FOLLOW_UP` | Seguimiento |
| | `FINANCE` | Finanzas |
| `OtpPurpose` | `EMAIL_VERIFICATION` | Verificación de correo |
| | `PASSWORD_RESET` | Recuperación de contraseña |

## Datos demo (entornos no productivos)

| Usuario | Correo | Contraseña | Roles |
|---|---|---|---|
| Participante | `participante@example.com` | `Demo12345` | `PARTICIPANT` |
| Admin | `admin@example.com` | `Admin12345` | `SUPER_ADMIN` |

En desarrollo los correos (OTP, acuses) llegan a Mailpit: <http://localhost:8025>.
