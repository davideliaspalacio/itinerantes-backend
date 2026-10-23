# Roadmap del backend — Escuela Itinerante del Agua

Fuente de requerimientos: `docs/requirements/HU_EIA_Fases_1-3.md` (38 historias de usuario).
Convenciones técnicas obligatorias: `docs/ARCHITECTURE.md`.

El backend se construye por **fases incrementales**. Cada fase:

1. Agrega solo los modelos/migraciones Prisma que necesita (el esquema crece por fase).
2. Deja endpoints REST documentados en OpenAPI (Scalar en `/docs`).
3. Actualiza `openapi/openapi.json` (`pnpm openapi:export`).
4. Escribe su guía de integración para frontend en `docs/frontend/fase-XX-<nombre>.md`.
5. Tiene pruebas (unitarias de reglas de negocio + e2e de los endpoints) en verde.
6. Queda en un commit propio: `feat(fase-XX): ...`.

Así el frontend puede integrarse fase por fase.

## Mapa de fases

| Fase backend | Nombre | HUs | Fase del documento |
|---|---|---|---|
| 00 | Fundaciones (esqueleto, config, errores, docs, salud, docker, Railway) | — | — |
| 01 | Identidad: registro, OTP, login, recuperación, perfil, ubicaciones, zonas horarias + Contacto público | HU-02, 03, 04, 05, 14 (sin "Mis pagos"), 11 (soporte backend), 38, 01 (form) | Fase 1 + Sitio público |
| 02 | Oferta formativa: modelo de ofertas, módulos, sesiones, recursos; catálogo y ficha públicos; disponibilidad para páginas públicas | HU-15, 16, 34 (disponibilidad), 37 (datos opcionales) | Fase 1 |
| 03 | Portal del participante: inscripciones, Mi formación, Aula, materiales, sesiones en vivo, asistencia, calendario, biblioteca, notificaciones, dashboard | HU-06, 07, 08, 09, 10, 12, 13, 17, 18 | Fase 1 |
| 04 | Postulaciones: becas y convocatorias, seguimiento, vencimientos | HU-19, 20, 21 | Fase 2 |
| 05 | Pagos: Stripe Checkout, saldo tras beca, transferencias MX, cuotas automáticas, acceso Moodle, Mis pagos y comprobantes | HU-22, 23, 24, 25, 26 | Fase 2 |
| 06 | Panel administrativo: roles/permisos, CRUD de ofertas (asistente 7 pasos), módulos y recursos, generación de sesiones, asistencia, revisión de postulaciones, embudo, gestión de pagos | HU-27 a HU-33 | Fase 3 |

Fuera de alcance (Anexo A del documento): CMS del sitio público, bandeja de mensajes de contacto en el panel, cursos grabados, CFDI, PayPal, integración por API con Zoom y Moodle, WhatsApp/SMS automáticos. Las páginas HU-34 a HU-37 son contenido estático del frontend; el backend solo aporta datos dinámicos (disponibilidad de ofertas, y opcionalmente equipo/premios si se decide).

## Supuestos del Anexo A

Los supuestos pendientes de confirmar con el cliente (plazos de 7 días, mora a los 15 días, 2–4 cuotas, ventana de asistencia de 24 h, etc.) se implementan como **valores configurables** (constantes en `src/config/business-rules.ts` o campos por oferta), nunca con números mágicos repartidos en el código. Los **tipos de beca** (nombre, %, entrevista) son datos administrables desde el panel (`/admin/scholarship-types`, ver ARCHITECTURE.md "Tipos de beca parametrizables"), no constantes.

## Estado

| Fase | Estado |
|---|---|
| 00 | hecho |
| 01 | hecho |
| 02 | hecho |
| 03 | hecho |
| 04 | hecho |
| 05 | hecho |
| 06 | hecho |
