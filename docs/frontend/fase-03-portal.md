# Fase 03 — Portal del participante

Guía para implementar en el frontend **HU-06** (Dashboard), **HU-07** (Mi formación), **HU-08**
(Materiales), **HU-09** (Biblioteca), **HU-10** (Calendario), **HU-12** (Sesiones en vivo), **HU-13**
(Notificaciones), **HU-17** (Aula) y **HU-18** (Registro de asistencia), más la acción `ENROLL_FREE`
de la ficha (inscripción a ofertas gratuitas).

- Convenciones generales (errores, fechas, paginación): [`README.md`](README.md)
- Códigos de error: [`errores.md`](errores.md#fase-03--portal-del-participante)
- Contrato exacto: [`openapi/openapi.json`](../../openapi/openapi.json) o `http://localhost:3000/docs`
  (tags **Dashboard**, **Mi formación**, **Aula**, **Sesiones en vivo y asistencia**, **Calendario**,
  **Biblioteca**, **Notificaciones**)

Todas las rutas llevan el prefijo `/api/v1` y **requieren sesión** (`Authorization: Bearer`). Sin
token → `401 UNAUTHORIZED` (refresca y reintenta; ver Fase 01). Fechas en **UTC ISO 8601**.

## Resumen de endpoints

| Método y ruta | HU | Uso |
|---|---|---|
| `GET /me/dashboard` | 06 | Próxima actividad, formación activa, widgets y contador |
| `GET /me/enrollments?type=&phase=` | 07 | Mi formación (tarjetas con progreso y próxima sesión) |
| `POST /me/enrollments { offerId }` | 16 | [Inscribirme] en oferta gratuita (`ENROLL_FREE`) |
| `GET /me/classrooms/{offerId}` | 17 | Aula: encabezado, progreso, WhatsApp, próxima sesión, módulos, proyecto final |
| `GET /me/classrooms/{offerId}/materials` | 08 | Materiales por módulo (4 grupos fijos) |
| `GET /me/classrooms/{offerId}/resources/{resourceId}/access` | 08 | URL temporal de un archivo / enlace externo |
| `GET /me/classrooms/{offerId}/sessions?scope=` | 17 | Sesiones del aula (pasadas / próximas; incluye presenciales) |
| `POST /me/classrooms/{offerId}/final-project/upload-url` | 17 | Proyecto final: pedir URL de carga |
| `PUT /me/classrooms/{offerId}/final-project { key }` | 17 | Proyecto final: confirmar entrega |
| `GET /me/classrooms/{offerId}/final-project/download` | 17 | Proyecto final: descargar mi entrega |
| `GET /me/sessions?scope=&offerId=` | 12 | Próximas sesiones / historial (en línea) |
| `GET /me/sessions/{sessionId}` | 12, 18 | Detalle (ruta `/asistencia/[sesión]`) |
| `POST /me/sessions/{sessionId}/attendance` | 18 | Registrar asistencia |
| `GET /me/calendar?from=&to=&categories=` | 10 | Calendario del rango |
| `GET /library?type=&q=` | 09 | Biblioteca |
| `GET /library/{id}/access` | 09 | Abrir un recurso de la biblioteca |
| `GET /me/notifications?unread=&category=` | 13 | Panel de la campana / historial |
| `GET /me/notifications/unread-count` | 13 | Contador de la campana |
| `POST /me/notifications/{id}/read` | 13 | Marcar leída |
| `POST /me/notifications/read-all` | 13 | Marcar todas como leídas |

`{offerId}` es el `id` de la oferta (`offer.id` en las tarjetas de Mi formación, `id` del catálogo y
la ficha de Fase 02).

## Convención de acceso (no inscrito, suspendido, inexistente)

Aula, materiales, sesiones, asistencia y proyecto final exigen una inscripción con acceso
(`ACTIVE` o `COMPLETED`). Respuestas:

| Situación | Respuesta | UI |
|---|---|---|
| Oferta publicada, sin inscripción (o pendiente de pago) | `403 ENROLLMENT_REQUIRED`, `meta: { offerSlug, enrollmentStatus }` | "No autorizado" + botón a la ficha `/escuela/oferta/{offerSlug}` (HU-17). Nunca se exponen enlaces. |
| Inscripción suspendida por mora | `403 ENROLLMENT_SUSPENDED`, `meta: { offerSlug }` | Aviso para regularizar el pago (Mis pagos llega en Fase 05) |
| Oferta inexistente, borrador sin inscripción, id mal formado | `404 NOT_FOUND` | "Esta formación no existe" |
| Recurso oculto / programado / de otra oferta | `404 NOT_FOUND` | No se revela que existe |

Una formación **finalizada** sigue accesible (consulta de recursos y grabaciones, Anexo A HU-17).

---

## HU-06 — Dashboard `GET /me/dashboard`

```json
{
  "nextActivity": { "source": "SESSION", "title": "Diplomado en Ecotecnologías del Agua", "startsAt": "…", "endsAt": "…",
                    "category": "TRAINING", "module": { "number": 1, "title": "…" },
                    "join": { "state": "NOT_YET", "opensAt": "…", "url": null }, "link": { "kind": "CLASSROOM", "offerId": "…" } },
  "formations": { "items": [ /* FormationCard (máx. 3) */ ], "total": 4 },
  "upcomingEvents": [ /* CalendarItem (30 días, máx. 5) */ ],
  "recommendedResources": [ /* LibraryItem (máx. 4) */ ],
  "notifications": { "unread": 3, "pinned": 0 },
  "failedBlocks": []
}
```

- **Orden en pantalla**: (aviso de cuota, Fase 05) → "Próxima actividad" → "Mi formación" → widgets.
- **Próxima actividad** = `nextActivity` (sesión o evento, en curso o futuro, sin fechas importantes;
  formato `CalendarItem`). Muestra "11:00 tu hora · 10:00 hora CDMX" y el botón de acceso según `join`
  (ver HU-12). `null` → mensaje orientador.
- **Mi formación**: `formations.items` con % y [Continuar]; si `total > items.length` → "Ver toda mi
  formación" (HU-07).
- **Bloques independientes** (HU-06 criterio 5): si un bloque falla llega `null` y su nombre en
  `failedBlocks` (`nextActivity`, `formations`, `upcomingEvents`, `recommendedResources`,
  `notifications`). Muestra "No se pudo cargar esta información" + [Reintentar] solo en ese bloque.
  El reintento puede llamar al endpoint del bloque (`/me/enrollments`, `/me/calendar`, `/library`,
  `/me/notifications/unread-count`) o volver a pedir el dashboard.
- **Widgets Becas / Convocatorias**: bloques `scholarships` y `openCalls` desde la Fase 04 (ver
  [`fase-04-postulaciones.md`](fase-04-postulaciones.md#dashboard-hu-06)). El **aviso de cuota** llega en
  la Fase 05.

---

## HU-07 — Mi formación `GET /me/enrollments`

| Query | Valores | Uso |
|---|---|---|
| `type` | `DIPLOMA`, `COURSE`, `WORKSHOP` (también `EVENT`, `OPEN_CALL`; varios con coma) | Sub-ítems Diplomados / Cursos / Talleres del menú "Formación" |
| `phase` | `ACTIVE`, `COMPLETED`, `ALL` (defecto) | Pestañas Activos / Completados / Todos |
| `page`, `pageSize` | | Paginación estándar |

Tarjeta (`FormationCardDto`):

```json
{
  "enrollmentId": "…", "status": "ACTIVE", "phase": "ACTIVE", "origin": "NAS", "canContinue": true,
  "offer": { "id": "…", "slug": "diplomado-en-ecotecnologias-del-agua", "name": "…", "type": "DIPLOMA",
             "modality": "ONLINE_LIVE", "coverImageUrl": "…", "cohortLabel": "Generación 2026–2027",
             "startsAt": "…", "endsAt": "…", "venue": null },
  "progress": { "attendedSessions": 4, "scheduledSessions": 20, "percent": 20 },
  "nextSession": { "id": "…", "startsAt": "2026-11-07T16:00:00.000Z", "endsAt": "…" },
  "scheduleStatus": "HAS_NEXT_SESSION",
  "enrolledAt": "…"
}
```

- **% de progreso** = sesiones con asistencia ÷ sesiones programadas (sin canceladas).
- **Próxima sesión**: "11:00 tu hora · 10:00 hora CDMX" con `nextSession.startsAt`. Talleres
  (`modality = IN_PERSON`): hora local del lugar + `offer.venue`. Sin próxima sesión según
  `scheduleStatus`: `FINISHED` → "Finalizado", `NO_UPCOMING_SESSIONS` → "Sin sesiones próximas".
- **"Vía Moodle"**: badge discreto si `origin = MOODLE`. [Continuar] funciona igual.
- **[Continuar]** solo si `canContinue` (`false` = suspendida) → Aula `/aula/{offer.id}`.
- **Vacío** (`data: []`): "Aún no tienes [diplomados/cursos/talleres]" + botón a
  `/escuela/oferta?type=DIPLOMA` (o `COURSE`, `WORKSHOP`).
- "¿No ves tu formación?" (código Moodle, HU-25) llega en la Fase 05.
- Orden: activas por próxima sesión; completadas por fecha de fin (más reciente primero).

## Inscripción gratuita — `POST /me/enrollments { "offerId": "…" }`

Es el destino del botón `ENROLL_FREE` ([Inscribirme]) de la ficha (Fase 02): ofertas NAS **gratuitas**
que no son convocatoria (p. ej. un evento). Responde `201` con la tarjeta de Mi formación y envía
notificación + correo "Inscripción confirmada" (y el aviso del grupo de WhatsApp si ya está visible).
Después, la ficha devuelve `GO_TO_CLASSROOM`.

| Error | HTTP | `meta` | UI |
|---|---|---|---|
| `ENROLLMENT_ALREADY_EXISTS` | 409 | `enrollmentStatus` | "Ya estás inscrito · Ir a mi aula" |
| `OFFER_SOLD_OUT` | 409 | — | "Cupo agotado" |
| `ENROLLMENT_CLOSED` | 422 | `reason` (`ENROLLMENT_NOT_OPEN_YET` / `ENROLLMENT_CLOSED` / `OFFER_FINISHED`), `availableFrom` | Mismos textos que `actions[].reason` de la ficha |
| `ENROLLMENT_NOT_FREE` | 422 | `requiredAction` (`ENROLL_AND_PAY`, `APPLY_OPEN_CALL`, `ACTIVATE_MOODLE_ACCESS`) | Usa ese flujo (Fases 04/05) |
| `OFFER_NOT_AVAILABLE` | 404 | — | "Esta oferta ya no está disponible" |

---

## HU-17 — Aula `GET /me/classrooms/{offerId}`

| Bloque | Campo | Cómo pintarlo |
|---|---|---|
| Encabezado | `offer` (portada, nombre, `teachers[]`, `slug` → "Ver ficha"), `enrollment.origin` ("Vía Moodle") | |
| Progreso | `progress.percent` | Barra; distinto del "% de asistencia" del panel |
| "Antes de empezar" | `welcome.preStart`, `welcome.message`, `welcome.firstSessionStartsAt` | Destacado mientras `preStart = true`; después, bloque secundario "Grupo de WhatsApp" |
| WhatsApp | `welcome.whatsapp` | `available` → [Unirme al grupo de WhatsApp] (`url`, pestaña nueva). `availableFrom` → "Disponible a partir del …". Ambos null → sin grupo aún |
| Próxima sesión | `nextSession` (`SessionCard`) | [Entrar a sesión] según `join` (HU-12); presencial: `venue` + "Cómo llegar" (`venue.mapsUrl`) |
| Módulos | `modules[]` (`number`, `title`, `status`, `teacherNames`, `resourceCounts`) | Acordeón; [Ver recursos] → materiales |
| Sesiones pasadas | `GET …/sessions?scope=PAST` | Tabla: fecha, módulo, grabación, asistencia (+ [Registrar asistencia] si `attendance.canRegister`) |
| Proyecto final | `finalProject` (solo diplomados; `null` en cursos/talleres → no mostrar la sección) | Fecha (`dueAt`), lineamientos y entrega |

Layout (HU-17): desktop izquierda módulos + sesiones pasadas; derecha WhatsApp, próxima sesión y
proyecto final. Mobile: WhatsApp y próxima sesión primero. Materiales y sesiones tienen endpoint propio
para que cada bloque pueda fallar y reintentarse por separado.

`status` de módulo: `UPCOMING` Próximo · `IN_PROGRESS` En curso · `COMPLETED` Completado.

### Proyecto final (carga opcional, Anexo A)

`finalProject.submissionState`: `DISABLED` (solo presentación en vivo: muestra fecha y lineamientos,
sin carga), `OPEN` (subir/reemplazar), `CLOSED` (pasó la fecha: solo lectura). Archivo: PDF, DOCX, PPTX
o ZIP, máx. 20 MB (`acceptedMimeTypes`, `maxBytes`).

```ts
// 1) Pedir URL
const { data } = await api.POST('/api/v1/me/classrooms/{offerId}/final-project/upload-url', {
  params: { path: { offerId } },
  body: { fileName: file.name, contentType: file.type, sizeBytes: file.size },
});
// 2) Subir directo a storage (con progreso si usas XHR)
await fetch(data.uploadUrl, { method: 'PUT', headers: data.headers, body: file });
// 3) Confirmar
await api.PUT('/api/v1/me/classrooms/{offerId}/final-project', {
  params: { path: { offerId } }, body: { key: data.key, fileName: file.name },
});
```

Errores: `FINAL_PROJECT_INVALID_FILE` (tipo/tamaño), `FINAL_PROJECT_UPLOAD_NOT_FOUND` (el PUT no
llegó: vuelve a subir), `FINAL_PROJECT_DEADLINE_PASSED` (`meta.dueAt`), `FINAL_PROJECT_NOT_AVAILABLE`.
"Descargar mi entrega" → `GET …/final-project/download` (URL temporal).

---

## HU-08 — Materiales `GET /me/classrooms/{offerId}/materials`

Cada módulo trae sus **cuatro grupos fijos, en este orden**:

1. `presentation` (uno o `null`) — Presentación del módulo
2. `preReadings[]` — Lecturas previas
3. `activities[]` — Actividades (con `activityDueAt`; también salen en el calendario como "Fecha importante")
4. `recordings[]` — Grabación de la sesión, una por sesión del módulo (con fecha)

Subtítulo de grupo con el número de recursos; grupo vacío → "Sin recursos por ahora". Solo aparecen
módulos y recursos **publicados** (ocultos o programados a futuro nunca llegan).

Recurso (`MaterialResourceDto`): `kind = FILE` → [Descargar] pide la URL con
`GET …/resources/{id}/access` (URL firmada, `expiresAt` ≈ 10 min; si vence o falla al abrir, vuelve a
pedirla: "el enlace expiró, genera uno nuevo"). `kind = EXTERNAL_LINK` → [Ver] abre `url` en pestaña
nueva. Ícono por `type` / `mimeType`.

Grabación (`recordings[].state`, igual en sesiones):

| `state` | UI |
|---|---|
| `AVAILABLE` | [Ver grabación] (`url`, pestaña nueva) |
| `AFTER_SESSION` | "Disponible después de la sesión" |
| `PENDING` | "Grabación pendiente" |
| `NOT_APPLICABLE` | Sin grabación (cancelada o presencial) |

---

## HU-12 — Sesiones en vivo `GET /me/sessions`

- `scope=UPCOMING` (defecto): próximas y la que está en curso, de la más cercana a la más lejana.
- `scope=PAST`: historial, de la más reciente a la más antigua.
- Solo formaciones **en línea** con inscripción activa (los talleres presenciales se ven en Calendario
  y Aula). Con `offerId` lista todas las de esa oferta.

`SessionCard` (también en Aula, Dashboard y detalle):

```json
{
  "id": "…", "offer": { "id": "…", "slug": "…", "name": "…", "type": "DIPLOMA", "modality": "ONLINE_LIVE" },
  "module": { "id": "…", "number": 3, "title": "Humedales construidos" }, "teacherNames": ["Ana Solís Ríos"],
  "startsAt": "2026-11-14T16:00:00.000Z", "endsAt": "2026-11-14T19:00:00.000Z", "timezone": "America/Mexico_City",
  "status": "SCHEDULED", "category": "TRAINING", "originalStartsAt": null, "changeReason": null,
  "platform": "ZOOM", "venue": null,
  "join": { "state": "NOT_YET", "opensAt": "2026-11-14T15:50:00.000Z", "url": null },
  "recording": { "state": "AFTER_SESSION", "url": null },
  "attendance": { "status": "PENDING", "windowState": "NOT_OPEN_YET", "opensAt": "…", "closesAt": "…",
                  "windowHours": 24, "canRegister": false, "registeredAt": null, "source": null, "comment": null }
}
```

### Botón [Entrar a sesión] (`join.state`)

| `state` | UI |
|---|---|
| `NOT_YET` | Deshabilitado: "Disponible 10 min antes" o cuenta regresiva hasta `join.opensAt`. Al llegar, vuelve a pedir la sesión (`GET /me/sessions/{id}`) para obtener la `url`. |
| `OPEN` | Habilitado → abre `join.url` (join_url de Zoom/Meet). |
| `LINK_PENDING` | "Enlace aún no disponible" (deshabilitado). |
| `CANCELLED` | "Cancelada" (+ `changeReason`), sin acceso. |
| `ENDED` | Sesión terminada: pasa al historial. |
| `IN_PERSON` | Presencial: sin enlace; muestra `venue`. |

El backend **solo** entrega el join_url y **solo** con `state = OPEN`; nunca el enlace de anfitrión.
`platform` (`ZOOM` / `GOOGLE_MEET` / `OTHER`) sirve para el ícono. Reprogramada: `originalStartsAt` ≠ null.

---

## HU-18 — Registro de asistencia

Desde el historial (HU-12), el Aula (HU-17) o la notificación/correo, que enlaza a
`/asistencia/{sessionId}`: esa página llama `GET /me/sessions/{sessionId}` (oferta, módulo,
docente, hora CDMX y local) y pinta según `attendance`:

| `attendance` | UI |
|---|---|
| `windowState = NOT_OPEN_YET` | Botón inactivo: "El registro se abre al terminar la sesión" (`opensAt`) |
| `canRegister = true` | Formulario: checkbox "Asistí a la sesión" (obligatorio), comentario "¿Qué te llevas de esta sesión?" (opcional, máx. 500, con contador) y cuenta regresiva "Cierra en 21 h 35 min" hasta `closesAt` ("Puedes registrar hasta el lun 16 nov, 13:00 hora CDMX (14:00 tu hora)") |
| `status = REGISTERED` | "Asistencia registrada el {registeredAt}" sin formulario (`source = MANUAL`: la marcó el equipo, p. ej. pase de lista en sitio) |
| `status = NOT_REGISTERED` | "El registro de asistencia para esta sesión está cerrado" → pedir corrección al equipo |
| `status = NOT_APPLICABLE` | Sesión cancelada: sin registro |

`POST /me/sessions/{sessionId}/attendance { "attended": true, "comment": "…" }` → `201`
`{ session, progress }`: actualiza la sesión en historial/Aula y la barra de progreso **sin recargar**.
Deshabilita el botón mientras envías (evita el doble envío) y conserva el comentario si falla.

| Error | HTTP | UI |
|---|---|---|
| `VALIDATION_ERROR` | 400 | `attended` no es `true` (`details[].field = "attended"`, `code = "EQUALS"`) o comentario > 500 (`MAX_LENGTH`) |
| `ATTENDANCE_ALREADY_REGISTERED` | 409 | Muestra "Asistencia registrada el {meta.registeredAt}" |
| `ATTENDANCE_WINDOW_CLOSED` | 422 | "El registro … está cerrado" (`meta.closesAt`) |
| `ATTENDANCE_NOT_OPEN_YET` | 422 | "Se abre al terminar la sesión" (`meta.opensAt`) |
| `SESSION_CANCELLED` | 422 | "Sesión cancelada" |
| `ENROLLMENT_REQUIRED` | 403 | Acceso denegado; sin sesión iniciada, primero login con `returnTo` |

La ventana es de 24 h por defecto y puede cambiar por oferta o sesión: usa siempre `opensAt` / `closesAt`.

---

## HU-10 — Calendario `GET /me/calendar?from=&to=`

- `from` / `to`: instantes ISO 8601 del rango visible (fin exclusivo), **máximo 62 días** (un mes con
  semanas de relleno). Calcula los bordes en la zona del usuario y envíalos en UTC:
  `from = inicio del primer día visible`, `to = inicio del día siguiente al último visible`.
- `categories` opcional; los chips pueden filtrar en cliente sin recargar (todas activas por defecto,
  recordar la selección en la sesión).
- Error de rango → `400 VALIDATION_ERROR` con `details[].code = INVALID_RANGE | RANGE_TOO_LARGE`.

`CalendarItem`:

| Campo | Uso |
|---|---|
| `source` | `SESSION` (clase generada desde el horario, no editable), `EVENT` (webinar, encuentro o fecha importante), `ACTIVITY` (fecha de una actividad de módulo) |
| `kind` | `SESSION`, `ACTIVITY_DUE`, `MANUAL`, `ENROLLMENT_OPENS`, `ENROLLMENT_CLOSES`, `OFFER_STARTS`, `SCHOLARSHIP_DEADLINE`, `FINAL_PROJECT` |
| `category` | Color + etiqueta/ícono (no solo color) |
| `startsAt`, `endsAt`, `allDay` | Detalle: "11:00 tu hora · 10:00 hora CDMX"; `allDay` → evento de día completo |
| `status` | `CANCELLED` → visible como "Cancelada", sin enlace |
| `offer`, `module`, `venue`, `location` | Modalidad y lugar (presencial: hora local, sin enlace) |
| `join` | Acceso (mismas reglas que HU-12); `null` en fechas importantes |
| `link` | `CLASSROOM` → Aula (`offerId`); `OFFER` → ficha `/escuela/oferta/{slug}`; `NONE` |

Audiencias (ya filtradas por el backend): sesiones solo de mis formaciones; eventos "para todos los
registrados" o "solo inscritos" de mis ofertas; fechas importantes de ofertas publicadas. Mes sin
eventos → cuadrícula vacía, sin error. Desde la Fase 04 las entrevistas de postulación llegan como
fechas importantes (`source = APPLICATION`, `kind = INTERVIEW`, `link.kind = APPLICATION`).

---

## HU-09 — Biblioteca `GET /library`

| Query | Uso |
|---|---|
| `type` | Chips: `PDF`, `ARTICLE`, `BOOK`, `VIDEO`, `AUDIO`, `EXTERNAL`, `COURSE_MATERIAL` (varios con coma) |
| `q` | Buscador (título, autor o palabra clave; sin acentos). Aplica debounce (~300 ms) |
| `page`, `pageSize` | Grid de 2 a 4 columnas |

Ítem: `title`, `type`, `thumbnailUrl` (miniatura), `author`, `audience` (`OFFER_ENROLLED` = exclusivo
de un curso; solo llega si estás inscrito), `offer`, `featured`. Para abrir: `GET /library/{id}/access`
→ `FILE` (URL firmada temporal) o `EXTERNAL_LINK` (abrir en **pestaña nueva** con
`rel="noopener"` para no perder la sesión). `data: []` → "No encontramos recursos con este filtro" +
[Limpiar filtros].

---

## HU-13 — Notificaciones

- **Campana**: `GET /me/notifications/unread-count` → `{ unread, pinned }` (al navegar y cada ~60 s).
- **Panel / historial**: `GET /me/notifications` (paginado). Orden: **fijadas primero** (`pinned`:
  prioridad alta sin regularizar, p. ej. cobro fallido o mora) y luego de la más reciente a la más
  antigua. Filtros `unread=true`, `category`.
- Notificación: `title`, `body`, `category` (ícono), `priority`, `pinned`, `read`, `action`
  (`{ label, path }` → botón; `path` es una ruta relativa del frontend) y `data` (ids relacionados).
- Al abrir una: `POST /me/notifications/{id}/read` (idempotente). "Marcar todas como leídas":
  `POST /me/notifications/read-all` → `{ updated }`. Las fijadas siguen fijadas hasta regularizarse.
- Vacío → "No tienes notificaciones".

Rutas que usan `action.path` y los botones de los correos (`PORTAL_URL + path`). Si el frontend usa
otras rutas, se cambian en `src/modules/notifications/portal-links.ts`:

| Ruta | Pantalla |
|---|---|
| `/` | Dashboard |
| `/aula/{offerId}` | Aula |
| `/aula/{offerId}/materiales#modulo-{moduleId}` | Materiales |
| `/asistencia/{sessionId}` | Registro de asistencia |
| `/sesiones` · `/calendario` · `/biblioteca` · `/notificaciones` | |
| `/escuela/oferta/{slug}` | Ficha pública |

Eventos que ya emite la Fase 03 (portal + correo):

| `type` | Cuándo | Acción |
|---|---|---|
| `ENROLLMENT_CONFIRMED` | Inscripción gratuita confirmada | Ir a mi aula |
| `ATTENDANCE_OPEN` | Al terminar una sesión (job cada 5 min): "el registro cierra en 24 h" | Registrar asistencia → `/asistencia/{sessionId}` |
| `WHATSAPP_GROUP_AVAILABLE` | Llega la fecha de visibilidad del grupo (o te inscribes después) | Unirme al grupo → Aula |

Las Fases 04–06 emitirán el resto de tipos (tabla abajo) con el mismo formato.

---

## Tablas enum → texto

### `EnrollmentStatus` / `phase` / `origin`

| Valor | Texto |
|---|---|
| `ACTIVE` | Activa |
| `COMPLETED` | Completada |
| `SUSPENDED` | Acceso suspendido |
| `PENDING_PAYMENT` | Pendiente de pago (Fase 05; no aparece en Mi formación) |
| `CANCELLED` | Cancelada (no aparece) |
| `phase = ACTIVE` / `COMPLETED` | Pestaña Activos / Completados |
| `origin = MOODLE` | Badge "Vía Moodle" |

### Asistencia (`attendance.status`)

| Valor | Texto |
|---|---|
| `PENDING` | Pendiente |
| `REGISTERED` | Registrada |
| `NOT_REGISTERED` | No registrada |
| `NOT_APPLICABLE` | — (sesión cancelada) |

### `CalendarCategory`

| Valor | Texto | Color |
|---|---|---|
| `TRAINING` | Formación | azul |
| `TERRITORY` | Territorio | verde |
| `COMMUNITY` | Comunidad | naranja |
| `EVENTS` | Eventos | morado |
| `IMPORTANT_DATES` | Fechas importantes | rojo |

### `kind` del calendario

| Valor | Texto |
|---|---|
| `SESSION` | Sesión |
| `ACTIVITY_DUE` | Entrega de actividad |
| `MANUAL` | Evento |
| `ENROLLMENT_OPENS` / `ENROLLMENT_CLOSES` | Apertura / cierre de inscripciones (convocatoria) |
| `OFFER_STARTS` | Inicio de clases |
| `SCHOLARSHIP_DEADLINE` | Cierre de convocatoria de becas |
| `FINAL_PROJECT` | Proyecto final |

### `LibraryResourceType`

| Valor | Texto |
|---|---|
| `PDF` | PDF |
| `ARTICLE` | Artículo |
| `BOOK` | Libro |
| `VIDEO` | Video |
| `AUDIO` | Audio |
| `EXTERNAL` | Recurso externo |
| `COURSE_MATERIAL` | Material de curso |

### `NotificationCategory`

| Valor | Texto (ícono) |
|---|---|
| `TRAINING` | Formación |
| `APPLICATIONS` | Postulaciones y becas |
| `PAYMENTS` | Pagos |
| `GENERAL` | General |

### `NotificationType`

| Valor | Grupo | Fase |
|---|---|---|
| `ENROLLMENT_CONFIRMED`, `ATTENDANCE_OPEN`, `WHATSAPP_GROUP_AVAILABLE` | Formación | 03 |
| `MATERIAL_PUBLISHED`, `RECORDING_PUBLISHED`, `SESSION_RESCHEDULED`, `SESSION_CANCELLED` | Formación | 06 |
| `MOODLE_ENROLLMENT_LINKED` | Formación | 05 |
| `APPLICATION_SUBMITTED`, `APPLICATION_STATUS_CHANGED`, `INTERVIEW_SCHEDULED`, `INTERVIEW_REMINDER`, `SCHOLARSHIP_APPROVED`, `APPLICATION_EXPIRED` | Postulaciones y becas | 04 |
| `PAYMENT_CONFIRMED`, `BALANCE_DUE_REMINDER`, `INSTALLMENT_UPCOMING`, `INSTALLMENT_PAID`, `INSTALLMENT_FAILED`*, `PLAN_DELINQUENT`*, `TRANSFER_VALIDATED`, `TRANSFER_REJECTED` | Pagos | 05 |
| `GENERAL` | General | — |

\* Prioridad alta: fijadas al inicio hasta regularizar.

### Módulo (`status`), acceso (`join.state`), grabación (`recording.state`)

Ver las tablas de HU-17, HU-12 y HU-08 arriba.

## Datos demo (seed, fuera de producción)

`participante@example.com` / `Demo12345` está inscrito en: Diplomado en Ecotecnologías del Agua
(WhatsApp visible desde el 31/10/2026, recursos en los módulos 1–2, proyecto final con carga),
Curso Humedales construidos, Curso Moodle ("Vía Moodle") y el curso finalizado de 2026 (sesiones
pasadas con grabación y 2 asistencias registradas → pestaña Completados). No está inscrito en la
masterclass gratuita: úsala para probar [Inscribirme]. Biblioteca con 7 recursos (uno exclusivo del
curso de humedales), eventos manuales (webinar, encuentro de comunidad, bienvenida del diplomado) y 2
notificaciones.
