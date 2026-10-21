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
  // Fase 04 — Postulaciones (HU-19, 20, 21)
  /** Detalle de mi postulación (línea de tiempo, entrevista, resultado, acción). */
  application: (applicationId: string) => `/portal/postulaciones/${applicationId}`,
  /** Becas: pestañas "Becas disponibles" y "Mis postulaciones". */
  scholarships: () => '/portal/becas',
  /** Convocatorias: pestañas "Convocatorias abiertas" y "Mis postulaciones". */
  openCalls: () => '/portal/convocatorias',
  /** "Pagar saldo" tras beca (HU-23, pantalla de la Fase 05). */
  payBalance: (applicationId: string) => `/portal/postulaciones/${applicationId}/pago`,
  // Fase 05 — Pagos (HU-22, 23, 24, 26) y acceso Moodle (HU-25)
  /** Perfil › "Mis pagos" (HU-14 / HU-26). */
  myPayments: () => '/portal/perfil/pagos',
  /** Detalle de un pago (comprobante, motivo de rechazo). */
  payment: (paymentId: string) => `/portal/perfil/pagos/${paymentId}`,
  /** Resumen y pago de una oferta (HU-22: "Inscribirme y pagar" / "Pagar en cuotas"). */
  checkout: (offerSlug: string) => `/portal/pagar/${offerSlug}`,
  /**
   * Regreso de Stripe Checkout (success_url / cancel_url). El backend agrega `paymentId` y
   * `result=success|cancel`; Stripe reemplaza `{CHECKOUT_SESSION_ID}`.
   */
  checkoutResult: () => '/portal/pagos/resultado',
  /** "Mi formación" (banner de vinculación Moodle). */
  myFormation: () => '/portal/mi-formacion',
} as const;
