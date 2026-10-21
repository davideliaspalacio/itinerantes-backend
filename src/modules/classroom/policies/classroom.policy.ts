import type { ContentVisibility, OfferType, SessionStatus } from '../../../generated/prisma/client';
import { BUSINESS_RULES } from '../../../config/business-rules';

/**
 * Reglas puras del Aula (HU-08, HU-17, HU-28).
 */

// -------------------------------------------------------------------------------------------------
// Visibilidad de contenido (módulos, recursos, biblioteca)
// -------------------------------------------------------------------------------------------------

/** Visible si está PUBLISHED y `publishAt` es null o ya pasó (publicación programada, HU-28). */
export function isPublishedNow(
  item: { visibility: ContentVisibility; publishAt: Date | null },
  now: Date,
): boolean {
  return (
    item.visibility === 'PUBLISHED' &&
    (item.publishAt === null || item.publishAt.getTime() <= now.getTime())
  );
}

/** Mismo criterio como filtro Prisma (`where`). */
export function publishedNowWhere(now: Date) {
  return {
    visibility: 'PUBLISHED' as const,
    OR: [{ publishAt: null }, { publishAt: { lte: now } }],
  };
}

// -------------------------------------------------------------------------------------------------
// Estado del módulo (HU-17: Próximo / En curso / Completado)
// -------------------------------------------------------------------------------------------------

export const ModuleStatus = {
  UPCOMING: 'UPCOMING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;
export type ModuleStatus = (typeof ModuleStatus)[keyof typeof ModuleStatus];

/**
 * Con sesiones (no canceladas): todas terminadas → COMPLETED; alguna ya inició → IN_PROGRESS; si no →
 * UPCOMING. Sin sesiones: se usan las fechas de la oferta.
 */
export function deriveModuleStatus(
  sessions: ReadonlyArray<{ status: SessionStatus; startsAt: Date; endsAt: Date }>,
  offer: { startsAt: Date | null; endsAt: Date | null },
  now: Date,
): ModuleStatus {
  const t = now.getTime();
  const active = sessions.filter((s) => s.status !== 'CANCELLED');
  if (active.length > 0) {
    if (active.every((s) => s.endsAt.getTime() <= t)) return ModuleStatus.COMPLETED;
    if (active.some((s) => s.startsAt.getTime() <= t)) return ModuleStatus.IN_PROGRESS;
    return ModuleStatus.UPCOMING;
  }
  if (offer.endsAt && offer.endsAt.getTime() <= t) return ModuleStatus.COMPLETED;
  if (offer.startsAt && offer.startsAt.getTime() <= t) return ModuleStatus.IN_PROGRESS;
  return ModuleStatus.UPCOMING;
}

// -------------------------------------------------------------------------------------------------
// Grupo de WhatsApp y "Antes de empezar" (HU-17)
// -------------------------------------------------------------------------------------------------

export interface WhatsappInput {
  url: string | null;
  visibleFrom: Date | null;
  /** Inicio de la primera sesión (o de la oferta). */
  firstSessionStartsAt: Date | null;
}

export interface WhatsappInfo {
  /** El enlace se entrega (solo inscritos con acceso, desde `visibleFrom`). */
  available: boolean;
  url: string | null;
  /** Fecha desde la que estará disponible (si ya está configurado pero aún no visible). */
  availableFrom: Date | null;
  /** "Antes de empezar" destacado: aún no inicia la primera sesión. */
  preStart: boolean;
}

/**
 * Se entrega el enlace solo si hay URL y `visibleFrom` es null o ya pasó (HU-17/HU-27). El llamador
 * garantiza que la persona tiene acceso al Aula; la ficha pública nunca lo usa.
 */
export function whatsappInfo(input: WhatsappInput, now: Date): WhatsappInfo {
  const t = now.getTime();
  const visible = !!input.url && (!input.visibleFrom || input.visibleFrom.getTime() <= t);
  return {
    available: visible,
    url: visible ? input.url : null,
    availableFrom: input.url && !visible ? input.visibleFrom : null,
    preStart: !input.firstSessionStartsAt || input.firstSessionStartsAt.getTime() > t,
  };
}

// -------------------------------------------------------------------------------------------------
// Proyecto final (HU-17, Anexo A: carga opcional habilitable por diplomado)
// -------------------------------------------------------------------------------------------------

/** El bloque "Proyecto final" solo existe en diplomados (HU-17). */
export function showsFinalProject(type: OfferType): boolean {
  return type === 'DIPLOMA';
}

export const FinalProjectSubmissionState = {
  /** La oferta no recibe archivo (presentación en vivo). */
  DISABLED: 'DISABLED',
  OPEN: 'OPEN',
  /** Pasó la fecha límite: solo lectura. */
  CLOSED: 'CLOSED',
} as const;
export type FinalProjectSubmissionState =
  (typeof FinalProjectSubmissionState)[keyof typeof FinalProjectSubmissionState];

export function finalProjectSubmissionState(
  input: { type: OfferType; submissionEnabled: boolean; dueAt: Date | null },
  now: Date,
): FinalProjectSubmissionState {
  if (!showsFinalProject(input.type) || !input.submissionEnabled) {
    return FinalProjectSubmissionState.DISABLED;
  }
  if (input.dueAt && input.dueAt.getTime() <= now.getTime()) {
    return FinalProjectSubmissionState.CLOSED;
  }
  return FinalProjectSubmissionState.OPEN;
}

/** Valida tipo y tamaño declarados (o reales) del archivo del proyecto final. */
export function isValidFinalProjectFile(file: { mimeType: string; sizeBytes: number }): boolean {
  const limits = BUSINESS_RULES.FILE_LIMITS.FINAL_PROJECT;
  return (
    (limits.mimeTypes as readonly string[]).includes(file.mimeType) &&
    Number.isInteger(file.sizeBytes) &&
    file.sizeBytes > 0 &&
    file.sizeBytes <= limits.maxBytes
  );
}

/** Prefijo de storage del proyecto final de una persona (las keys ajenas se rechazan). */
export function finalProjectKeyPrefix(offerId: string, userId: string): string {
  return `final-projects/${offerId}/${userId}/`;
}
