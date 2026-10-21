/**
 * Rutas relativas del frontend del portal que usan las notificaciones (`actionPath`) y los correos
 * (`FRONTEND_URL + path`). Documentadas en docs/frontend/fase-03-portal.md: si el frontend usa otras
 * rutas, cambia SOLO este archivo (las notificaciones también traen los ids en `data`).
 */
export const PORTAL_LINKS = {
  dashboard: () => '/portal',
  classroom: (offerId: string) => `/portal/aula/${offerId}`,
  materials: (offerId: string, moduleId?: string) =>
    `/portal/aula/${offerId}/materiales${moduleId ? `#modulo-${moduleId}` : ''}`,
  attendance: (sessionId: string) => `/portal/asistencia/${sessionId}`,
  sessions: () => '/portal/sesiones',
  calendar: () => '/portal/calendario',
  library: () => '/portal/biblioteca',
  notifications: () => '/portal/notificaciones',
  offer: (slug: string) => `/escuela/oferta/${slug}`,
} as const;
