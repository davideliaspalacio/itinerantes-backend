/**
 * Rutas relativas a la RAÍZ del portal (sin prefijo /portal: el portal vive en su propio dominio,
 * p. ej. https://portal.itinerantesdelagua.com) que usan las notificaciones (`actionPath`) y los
 * correos (`PORTAL_URL + path`). Documentadas en docs/frontend/fase-03-portal.md: si el frontend usa otras
 * rutas, cambia SOLO este archivo (las notificaciones también traen los ids en `data`).
 */
export const PORTAL_LINKS = {
  dashboard: () => '/',
  classroom: (offerId: string) => `/aula/${offerId}`,
  materials: (offerId: string, moduleId?: string) =>
    `/aula/${offerId}/materiales${moduleId ? `#modulo-${moduleId}` : ''}`,
  attendance: (sessionId: string) => `/asistencia/${sessionId}`,
  sessions: () => '/sesiones',
  calendar: () => '/calendario',
  library: () => '/biblioteca',
  notifications: () => '/notificaciones',
  // Fase 04 — Postulaciones (HU-19, 20, 21)
  /** Detalle de mi postulación (línea de tiempo, entrevista, resultado, acción). */
  application: (applicationId: string) => `/postulaciones/${applicationId}`,
  /** Becas: pestañas "Becas disponibles" y "Mis postulaciones". */
  scholarships: () => '/becas',
  /** Convocatorias: pestañas "Convocatorias abiertas" y "Mis postulaciones". */
  openCalls: () => '/convocatorias',
  /** "Pagar saldo" tras beca (HU-23, pantalla de la Fase 05). */
  payBalance: (applicationId: string) => `/postulaciones/${applicationId}/pago`,
  // Fase 05 — Pagos (HU-22, 23, 24, 26) y acceso Moodle (HU-25)
  /** Perfil › "Mis pagos" (HU-14 / HU-26). */
  myPayments: () => '/perfil/pagos',
  /** Detalle de un pago (comprobante, motivo de rechazo). */
  payment: (paymentId: string) => `/perfil/pagos/${paymentId}`,
  /** Resumen y pago de una oferta (HU-22: "Inscribirme y pagar" / "Pagar en cuotas"). */
  checkout: (offerSlug: string) => `/pagar/${offerSlug}`,
  /**
   * Regreso de Stripe Checkout (success_url / cancel_url). El backend agrega `paymentId` y
   * `result=success|cancel`; Stripe reemplaza `{CHECKOUT_SESSION_ID}`.
   */
  checkoutResult: () => '/pagos/resultado',
  /** "Mi formación" (banner de vinculación Moodle). */
  myFormation: () => '/mi-formacion',
} as const;
