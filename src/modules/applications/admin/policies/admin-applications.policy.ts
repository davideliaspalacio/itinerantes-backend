import { BUSINESS_RULES } from '../../../../config/business-rules';
import type {
  ApplicationKind,
  ApplicationStatus,
  EvaluationRecommendation,
  ScholarshipLevel,
} from '../../../../generated/prisma/client';
import { SCHOLARSHIP_LEVEL_ORDER } from '../../../offers/policies/scholarship.policy';
import { interviewRequired, levelMaxPercent } from '../../policies/application-rules.policy';

/**
 * Reglas puras del panel de postulaciones (Fase 06, HU-31 revisión y HU-32 seguimiento).
 */

// -------------------------------------------------------------------------------------------------
// HU-31: resumen de evaluaciones del comité
// -------------------------------------------------------------------------------------------------

export interface EvaluationSummary {
  approve: number;
  notSelect: number;
  unsure: number;
  total: number;
  /** Nivel más sugerido (empate → el de menor porcentaje); null si nadie sugirió nivel. */
  mostSuggestedLevel: ScholarshipLevel | null;
  /** "2 aprobar · 1 con dudas · nivel más sugerido: Aguas Libres 50%". */
  label: string;
}

export function summarizeEvaluations(
  evaluations: ReadonlyArray<{
    recommendation: EvaluationRecommendation;
    suggestedLevel: ScholarshipLevel | null;
  }>,
): EvaluationSummary {
  const count = (r: EvaluationRecommendation) =>
    evaluations.filter((e) => e.recommendation === r).length;
  const approve = count('APPROVE');
  const notSelect = count('NOT_SELECT');
  const unsure = count('UNSURE');
  const votes = new Map<ScholarshipLevel, number>();
  for (const e of evaluations) {
    if (e.suggestedLevel) votes.set(e.suggestedLevel, (votes.get(e.suggestedLevel) ?? 0) + 1);
  }
  let mostSuggestedLevel: ScholarshipLevel | null = null;
  for (const level of SCHOLARSHIP_LEVEL_ORDER) {
    const n = votes.get(level) ?? 0;
    if (n > 0 && (mostSuggestedLevel === null || n > (votes.get(mostSuggestedLevel) ?? 0))) {
      mostSuggestedLevel = level;
    }
  }
  const parts: string[] = [];
  if (approve) parts.push(`${approve} aprobar`);
  if (notSelect) parts.push(`${notSelect} no seleccionar`);
  if (unsure) parts.push(`${unsure} con dudas`);
  if (mostSuggestedLevel) {
    const def = BUSINESS_RULES.SCHOLARSHIP_LEVELS[mostSuggestedLevel];
    const pct =
      def.minPercent === def.maxPercent
        ? `${def.minPercent}%`
        : `${def.minPercent}–${def.maxPercent}%`;
    parts.push(`nivel más sugerido: ${def.label} ${pct}`);
  }
  return {
    approve,
    notSelect,
    unsure,
    total: evaluations.length,
    mostSuggestedLevel,
    label: parts.length ? parts.join(' · ') : 'Sin evaluaciones',
  };
}

/**
 * ¿La postulación requiere entrevista por Zoom? (HU-31): convocatorias siempre; becas de más de 70%
 * según el nivel asignado o, si aún no hay decisión, el solicitado.
 */
export function applicationRequiresInterview(app: {
  kind: ApplicationKind;
  requestedLevel: ScholarshipLevel | null;
  assignedPercent: number | null;
}): boolean {
  const percent = app.assignedPercent ?? levelMaxPercent(app.requestedLevel);
  return interviewRequired(app.kind, percent);
}

// -------------------------------------------------------------------------------------------------
// HU-32: embudo de conversión
// -------------------------------------------------------------------------------------------------

export const FunnelStageKey = {
  APPLIED: 'APPLIED',
  APPROVED: 'APPROVED',
  PAYMENT_STARTED: 'PAYMENT_STARTED',
  ENROLLED: 'ENROLLED',
} as const;
export type FunnelStageKey = (typeof FunnelStageKey)[keyof typeof FunnelStageKey];

export const FUNNEL_STAGE_LABELS: Record<FunnelStageKey, string> = {
  APPLIED: 'Postulados',
  APPROVED: 'Aprobados',
  PAYMENT_STARTED: 'Con pago iniciado',
  ENROLLED: 'Inscritos',
};

/** Estados que implican que la postulación fue aprobada en algún momento. */
const EVER_APPROVED: readonly ApplicationStatus[] = [
  'APPROVED_PENDING_PAYMENT',
  'APPROVED_PENDING_CONFIRMATION',
  'ENROLLED',
  'EXPIRED',
];

export interface FunnelInput {
  status: ApplicationStatus;
  submittedAt: Date | null;
  paymentStartedAt: Date | null;
  responseDueAt: Date | null;
}

export interface FunnelStage {
  key: FunnelStageKey;
  label: string;
  count: number;
  /** % sobre postulados (entero). */
  percentOfApplied: number;
  /** % sobre la etapa anterior (entero). */
  percentOfPrevious: number;
}

export interface Funnel {
  stages: FunnelStage[];
  /** Inscritos ÷ postulados (entero). */
  conversionPercent: number;
  inReview: number;
  pendingPayment: number;
  pendingConfirmation: number;
  expired: number;
  notSelected: number;
  /** Aprobadas en espera con plazo ≤ DEADLINE_ALERT_DAYS. */
  dueSoon: number;
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/**
 * Embudo de HU-32 (Postulados → Aprobados → Con pago iniciado → Inscritos). Solo cuenta postulaciones
 * enviadas (nunca borradores). "Con pago iniciado" (Anexo A, por confirmar) = abrió Stripe, subió
 * comprobante o creó plan (`paymentStartedAt`); una inscrita cuenta como iniciada (embudo monótono,
 * p. ej. convocatorias sin costo que solo confirman).
 * @example 40 → 30 → 24 → 20 = 50% de conversión
 */
export function computeFunnel(apps: readonly FunnelInput[], now: Date): Funnel {
  const sent = apps.filter((a) => a.status !== 'DRAFT' && a.submittedAt !== null);
  const approved = sent.filter((a) => EVER_APPROVED.includes(a.status));
  const started = approved.filter((a) => a.paymentStartedAt !== null || a.status === 'ENROLLED');
  const enrolled = sent.filter((a) => a.status === 'ENROLLED');
  const counts: Array<[FunnelStageKey, number]> = [
    ['APPLIED', sent.length],
    ['APPROVED', approved.length],
    ['PAYMENT_STARTED', started.length],
    ['ENROLLED', enrolled.length],
  ];
  const stages = counts.map(([key, count], i) => ({
    key,
    label: FUNNEL_STAGE_LABELS[key],
    count,
    percentOfApplied: pct(count, sent.length),
    percentOfPrevious: i === 0 ? (sent.length > 0 ? 100 : 0) : pct(count, counts[i - 1][1]),
  }));
  const awaiting = sent.filter(
    (a) => a.status === 'APPROVED_PENDING_PAYMENT' || a.status === 'APPROVED_PENDING_CONFIRMATION',
  );
  return {
    stages,
    conversionPercent: pct(enrolled.length, sent.length),
    inReview: sent.filter((a) =>
      ['SUBMITTED', 'IN_REVIEW', 'INTERVIEW_SCHEDULED'].includes(a.status),
    ).length,
    pendingPayment: sent.filter((a) => a.status === 'APPROVED_PENDING_PAYMENT').length,
    pendingConfirmation: sent.filter((a) => a.status === 'APPROVED_PENDING_CONFIRMATION').length,
    expired: sent.filter((a) => a.status === 'EXPIRED').length,
    notSelected: sent.filter((a) => a.status === 'NOT_SELECTED').length,
    dueSoon: awaiting.filter((a) => isDueSoon(a.responseDueAt, now)).length,
  };
}

const DAY_MS = 24 * 3600 * 1000;

/** Días restantes (redondeo hacia arriba; negativo si ya venció; null sin plazo). */
export function remainingDays(dueAt: Date | null, now: Date): number | null {
  if (!dueAt) return null;
  return Math.ceil((dueAt.getTime() - now.getTime()) / DAY_MS);
}

/** HU-32: "alerta ≤ 2 días" (BUSINESS_RULES.DEADLINE_ALERT_DAYS), solo plazos aún vigentes. */
export function isDueSoon(dueAt: Date | null, now: Date): boolean {
  if (!dueAt) return false;
  const ms = dueAt.getTime() - now.getTime();
  return ms > 0 && ms <= BUSINESS_RULES.DEADLINE_ALERT_DAYS * DAY_MS;
}

// -------------------------------------------------------------------------------------------------
// HU-32: recordatorios y WhatsApp
// -------------------------------------------------------------------------------------------------

/** Ventana mínima entre recordatorios desde el panel ("máx. 1 recordatorio cada 24 h"). */
export const FOLLOW_UP_REMINDER_INTERVAL_HOURS = 24;

/** Próximo momento en que se puede enviar un recordatorio (null = ya se puede). */
export function reminderAvailableAt(lastReminderAt: Date | null, now: Date): Date | null {
  if (!lastReminderAt) return null;
  const next = new Date(lastReminderAt.getTime() + FOLLOW_UP_REMINDER_INTERVAL_HOURS * 3600_000);
  return next.getTime() > now.getTime() ? next : null;
}

/**
 * Número para wa.me (solo dígitos, con indicativo) o null si el teléfono no es válido: indicativo
 * "+N…" (1–4 dígitos) y número de 6 a 15 dígitos.
 */
export function whatsappNumber(phone: { countryCode: string; number: string }): string | null {
  const cc = phone.countryCode.trim();
  const num = phone.number.replace(/[\s-]/g, '');
  if (!/^\+\d{1,4}$/.test(cc) || !/^\d{6,15}$/.test(num)) return null;
  return `${cc.slice(1)}${num}`;
}

export function whatsappUrl(number: string, text?: string): string {
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export const DEFAULT_PAYMENT_TEMPLATE =
  'Hola {nombre}, te escribimos de la Escuela Itinerante del Agua. Tu saldo pendiente es de ' +
  '{saldo}. Puedes pagarlo aquí: {link_pago}. ¿Te podemos ayudar con algo?';
export const DEFAULT_CONFIRMATION_TEMPLATE =
  'Hola {nombre}, te escribimos de la Escuela Itinerante del Agua. Tu postulación fue aprobada: ' +
  'confirma tu participación aquí: {link_pago}. ¿Te podemos ayudar con algo?';

/** Reemplaza {nombre}, {saldo} y {link_pago} (las variables desconocidas se dejan tal cual). */
export function renderFollowUpTemplate(
  template: string,
  vars: { nombre: string; saldo: string; link_pago: string },
): string {
  return template.replace(
    /\{(nombre|saldo|link_pago)\}/g,
    (_, key: keyof typeof vars) => vars[key],
  );
}

/** Primer nombre para los saludos. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
