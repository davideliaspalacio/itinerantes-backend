# Reuniones de Zoom / Google Meet — botón "Generar enlace"

Mejora del panel sobre **HU-29** (sesiones en vivo y eventos del calendario) y **HU-31** (entrevistas
de postulación): en lugar de pegar a mano un enlace de Zoom o Meet, el equipo pulsa **"Generar
enlace"** y la API crea la reunión en el proveedor. Los endpoints de sesiones, eventos y entrevistas
**no cambian**: este módulo solo produce los enlaces que el formulario ya enviaba.

- Convenciones generales: [`README.md`](README.md) · Errores: [`errores.md`](errores.md#reuniones-generadas--zoom--google-meet-apoyo-a-hu-29-y-hu-31)
- Contrato exacto: [`openapi/openapi.json`](../../openapi/openapi.json), tag **Admin – Reuniones (Zoom / Google Meet)**.
- Permiso: **`meetings.create`** (SUPER_ADMIN, Coordinación académica, Comité de revisión y Comité con
  decisión). Muéstralo solo si `GET /admin/me` → `permissions` lo incluye.

## Resumen de endpoints

Prefijo `/api/v1`. Todos requieren sesión y el permiso `meetings.create`.

| Método y ruta | Para qué | Respuesta |
|---|---|---|
| `GET /admin/meetings/providers` | Qué proveedores están configurados en el servidor | `200 { data: [{ provider, label, enabled, usableForInterviews }] }` |
| `POST /admin/meetings` | Crear la reunión | `201 MeetingDto` |
| `GET /admin/meetings/{provider}/{externalId}/host-url` | Enlace de anfitrión vigente (Zoom caduca) | `200 { provider, externalId, hostUrl }` |
| `DELETE /admin/meetings/{provider}/{externalId}` | Cancelar la reunión generada (el usuario descartó) | `204` (idempotente) |

### `POST /admin/meetings`

```json
{
  "provider": "ZOOM",
  "topic": "Diplomado Gestión del Agua — Sesión 3",
  "startAt": "2026-11-12T17:00:00.000Z",
  "durationMinutes": 90,
  "timezone": "America/Mexico_City"
}
```

| Campo | Regla |
|---|---|
| `provider` | `ZOOM` o `GOOGLE_MEET`; debe estar `enabled` |
| `topic` | 3–200 caracteres (se recorta) |
| `startAt` | ISO 8601 con zona (`Z` u offset); **futuro** (`details[].code = MUST_BE_FUTURE`) |
| `durationMinutes` | Entero de 15 a 480 |
| `timezone` | Opcional, zona IANA; por defecto `America/Mexico_City`. Solo afecta cómo la muestra el proveedor |

Respuesta (`MeetingDto`):

```json
{
  "provider": "ZOOM",
  "externalId": "85746065432",
  "joinUrl": "https://us02web.zoom.us/j/85746065432?pwd=abc123",
  "hostUrl": "https://us02web.zoom.us/s/85746065432?zak=…",
  "password": "abc123",
  "startAt": "2026-11-12T17:00:00.000Z",
  "durationMinutes": 90
}
```

- `joinUrl` → enlace de participantes. Zoom: `https://…zoom.us/j/…`; Meet: `https://meet.google.com/xxx-xxxx-xxx`.
- `hostUrl` → enlace de anfitrión. **Zoom: caduca a las ≈2 h** (lleva un token): para iniciar la
  reunión más tarde pide uno nuevo con `GET …/host-url`. **Meet**: igual a `joinUrl` (el anfitrión es
  la cuenta organizadora configurada en el servidor).
- `password`: contraseña de Zoom (ya va dentro de `joinUrl`); `null` en Meet.
- `externalId`: guárdalo en el estado del formulario para cancelar o pedir el enlace de anfitrión.

## Flujo paso a paso

1. **Al abrir el formulario** (crear/editar sesión, evento del calendario o "Agendar entrevista"):
   `GET /admin/meetings/providers` (puedes cachearlo durante la sesión del panel).
   - Ningún proveedor con `enabled: true` → no muestres el botón; el usuario pega el enlace a mano
     (como hasta ahora).
   - Uno → botón "Generar enlace de Zoom" / "Generar enlace de Google Meet".
   - Ambos → botón con menú para elegir proveedor.
   - **Entrevista (HU-31)**: muestra solo proveedores con `usableForInterviews: true` (Zoom). La API
     de entrevistas rechaza enlaces que no sean de zoom.us.
2. **"Generar enlace"**: con la fecha/hora y duración del formulario (y un título, p. ej. "«Oferta» —
   Sesión 3" o "Entrevista — «Nombre»"), llama `POST /admin/meetings`.
   - Estado de carga en el botón ("Generando…"); la llamada puede tardar unos segundos.
   - `201` → rellena los campos del formulario: `joinUrl` (sesión, evento o entrevista) y `hostUrl`
     (solo sesión en vivo). Muestra "Enlace generado" con opción de copiar.
   - Guarda `{ provider, externalId }` en el estado del formulario.
3. **Guardar el formulario** con su endpoint de siempre:
   - Sesión: `POST /admin/offers/{id}/sessions` o `PATCH /admin/sessions/{id}` (`joinUrl`, `hostUrl`).
   - Evento del calendario: `POST /admin/calendar-events` o `PATCH /admin/calendar-events/{id}` (`joinUrl`).
   - Entrevista: `POST /admin/applications/{id}/interview` (`startsAt`, `endsAt`, `joinUrl`).
4. **Si el usuario descarta** el formulario, vuelve a generar el enlace o falla el guardado de forma
   definitiva → `DELETE /admin/meetings/{provider}/{externalId}` para no dejar reuniones huérfanas en
   Zoom/Google (204 aunque ya no exista). Si cambia la fecha después de generar, lo más simple es
   cancelar y generar de nuevo.
5. **"Iniciar como anfitrión"** (detalle de la sesión, Zoom): si conoces el `externalId`, llama `GET
   /admin/meetings/ZOOM/{externalId}/host-url` justo antes de abrir el enlace (el `hostUrl` guardado en
   la sesión puede haber caducado). Si responde 404, la reunión ya no existe en Zoom: genera otra.

> El `externalId` no se guarda en la sesión ni en la entrevista (sus endpoints no cambian). Si quieres
> poder renovar el `hostUrl` días después, extrae el id del `joinUrl` de Zoom
> (`https://…zoom.us/j/{id}?pwd=…` → `{id}`).

## Estados de UI ↔ respuestas

| Respuesta | UI |
|---|---|
| `201` | Rellenar campos, aviso "Enlace generado" |
| `400 VALIDATION_ERROR` | Errores por campo (`details[].field`: `provider`, `topic`, `startAt`, `durationMinutes`, `timezone`). `MUST_BE_FUTURE` → "La reunión debe empezar en el futuro" |
| `403 FORBIDDEN` | Ocultar el botón (sin `meetings.create`) |
| `404 NOT_FOUND` | (`host-url`) "La reunión ya no existe": ofrecer generar otra |
| `502 MEETING_PROVIDER_ERROR` | "No pudimos comunicarnos con Zoom/Google. Intenta de nuevo." + botón Reintentar; el campo sigue editable para pegar el enlace a mano |
| `503 MEETING_PROVIDER_NOT_CONFIGURED` | El proveedor dejó de estar configurado: refrescar `GET /admin/meetings/providers` y ocultar esa opción |

## Tabla enum → texto

| `provider` | Texto |
|---|---|
| `ZOOM` | Zoom |
| `GOOGLE_MEET` | Google Meet |

(`label` en `GET /admin/meetings/providers` ya trae el texto.)

## Auditoría

Cada alta y cancelación queda en `GET /admin/audit-logs` con `action` `meeting.create` /
`meeting.cancel`, `entityType = Meeting` y `entityId = "ZOOM:85746065432"` (el enlace de anfitrión
nunca se guarda en la auditoría).
