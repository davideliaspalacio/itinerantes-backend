# Fase 08 — Dashboard del inicio del panel

Dos endpoints de solo lectura para la página de inicio del admin (`/`). Cualquier integrante del
equipo puede llamarlos (`admin.access`); cada bloque viene en `null` si su rol no tiene el permiso,
así la misma pantalla sirve para todos los roles: **si un bloque es `null`, no se pinta**.

## `GET /admin/dashboard?from=&to=`

`from` / `to` son ISO 8601 y opcionales (por defecto, los últimos 30 días). Solo afectan a las
cifras "InPeriod" y a los montos cobrados; los estados y `tasks` son la foto actual.

| Bloque | Permiso | Contenido |
|---|---|---|
| `people` | cualquiera del equipo | `total`, `active`, `pendingVerification`, `disabled`, `newInPeriod`, `topCountries` (5) — solo participantes, sin el equipo |
| `training` | `offers.read` | `publishedOffers`, `offersInProgress`, `enrollments` por estado, `newEnrollmentsInPeriod`, `bySource`, `upcomingSessions7d`, `topOffers` (5, con `enrolled` y `capacity`) |
| `applications` | `applications.read` | `byStatus` (sin DRAFT, incluye 0), `byKind`, `toReview`, `interviewsScheduled`, `approvedPending`, `submittedInPeriod` |
| `payments` | `payments.read` | `currencies` (MXN y USD por separado: `collected`, `refunded`, `net`, `paymentCount` del periodo), `pendingTransfers`, `plans.pastDue`, `plans.delinquent`, `pendingRefunds` |
| `contact` | `contact.read` | `unread` |
| `tasks` | según permisos | Lista de pendientes con `count > 0`: `{ key, label, count }` |

Claves de `tasks` → a dónde llevar al hacer clic:

| `key` | Pantalla sugerida |
|---|---|
| `APPLICATIONS_TO_REVIEW` | `/postulaciones` (estado SUBMITTED / IN_REVIEW) |
| `INTERVIEWS_SCHEDULED` | `/postulaciones` (INTERVIEW_SCHEDULED) |
| `APPROVED_PENDING` | `/seguimiento` |
| `TRANSFERS_TO_VALIDATE` | `/pagos` (transferencias) |
| `PLANS_DELINQUENT` | `/pagos` (planes) |
| `REFUNDS_PENDING` | `/pagos` (reembolsos) |
| `CONTACT_UNREAD` | bandeja de Contacto |
| `SESSIONS_NEXT_7_DAYS` | `/calendario` |

Los montos vienen en centavos (`amountCents`) con su `currency`; nunca sumes MXN con USD.

## `GET /admin/dashboard/trends?months=6`

`months` entre 1 y 24 (por defecto 6), incluido el mes actual, cortados con la hora de Ciudad de
México. Del más antiguo al actual:

```json
{ "months": [
  { "month": "2026-10", "newParticipants": 12, "newEnrollments": 9,
    "submittedApplications": 5, "netMxnCents": 4500000, "netUsdCents": 25000 }
] }
```

`newEnrollments` (`offers.read`), `submittedApplications` (`applications.read`) y `netMxnCents` /
`netUsdCents` (`payments.read`) vienen en `null` sin el permiso.

## Errores

- 400 `VALIDATION_ERROR`: fecha mal formada, `from` posterior a `to`, `months` fuera de 1–24.
- 401 sin sesión; 403 para cuentas sin rol del equipo.
