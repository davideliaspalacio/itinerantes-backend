/**
 * Reglas de negocio configurables.
 *
 * Centraliza los valores que el documento de requerimientos marca como supuestos o "por
 * confirmar" (Anexo A de docs/requirements/HU_EIA_Fases_1-3.md). Nunca uses números mágicos
 * repartidos en el código: impórtalos de aquí. Si el cliente confirma otro valor, se cambia en un
 * solo lugar. Los valores que varían por oferta (p. ej. cupo, precio) van en la BD, no aquí.
 *
 * Unidades explícitas en el nombre: *_MINUTES, *_SECONDS, *_HOURS, *_DAYS, *_BYTES, *_PERCENT.
 */

const MB = 1024 * 1024;

export const BUSINESS_RULES = {
  // ---------------------------------------------------------------------------
  // Tiempo
  // ---------------------------------------------------------------------------
  /** Hora oficial de las actividades (Anexo A, HU-11): CDMX, UTC−6 todo el año, sin horario de verano. */
  OFFICIAL_TIMEZONE: 'America/Mexico_City',
  /** Zona por defecto del usuario al registrarse (HU-02, HU-11). */
  DEFAULT_USER_TIMEZONE: 'America/Mexico_City',

  // ---------------------------------------------------------------------------
  // Identidad (Fase 01)
  // ---------------------------------------------------------------------------
  /** HU-02 / HU-05 / HU-14: mínimo 8 caracteres, al menos una letra y un número. */
  PASSWORD_MIN_LENGTH: 8,
  /** HU-03: el OTP es numérico de 6 dígitos. */
  OTP_LENGTH: 6,
  /** HU-03 / HU-05: "expira tras un tiempo definido" (supuesto: 10 min). */
  OTP_TTL_MINUTES: 10,
  /** HU-03: cuenta regresiva antes de "Reenviar código" (ejemplo de la HU: 00:30). */
  OTP_RESEND_COOLDOWN_SECONDS: 30,
  /** HU-03: intentos fallidos consecutivos antes del bloqueo temporal (supuesto). */
  OTP_MAX_ATTEMPTS: 5,
  /** HU-03: duración del bloqueo temporal tras agotar intentos (supuesto). */
  OTP_LOCKOUT_MINUTES: 15,
  /** HU-04: intentos de login fallidos consecutivos antes del bloqueo temporal (supuesto). */
  LOGIN_MAX_ATTEMPTS: 5,
  /** HU-04: duración del bloqueo temporal de login (supuesto). */
  LOGIN_LOCKOUT_MINUTES: 15,
  /** HU-02: longitud máxima de contraseña (evita hashes de cuerpos enormes). */
  PASSWORD_MAX_LENGTH: 128,
  /** HU-02: nombre completo, solo letras (con tildes/ñ) y espacios. */
  FULL_NAME_MAX_LENGTH: 120,
  /** HU-02 (supuesto): username de 3 a 30 caracteres: letras, números, punto y guion bajo. */
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 30,
  /** HU-05 paso 2 → 3: vida del resetToken de un solo uso emitido al verificar el OTP. */
  PASSWORD_RESET_TOKEN_TTL_MINUTES: 10,
  /**
   * HU-05: "si el correo no corresponde a ninguna cuenta, el sistema informa que no existe".
   * Lo pide el cliente, pero permite enumerar cuentas (riesgo documentado en
   * docs/frontend/fase-01-identidad.md). En `false`, la API responde igual exista o no la cuenta.
   * (revealUnknownEmailOnReset)
   */
  REVEAL_UNKNOWN_EMAIL_ON_RESET: true,
  /**
   * Límites de peticiones por IP (además del global). `ttlSeconds` es la ventana.
   * Se aplican con @Throttle en los endpoints de auth.
   */
  AUTH_THROTTLE: {
    REGISTER: { limit: 10, ttlSeconds: 3600 },
    LOGIN: { limit: 10, ttlSeconds: 60 },
    OTP_VERIFY: { limit: 10, ttlSeconds: 60 },
    OTP_SEND: { limit: 5, ttlSeconds: 60 },
    PASSWORD_RESET: { limit: 10, ttlSeconds: 60 },
    REFRESH: { limit: 30, ttlSeconds: 60 },
    AVAILABILITY: { limit: 60, ttlSeconds: 60 },
  },

  // ---------------------------------------------------------------------------
  // Portal del participante (Fase 03)
  // ---------------------------------------------------------------------------
  /** HU-12: "Entrar a sesión" se habilita 10 minutos antes del inicio. */
  SESSION_JOIN_WINDOW_MINUTES_BEFORE: 10,
  /** HU-18 / HU-30 (Anexo A): ventana por defecto para registrar asistencia tras la sesión. */
  ATTENDANCE_WINDOW_HOURS: 24,
  /** HU-18: comentario opcional de asistencia, máximo 500 caracteres. */
  ATTENDANCE_COMMENT_MAX_LENGTH: 500,
  /** HU-30 (Anexo A): umbral de asistencia solo como alerta visual. */
  ATTENDANCE_ALERT_THRESHOLD_PERCENT: 80,
  /** HU-06 (Anexo A): aviso de cuota próxima desde N días antes del cobro. */
  INSTALLMENT_UPCOMING_NOTICE_DAYS: 7,

  // ---------------------------------------------------------------------------
  // Postulaciones y becas (Fase 04)
  // ---------------------------------------------------------------------------
  /** HU-19 (Anexo A): carta de intención como texto de 800 a 4000 caracteres. */
  SCHOLARSHIP_LETTER_MIN_LENGTH: 800,
  SCHOLARSHIP_LETTER_MAX_LENGTH: 4000,
  /** Reglas del cliente: becas del 10% al 80%; > 70% requiere entrevista por Zoom. */
  SCHOLARSHIP_MIN_PERCENT: 10,
  SCHOLARSHIP_MAX_PERCENT: 80,
  SCHOLARSHIP_INTERVIEW_REQUIRED_ABOVE_PERCENT: 70,
  /**
   * Niveles de beca (pregunta abierta al cliente; enum Prisma `ScholarshipLevel`). Los niveles fijos
   * tienen min = max. "Beca especial": el comité asigna 71–80% tras la entrevista (Anexo A, HU-19).
   * Cada oferta habilita un subconjunto (`Offer.scholarshipLevels`, HU-27).
   */
  SCHOLARSHIP_LEVELS: {
    AGUA_VIVA: { label: 'Agua Viva', minPercent: 10, maxPercent: 10 },
    RIOS_VIVOS: { label: 'Ríos Vivos', minPercent: 25, maxPercent: 25 },
    AGUAS_LIBRES: { label: 'Aguas Libres', minPercent: 50, maxPercent: 50 },
    CENOTES_VIVOS: { label: 'Cenotes Vivos', minPercent: 70, maxPercent: 70 },
    SPECIAL: { label: 'Beca especial', minPercent: 71, maxPercent: 80 },
  },
  /** HU-20: respuestas abiertas de convocatoria, 300 a 2000 caracteres. */
  OPEN_CALL_ANSWER_MIN_LENGTH: 300,
  OPEN_CALL_ANSWER_MAX_LENGTH: 2000,
  /** HU-21 / HU-23 (Anexo A): días naturales para pagar el saldo tras aprobar la beca. */
  PAYMENT_DEADLINE_AFTER_APPROVAL_DAYS: 7,
  /** HU-21 (Anexo A): días para "Confirmar mi participación" en convocatorias sin costo. */
  OPEN_CALL_CONFIRMATION_DEADLINE_DAYS: 7,
  /** HU-32: se destacan los plazos que vencen en N días o menos. */
  DEADLINE_ALERT_DAYS: 2,
  /** HU-13 (Anexo A): recordatorio N horas antes de vencer el saldo. */
  BALANCE_REMINDER_HOURS_BEFORE: 48,

  // ---------------------------------------------------------------------------
  // Pagos (Fase 05)
  // ---------------------------------------------------------------------------
  /** HU-24 (Anexo A): plan de 2 a 4 cuotas mensuales iguales (centavos de ajuste en la última). */
  INSTALLMENTS_MIN: 2,
  INSTALLMENTS_MAX: 4,
  /** HU-24: Stripe reintenta hasta 3 veces en 7 días. */
  INSTALLMENT_RETRY_ATTEMPTS: 3,
  INSTALLMENT_RETRY_WINDOW_DAYS: 7,
  /** HU-24 (Anexo A): plan "En mora" a los 15 días de un cobro fallido (suspensión manual). */
  DELINQUENCY_AFTER_DAYS: 15,
  /** Reglas del cliente: precios fijos en MXN y USD (sin conversión); México paga en MXN. */
  SUPPORTED_CURRENCIES: ['MXN', 'USD'],
  MXN_COUNTRY_CODE: 'MX',

  // ---------------------------------------------------------------------------
  // Archivos (límites de carga)
  // ---------------------------------------------------------------------------
  FILE_LIMITS: {
    /** HU-17: entrega de proyecto final — PDF, DOCX, PPTX o ZIP, máx. 20 MB. */
    FINAL_PROJECT: {
      maxBytes: 20 * MB,
      mimeTypes: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/zip',
      ],
    },
    /** HU-19: evidencias — imágenes JPG/PNG/HEIC ≤ 10 MB. */
    EVIDENCE_IMAGE: {
      maxBytes: 10 * MB,
      mimeTypes: ['image/jpeg', 'image/png', 'image/heic'],
    },
    /** HU-19: evidencias — video MP4/MOV ≤ 100 MB. */
    EVIDENCE_VIDEO: { maxBytes: 100 * MB, mimeTypes: ['video/mp4', 'video/quicktime'] },
    /** HU-19: mínimo 1 y máximo 10 archivos de evidencia. */
    EVIDENCE_MIN_FILES: 1,
    EVIDENCE_MAX_FILES: 10,
    /** HU-23: comprobante de transferencia — PDF/JPG/PNG ≤ 5 MB. */
    TRANSFER_RECEIPT: {
      maxBytes: 5 * MB,
      mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    },
    /** HU-27: portada de oferta — JPG/PNG/WebP ≤ 5 MB. */
    OFFER_COVER: { maxBytes: 5 * MB, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
    /** HU-28: recursos del módulo — PDF/PPTX (presentación) o PDF/DOCX/EPUB (lecturas) ≤ 50 MB. */
    MODULE_RESOURCE: {
      maxBytes: 50 * MB,
      mimeTypes: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/epub+zip',
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Oferta formativa (Fase 02 / 06)
  // ---------------------------------------------------------------------------
  /** HU-27 (Anexo A): los diplomados suman exactamente 60 h (confirmar si se admiten variaciones). */
  DIPLOMA_TOTAL_HOURS: 60,
  /** Reglas del cliente: un curso dura como máximo 9 h. */
  COURSE_MAX_HOURS: 9,
  /** HU-27: ventana de asistencia configurable por oferta entre 1 y 72 h (default ATTENDANCE_WINDOW_HOURS). */
  ATTENDANCE_WINDOW_MIN_HOURS: 1,
  ATTENDANCE_WINDOW_MAX_HOURS: 72,
  /** HU-15: el buscador del catálogo exige al menos 3 caracteres. */
  OFFER_SEARCH_MIN_LENGTH: 3,
  /** HU-16 / HU-27: resumen corto de la tarjeta del catálogo. */
  OFFER_SUMMARY_MAX_LENGTH: 300,
  /**
   * Imágenes públicas (portadas, carrusel, fotos de docentes) cuando no hay STORAGE_PUBLIC_BASE_URL:
   * URL firmada de larga duración (máximo de SigV4: 7 días).
   */
  PUBLIC_IMAGE_SIGNED_URL_TTL_SECONDS: 7 * 24 * 3600,

  // ---------------------------------------------------------------------------
  // Contacto (HU-38)
  // ---------------------------------------------------------------------------
  CONTACT_MESSAGE_MIN_LENGTH: 10,
  CONTACT_MESSAGE_MAX_LENGTH: 2000,
  /** HU-38: nombre del remitente, mínimo 3 caracteres. */
  CONTACT_NAME_MIN_LENGTH: 3,
  /** HU-38: máximo 5 envíos por IP por hora. */
  CONTACT_THROTTLE: { limit: 5, ttlSeconds: 3600 },

  // ---------------------------------------------------------------------------
  // Paginación (convención de la API)
  // ---------------------------------------------------------------------------
  PAGINATION_DEFAULT_PAGE_SIZE: 20,
  PAGINATION_MAX_PAGE_SIZE: 100,
} as const;

export type BusinessRules = typeof BUSINESS_RULES;
