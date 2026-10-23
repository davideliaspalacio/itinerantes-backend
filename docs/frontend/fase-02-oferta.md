# Fase 02 — Oferta formativa: catálogo, ficha y disponibilidad

Guía para implementar en el frontend **HU-15** (catálogo `/escuela/oferta`), **HU-16** (ficha
`/escuela/oferta/[slug]`) y los datos dinámicos de **HU-34** (página Itinerantes del Agua).

- Convenciones generales (errores, fechas, dinero, paginación): [`README.md`](README.md)
- Códigos de error: [`errores.md`](errores.md#fase-02--oferta-formativa)
- Contrato exacto: [`openapi/openapi.json`](../../openapi/openapi.json) o `http://localhost:3000/docs`
  (tag **Oferta formativa**)

Todas las rutas llevan el prefijo `/api/v1`. Fechas en **UTC ISO 8601**; dinero en **centavos**.

## Resumen de endpoints

| Método y ruta | Auth | HU | Uso |
|---|---|---|---|
| `GET /offers` | opcional | 15 | Catálogo con filtros, búsqueda y paginación |
| `GET /offers/{slug}` | opcional | 16 | Ficha completa + acciones (CTA) |
| `GET /offers/availability?topics=` | pública | 34 | Etiqueta y enlace de las 10 temáticas |

**Auth opcional**: son públicas, pero si envías `Authorization: Bearer <accessToken>` la respuesta se
personaliza (moneda del país del perfil, `enrolled`/"Inscrito", `requiresLogin: false`). Un token
ausente, vencido o inválido **no** da 401: se responde como visitante. Si tienes sesión, refresca el
token antes de llamar (o reintenta tras refrescar) para no perder la personalización.

## Moneda (HU-15 / HU-16 / Anexo A)

| Situación | Moneda | `pricing.currencySource` |
|---|---|---|
| Con sesión | País del perfil: México → MXN; resto → USD | `PROFILE` |
| Sin sesión, con zona | Zona del navegador: zona de México → MXN; resto → USD | `TIMEZONE` |
| Sin sesión ni zona | USD | `DEFAULT` |

Envía **siempre** la zona del navegador, por query `tz` o header `X-Timezone`:

```ts
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; // "America/Mexico_City"
api.GET('/api/v1/offers', { params: { query: { tz } } });
// o globalmente: headers: { 'X-Timezone': tz }
```

Montos: `new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(amountCents / 100)`
→ "$10,200.00" + " MXN". El cobro real (Fase 05) usa siempre el país del perfil.

---

## HU-15 — Catálogo `GET /offers`

### Query params (reflejarlos en la URL de la página para compartir/preaplicar)

| Param | Ejemplo | Notas |
|---|---|---|
| `type` | `DIPLOMA,COURSE` o `type=DIPLOMA&type=COURSE` | Chips de tipo (varios). |
| `modality` | `ONLINE_LIVE` / `IN_PERSON` | |
| `status` | `ENROLLMENT_OPEN,UPCOMING` | **Por defecto** abiertas + próximamente. Para ver todo: `ENROLLMENT_OPEN,UPCOMING,ENROLLMENT_CLOSED,FINISHED`. |
| `scholarship` | `true` | "Con beca disponible": solo diplomados NAS con beca. |
| `topic` | `CONSTRUCTED_WETLANDS` | Temática HU-34 (enlaces de la página Itinerantes del Agua). |
| `q` | `humedales` | Nombre de la oferta o docente; **mínimo 3 caracteres** (si no, 400 `VALIDATION_ERROR` con `details[0].field = "q"`, `code = "MIN_LENGTH"`). Ignora acentos y mayúsculas. No envíes `q` con < 3 caracteres. |
| `page`, `pageSize` | `1`, `20` | Máximo 100. |
| `tz` | `America/Bogota` | Moneda sin sesión. |

Todos los filtros se combinan (AND). El orden lo da el backend: abiertas y próximas por **inicio más
cercano**; después cerradas y al final finalizadas (muéstralas atenuadas).

Ejemplo de URL de la página → API:
`/escuela/oferta?type=DIPLOMA,COURSE&modality=ONLINE_LIVE&scholarship=true` →
`GET /api/v1/offers?type=DIPLOMA,COURSE&modality=ONLINE_LIVE&scholarship=true&tz=…`

Desde HU-07 (estado vacío de "Mi formación"): `/escuela/oferta?type=COURSE`.

### Tarjeta (`OfferSummaryDto`)

```json
{
  "slug": "diplomado-en-ecotecnologias-del-agua",
  "name": "Diplomado en Ecotecnologías del Agua",
  "type": "DIPLOMA", "modality": "ONLINE_LIVE", "origin": "NAS",
  "availability": "ENROLLMENT_OPEN", "openCallStatus": null,
  "coverImageUrl": "https://…", "summary": "…",
  "dates": { "enrollmentOpensAt": "…", "enrollmentClosesAt": "…", "startsAt": "2026-11-07T16:00:00.000Z", "endsAt": "…" },
  "schedule": {
    "timezone": "America/Mexico_City", "weekdays": [6, 7], "startTime": "10:00", "endTime": "13:00",
    "firstSession": { "startsAt": "2026-11-07T16:00:00.000Z", "endsAt": "2026-11-07T19:00:00.000Z" }
  },
  "totalHours": 60,
  "venue": null,
  "pricing": { "kind": "PAID", "currency": "MXN", "currencySource": "TIMEZONE",
               "price": { "amountCents": 1020000, "currency": "MXN" }, "installments": { "maxInstallments": 3 } },
  "scholarship": { "minPercent": 10, "maxPercent": 80 },
  "teacherNames": ["Ana Solís Ríos", "Tomás Ek Canché"],
  "enrolled": false
}
```

Cómo pintarla:

- **Badge de tipo**: `type` (tabla abajo). **Badge de estado**: `availability`; en convocatorias puedes
  usar `openCallStatus`.
- **Próximamente**: "Inscripciones abren el {fecha de `dates.enrollmentOpensAt`}" (si es null:
  "Próximamente", sin fecha).
- **Horario en línea** (dos líneas, HU-11): "Sáb y dom 10:00–13:00 hora CDMX" con `weekdays` +
  `startTime`/`endTime`, y la hora local formateando `schedule.firstSession.startsAt/endsAt` en la zona
  del visitante con `Intl` (p. ej. "11:00–14:00 tu hora"). **Presencial**: hora (CDMX) + `venue.name`,
  `venue.city`.
- **Costo** según `pricing.kind`: `PAID` → precio (`price`); si `price` es null, "Precio por
  confirmar". `FREE` → "Gratuito". `EXTERNAL_ENROLLMENT` (Moodle) → "Inscripción externa".
- **Beca**: si `scholarship` no es null, badge "Beca {minPercent}%–{maxPercent}%". Nunca aparece en
  cursos, talleres, eventos, convocatorias ni Moodle (el backend ya lo garantiza).
- **Inscrito** (`enrolled: true`, solo con sesión): badge "Inscrito" y la tarjeta enlaza al Aula
  (HU-17, Fase 03) en lugar de la ficha.

### Estados de la pantalla

| Estado | Respuesta |
|---|---|
| Loading | petición en curso |
| Empty | `data: []` → "No encontramos ofertas con estos filtros" + [Limpiar filtros] |
| Success | `data` con tarjetas |
| Error | 5xx/red → "No se pudo cargar la oferta formativa" + [Reintentar]; 400 → corrige el query (normalmente `q` < 3) |

---

## HU-16 — Ficha `GET /offers/{slug}`

Respuesta = la tarjeta + estos campos:

| Campo | Uso |
|---|---|
| `description`, `learningOutcomes[]` | Descripción y "¿Qué aprenderás?" (viñetas) |
| `requirements` | Requisitos (texto) |
| `carouselImageUrls[]` | Carrusel |
| `teachers[]` | `fullName`, `photoUrl`, `bio`, `cvUrl` ("Ver CV" si no es null) |
| `modules[]` | Temario publicado: `number`, `title`, `description` (acordeón) |
| `totalHours`, `sessionCount` | "9 módulos · 60 h + proyecto final" |
| `dates.finalProjectDueAt` | Proyecto final (diplomados) |
| `schedule` | Igual que en la tarjeta; tabla de conversión con `GET /timezones` (HU-11) |
| `venue` | Presencial: `name`, `address`, `city`, `mapsUrl` ("Cómo llegar") |
| `pricing.installments.maxInstallments` | "Hasta N cuotas sin recargo" |
| `scholarshipDetails` | Bloque de beca (ver abajo); `null` → no mostrar el bloque |
| `eligibility` | Convocatorias: `text`, `countries[]` (código y nombre), `requiresTravel` |
| `capacity` | `total` (cupo, null = sin cupo) y `soldOut` ("Cupo agotado") |
| `moodleCourseUrl` | Moodle: enlace informativo |
| `viewer` | `{ authenticated, enrolled }` |
| `actions[]` | Botones a mostrar (ver abajo) |

La ficha **nunca** trae el grupo de WhatsApp, enlaces de sesión (Zoom/Meet) ni grabaciones: viven en
el Aula (Fase 03) solo para inscritos.

### Bloque de beca (`scholarshipDetails`)

> **Becas parametrizables** (cambio incompatible, ver [README](README.md#cambio-incompatible-becas-parametrizables)):
> los tipos de beca ya no son una lista fija. Se administran desde el panel (`/admin/scholarship-types`)
> y cada oferta habilita los suyos, pudiendo ajustar el rango de % solo para esa oferta. Usa SIEMPRE
> `name`, `minPercent`, `maxPercent` y `requiresInterview` que llegan en la respuesta (nunca textos ni
> porcentajes fijos en el frontend). `levels[]` → `scholarshipTypes[]`; se eliminó
> `interviewRequiredAbovePercent` (cada tipo trae `requiresInterview`).

```json
{
  "minPercent": 10, "maxPercent": 80,
  "windowStatus": "OPEN", "opensAt": "2026-09-01T06:00:00.000Z", "closesAt": "2026-11-01T05:59:00.000Z",
  "scholarshipTypes": [
    { "scholarshipTypeId": "0b9a3c52-…",
      "scholarshipType": { "id": "0b9a3c52-…", "key": "AGUA_VIVA", "name": "Agua Viva",
                           "minPercent": 10, "maxPercent": 10, "requiresInterview": false },
      "description": null,
      "estimatedScholarship": { "minAmountCents": 102000, "maxAmountCents": 102000, "currency": "MXN" },
      "estimatedBalance": { "minAmountCents": 918000, "maxAmountCents": 918000, "currency": "MXN" } },
    { "scholarshipTypeId": "5e1f…",
      "scholarshipType": { "id": "5e1f…", "key": "SPECIAL", "name": "Beca especial",
                           "minPercent": 71, "maxPercent": 80, "requiresInterview": true },
      "description": null,
      "estimatedScholarship": { "minAmountCents": 724200, "maxAmountCents": 816000, "currency": "MXN" },
      "estimatedBalance": { "minAmountCents": 204000, "maxAmountCents": 295800, "currency": "MXN" } }
  ]
}
```

- `scholarshipTypes[]` trae solo los tipos **activos** de la oferta, ya ordenados. `minPercent` /
  `maxPercent` son el rango **efectivo en esta oferta** (puede diferir del rango general del tipo).
- Muestra cada tipo con su porcentaje (`minPercent`; si `min ≠ max`, rango "71–80%") y el monto
  estimado (rango si `min ≠ max`). Leyenda: "el tipo de beca final lo asigna el equipo".
- `requiresInterview: true` → aviso "Requiere entrevista por Zoom".
- El badge de la tarjeta (`scholarship` en el catálogo y `minPercent`/`maxPercent` aquí) es el rango
  global de los tipos activos de la oferta. Una oferta sin tipos activos no ofrece beca
  (`scholarship: null`, `scholarshipDetails: null`).
- Catálogo general de tipos vigentes (para filtros o textos informativos):
  `GET /api/v1/scholarship-types` (público, caché 5 min) →
  `{ data: [{ id, key, name, description, minPercent, maxPercent, requiresInterview, sortOrder }] }`.

### Acciones (`actions[]`) — CTA calculados por el backend

Pinta los botones **en el orden recibido**. El que tiene `primary: true` es el principal (máx. uno).

```json
[
  { "type": "ENROLL_AND_PAY", "enabled": true, "primary": true, "requiresLogin": true, "reason": null, "availableFrom": null },
  { "type": "PAY_IN_INSTALLMENTS", "enabled": true, "primary": false, "requiresLogin": true, "reason": null, "availableFrom": null },
  { "type": "APPLY_SCHOLARSHIP", "enabled": true, "primary": false, "requiresLogin": true, "reason": null, "availableFrom": null }
]
```

| `type` | Botón | Destino |
|---|---|---|
| `ENROLL_AND_PAY` | Inscribirme y pagar | Flujo HU-22 (Fase 05) |
| `PAY_IN_INSTALLMENTS` | Pagar en cuotas | Flujo HU-24 (Fase 05) |
| `ENROLL_FREE` | Inscribirme | Oferta NAS gratuita (p. ej. evento); Fase 03 |
| `APPLY_SCHOLARSHIP` | Postular a beca | HU-19 (Fase 04); va dentro del bloque de beca |
| `APPLY_OPEN_CALL` | Postular | HU-20 (Fase 04) |
| `ACTIVATE_MOODLE_ACCESS` | Ya estoy inscrito: activar mi acceso | HU-25 (Fase 05) |
| `GO_TO_CLASSROOM` | Ir a mi aula | HU-17 (Fase 03); muestra además "Ya estás inscrito" |

- `requiresLogin: true` (sin sesión): al pulsar, ve a login (HU-04) o registro (HU-02) con
  `returnTo=/escuela/oferta/{slug}?action={type}` y, al volver, continúa la acción.
- `enabled: false` → botón deshabilitado (o reemplázalo por el mensaje) según `reason`:

| `reason` | Mensaje sugerido |
|---|---|
| `ENROLLMENT_NOT_OPEN_YET` | "Inscripciones abren el {availableFrom}" (convocatoria: "La convocatoria abre el …") |
| `ENROLLMENT_CLOSED` | "Inscripciones cerradas" (convocatoria: "Convocatoria cerrada") |
| `OFFER_FINISHED` | "Esta oferta finalizó" |
| `SOLD_OUT` | "Cupo agotado" |
| `SCHOLARSHIP_NOT_OPEN_YET` | "La convocatoria de becas abre el {availableFrom}" |
| `SCHOLARSHIP_CLOSED` | "La convocatoria de becas está cerrada" |
| `PRICE_NOT_AVAILABLE` | "Precio no disponible en tu moneda. Escríbenos (Contacto)." |

Reglas que ya aplica el backend (no las repliques): inscrito → solo `GO_TO_CLASSROOM`; Moodle → solo
`ACTIVATE_MOODLE_ACCESS`; convocatoria → solo `APPLY_OPEN_CALL`; beca solo en diplomados NAS.
Fase 04 agregará el estado de una postulación en curso ("Pagar saldo", HU-23) en este mismo arreglo.

### Estados de la pantalla

| Estado | Cómo detectarlo |
|---|---|
| Default | `availability = ENROLLMENT_OPEN` y acciones habilitadas |
| Disabled | `availability = UPCOMING` ("Inscripciones abren el …") o `ENROLLMENT_CLOSED`/`FINISHED` (sin acciones habilitadas, con mensaje) |
| Enrolled | `viewer.enrolled = true` → "Ya estás inscrito" + [Ir a mi aula] |
| Error | `404 OFFER_NOT_AVAILABLE` → "Esta oferta ya no está disponible" + enlace al catálogo |

Vista previa al compartir (WhatsApp/redes): usa `name`, `summary` y `coverImageUrl` en las metaetiquetas
Open Graph de la ruta.

---

## HU-34 — Disponibilidad por temática `GET /offers/availability`

Devuelve los **10 ítems literales** de la página en su orden (puedes pedir algunos con
`?topics=A,B`). Los textos de la página siguen siendo estáticos del frontend; esto solo aporta la
etiqueta y el destino.

```json
{ "data": [
  { "topic": "ECOTECH_WATER_DIPLOMA", "group": "SPECIALIZED_TRAINING",
    "label": "Diplomado en Ecotecnologías del Agua", "availability": "ENROLLMENT_OPEN", "offerCount": 1,
    "link": { "kind": "OFFER", "slug": "diplomado-en-ecotecnologias-del-agua", "catalogQuery": null } },
  { "topic": "CONSTRUCTED_WETLANDS", "group": "ONLINE_COURSES_WORKSHOPS",
    "label": "Humedales construidos", "availability": "ENROLLMENT_OPEN", "offerCount": 2,
    "link": { "kind": "CATALOG", "slug": null,
              "catalogQuery": "topic=CONSTRUCTED_WETLANDS&status=ENROLLMENT_OPEN,UPCOMING,ENROLLMENT_CLOSED" } },
  { "topic": "FIELD_VISITS", "group": "HANDS_ON_LEARNING", "label": "Visitas y experiencias de campo",
    "availability": "NO_SCHEDULED_DATES", "offerCount": 0,
    "link": { "kind": "NONE", "slug": null, "catalogQuery": null } }
] }
```

| `link.kind` | Enlace del ítem |
|---|---|
| `OFFER` | `/escuela/oferta/{slug}` |
| `CATALOG` | `/escuela/oferta?{catalogQuery}` |
| `NONE` | sin enlace (etiqueta "Sin fechas programadas") |

Si la petición falla (HU-34 "Error"): muestra los ítems sin etiquetas y enlaza cada uno al catálogo
general `/escuela/oferta`.

---

## Tablas enum → texto

### `type` (OfferType)

| Valor | Texto | Filtro (plural) |
|---|---|---|
| `DIPLOMA` | Diplomado | Diplomados |
| `COURSE` | Curso | Cursos |
| `WORKSHOP` | Taller | Talleres |
| `EVENT` | Evento | Eventos |
| `OPEN_CALL` | Programa por convocatoria | Programas por convocatoria |

### `modality` / `origin`

| Valor | Texto |
|---|---|
| `ONLINE_LIVE` | En línea en vivo |
| `IN_PERSON` | Presencial |
| `NAS` | (sin etiqueta: inscripción y pago en la plataforma) |
| `MOODLE` | Vía Moodle ("Inscripción externa") |

### `availability` (estado derivado, HU-15/27)

| Valor | Texto |
|---|---|
| `ENROLLMENT_OPEN` | Inscripciones abiertas |
| `UPCOMING` | Próximamente |
| `ENROLLMENT_CLOSED` | Inscripciones cerradas |
| `FINISHED` | Finalizado |

Se deriva de las fechas: finaliza al pasar `endsAt`; "Próximamente" antes de `enrollmentOpensAt` (o
si no hay fechas); "cerradas" tras `enrollmentClosesAt` (o tras `startsAt` si no hay cierre). En
convocatorias, la ventana de inscripción es la de **postulación**.

### `openCallStatus` (solo convocatorias)

| Valor | Texto |
|---|---|
| `OPEN` | Convocatoria abierta |
| `UPCOMING` | Próximamente |
| `CLOSED` | Convocatoria cerrada |

### `pricing.kind`

| Valor | Texto |
|---|---|
| `PAID` | precio en la moneda (`price`) |
| `FREE` | Gratuito |
| `EXTERNAL_ENROLLMENT` | Inscripción externa |

### Tipos de beca (antes enum `ScholarshipLevel`)

Ya no hay enum: los tipos viven en la BD y el texto a mostrar es `scholarshipType.name`. `key` es una
clave estable (MAYÚSCULAS_CON_GUION_BAJO) por si necesitas un ícono o estilo por tipo. Tipos
iniciales (editables desde el panel):

| `key` | `name` | % inicial | Entrevista |
|---|---|---|---|
| `AGUA_VIVA` | Agua Viva | 10% | No |
| `RIOS_VIVOS` | Ríos Vivos | 25% | No |
| `AGUAS_LIBRES` | Aguas Libres | 50% | No |
| `CENOTES_VIVOS` | Cenotes Vivos | 70% | No |
| `SPECIAL` | Beca especial | 71–80% | Sí (Zoom) |

### `calendarCategory` (se usa desde Fase 03)

| Valor | Texto | Color |
|---|---|---|
| `TRAINING` | Formación | azul |
| `TERRITORY` | Territorio | verde |
| `COMMUNITY` | Comunidad | naranja |
| `EVENTS` | Eventos | morado |
| `IMPORTANT_DATES` | Fechas importantes | rojo |

### Temáticas HU-34 (`topic`, `group`)

| `group` | Texto del grupo |
|---|---|
| `SPECIALIZED_TRAINING` | Formación especializada |
| `ONLINE_COURSES_WORKSHOPS` | Cursos y talleres online |
| `HANDS_ON_LEARNING` | Aprendizaje práctico |

| `topic` | Texto literal |
|---|---|
| `ECOTECH_WATER_DIPLOMA` | Diplomado en Ecotecnologías del Agua |
| `ECOPEDAGOGIES_DIPLOMA` | Diplomado de Ecopedagogías |
| `WATER_APPRENTICES_SCHOOL` | Escuela de Aprendices del Agua |
| `WATER_TREATMENT_SYSTEMS_INTRO` | Introducción a los sistemas de tratamiento de aguas |
| `CONSTRUCTED_WETLANDS` | Humedales construidos |
| `DRY_TOILETS` | Baños secos |
| `WATER_HARVESTING` | Captación y cosecha de agua |
| `TRAVELING_WATER_LABS` | Laboratorios Itinerantes del agua |
| `TERRITORIAL_PRACTICES` | Prácticas territoriales |
| `FIELD_VISITS` | Visitas y experiencias de campo |

| `availability` (temática) | Texto |
|---|---|
| `ENROLLMENT_OPEN` | Inscripciones abiertas |
| `UPCOMING` | Próximamente |
| `ENROLLMENT_CLOSED` | Inscripciones cerradas |
| `OPEN_CALL` | Programa por convocatoria |
| `NO_SCHEDULED_DATES` | Sin fechas programadas |

### Días (`schedule.weekdays`, ISO)

`1` lun · `2` mar · `3` mié · `4` jue · `5` vie · `6` sáb · `7` dom → "Sáb y dom 10:00–13:00 hora CDMX".

## Imágenes

`coverImageUrl`, `carouselImageUrls[]` y `teachers[].photoUrl` son URLs listas para `<img>`. En
producción pueden ser URLs públicas (bucket público/CDN) o URLs firmadas que **vencen en 7 días**: no
las guardes en caché persistente; vuelve a pedir el catálogo/ficha. Los datos demo usan imágenes de
`placehold.co`.

## Datos demo (seed)

| slug | Tipo | Estado (a oct-2026) |
|---|---|---|
| `diplomado-en-ecotecnologias-del-agua` | Diplomado NAS, sáb y dom 10–13 CDMX, $10,200 MXN / $585 USD, hasta 3 cuotas, beca 10–80%, 9 módulos, 20 sesiones | Inscripciones abiertas |
| `curso-humedales-construidos` | Curso, jue 18–21 CDMX, 9 h | Inscripciones abiertas |
| `taller-biofiltro-aguas-jabonosas` | Taller presencial (Tepoztlán), cupo 20 | Próximamente (abre 01/11/2026) |
| `masterclass-banos-secos-en-la-ciudad` | Evento gratuito | Inscripciones abiertas |
| `aprendices-del-agua-2027` | Convocatoria presencial, gratuita | Convocatoria abierta |
| `siembra-de-agua-2027` | Convocatoria: mujeres lideresas de Centroamérica y México | Convocatoria abierta |
| `curso-captacion-y-cosecha-de-agua-moodle` | Curso de origen Moodle | Inscripción externa |
| `curso-introduccion-sistemas-de-tratamiento-2026` | Curso | Finalizado |
| `diplomado-de-ecopedagogias` | **Borrador** | nunca aparece (404) |
