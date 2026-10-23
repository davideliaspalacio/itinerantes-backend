import { BUSINESS_RULES } from '../../../config/business-rules';

/**
 * Tipos de beca parametrizables — reglas PURAS (sin BD).
 *
 * - Un tipo define nombre, rango de porcentaje (fijo si min = max), si requiere entrevista y si está
 *   activo. Cada oferta habilita tipos y puede sobrescribir el rango SOLO para esa oferta.
 * - Rango efectivo = el de la oferta (si existe) o el del tipo.
 * - Desactivar un tipo lo deja de ofrecer (ofertas y postulaciones nuevas) sin tocar lo ya asignado.
 */

export interface ScholarshipTypeDef {
  id: string;
  key: string;
  name: string;
  description: string | null;
  minPercent: number;
  maxPercent: number;
  requiresInterview: boolean;
  /** Cupo global del tipo (null = sin límite). */
  maxRecipients: number | null;
  active: boolean;
  sortOrder: number;
}

/** Fila de `offer_scholarship_types` con su tipo. */
export interface OfferScholarshipTypeLink {
  minPercent: number | null;
  maxPercent: number | null;
  sortOrder: number | null;
  /** Tope adicional de becas de este tipo solo en esta oferta (null = sin tope propio). */
  maxRecipients: number | null;
  scholarshipType: ScholarshipTypeDef;
}

/** Tipo habilitado en una oferta, con el rango y orden efectivos. */
export interface ScholarshipOption extends ScholarshipTypeDef {
  /** El rango viene de la oferta (override) y no del tipo. */
  rangeOverridden: boolean;
  /** Tope propio de la oferta (`maxRecipients` es el global del tipo). */
  offerMaxRecipients: number | null;
}

/** Resumen que acompaña a cualquier `scholarshipTypeId` en las respuestas. */
export interface ScholarshipTypeSummary {
  id: string;
  key: string;
  name: string;
  minPercent: number;
  maxPercent: number;
  requiresInterview: boolean;
}

export interface PercentRangeIssue {
  field: 'minPercent' | 'maxPercent';
  code: 'INVALID';
  message: string;
}

/** MAYÚSCULAS_CON_GUION_BAJO: empieza con letra; letras, dígitos y guiones bajos simples. */
export const SCHOLARSHIP_TYPE_KEY_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

export function isValidScholarshipTypeKey(key: string): boolean {
  return (
    key.length <= BUSINESS_RULES.SCHOLARSHIP_TYPE_KEY_MAX_LENGTH &&
    SCHOLARSHIP_TYPE_KEY_PATTERN.test(key)
  );
}

/** "Beca especial" → "BECA_ESPECIAL" (sugerencia de clave para el formulario del panel). */
export function suggestScholarshipTypeKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[0-9_]+/, '')
    .slice(0, BUSINESS_RULES.SCHOLARSHIP_TYPE_KEY_MAX_LENGTH)
    .replace(/_+$/, '');
}

/** Valida 1 ≤ min ≤ max ≤ 100 (límites de BUSINESS_RULES). Vacío = válido. */
export function percentRangeIssues(minPercent: number, maxPercent: number): PercentRangeIssue[] {
  const floor = BUSINESS_RULES.SCHOLARSHIP_TYPE_PERCENT_FLOOR;
  const ceiling = BUSINESS_RULES.SCHOLARSHIP_TYPE_PERCENT_CEILING;
  const issues: PercentRangeIssue[] = [];
  const inBounds = (n: number) => Number.isInteger(n) && n >= floor && n <= ceiling;
  if (!inBounds(minPercent)) {
    issues.push({
      field: 'minPercent',
      code: 'INVALID',
      message: `El porcentaje mínimo debe ser un entero entre ${floor} y ${ceiling}.`,
    });
  }
  if (!inBounds(maxPercent)) {
    issues.push({
      field: 'maxPercent',
      code: 'INVALID',
      message: `El porcentaje máximo debe ser un entero entre ${floor} y ${ceiling}.`,
    });
  }
  if (issues.length === 0 && minPercent > maxPercent) {
    issues.push({
      field: 'maxPercent',
      code: 'INVALID',
      message: 'El porcentaje máximo no puede ser menor que el mínimo.',
    });
  }
  return issues;
}

/** Rango efectivo de un tipo en una oferta (override de la oferta o el del tipo). */
export function effectiveRange(
  link: Pick<OfferScholarshipTypeLink, 'minPercent' | 'maxPercent' | 'scholarshipType'>,
): {
  minPercent: number;
  maxPercent: number;
} {
  return {
    minPercent: link.minPercent ?? link.scholarshipType.minPercent,
    maxPercent: link.maxPercent ?? link.scholarshipType.maxPercent,
  };
}

/** Orden de presentación: `sortOrder` (de la oferta o del tipo), luego nombre. */
export function compareScholarshipOptions(
  a: Pick<ScholarshipOption, 'sortOrder' | 'name'>,
  b: Pick<ScholarshipOption, 'sortOrder' | 'name'>,
): number {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es');
}

/**
 * Tipos habilitados en la oferta con su rango efectivo, ordenados. `activeOnly` (por defecto) deja
 * solo los activos: lo que se ofrece en la ficha y en el formulario de postulación.
 */
export function scholarshipOptions(
  links: readonly OfferScholarshipTypeLink[],
  { activeOnly = true }: { activeOnly?: boolean } = {},
): ScholarshipOption[] {
  return links
    .filter((link) => !activeOnly || link.scholarshipType.active)
    .map((link) => ({
      ...link.scholarshipType,
      ...effectiveRange(link),
      sortOrder: link.sortOrder ?? link.scholarshipType.sortOrder,
      rangeOverridden: link.minPercent !== null || link.maxPercent !== null,
      offerMaxRecipients: link.maxRecipients,
    }))
    .sort(compareScholarshipOptions);
}

export function toScholarshipTypeSummary(
  type: Pick<
    ScholarshipTypeDef,
    'id' | 'key' | 'name' | 'minPercent' | 'maxPercent' | 'requiresInterview'
  >,
): ScholarshipTypeSummary {
  return {
    id: type.id,
    key: type.key,
    name: type.name,
    minPercent: type.minPercent,
    maxPercent: type.maxPercent,
    requiresInterview: type.requiresInterview,
  };
}

/**
 * Resumen del tipo con el rango efectivo de la oferta si está habilitado en ella (aunque ya esté
 * inactivo); si no, el rango propio del tipo.
 */
export function summaryInOffer(
  type: ScholarshipTypeDef | null,
  links: readonly OfferScholarshipTypeLink[],
): ScholarshipTypeSummary | null {
  if (!type) return null;
  const option = scholarshipOptions(links, { activeOnly: false }).find((o) => o.id === type.id);
  return toScholarshipTypeSummary(option ?? type);
}

/**
 * Tipo ASIGNADO a una postulación: resumen en la oferta con el nombre guardado al aprobar
 * (`assignedScholarshipTypeName`), para que renombrar el tipo no altere el histórico.
 */
export function assignedSummary(
  type: ScholarshipTypeDef | null,
  links: readonly OfferScholarshipTypeLink[],
  snapshotName: string | null,
): ScholarshipTypeSummary | null {
  const summary = summaryInOffer(type, links);
  return summary && snapshotName ? { ...summary, name: snapshotName } : summary;
}

/** Rango del badge "10%–80%" (tipos activos de la oferta). null si no hay. */
export function scholarshipPercentRange(
  options: readonly Pick<ScholarshipOption, 'minPercent' | 'maxPercent'>[],
): { minPercent: number; maxPercent: number } | null {
  if (options.length === 0) return null;
  return {
    minPercent: Math.min(...options.map((o) => o.minPercent)),
    maxPercent: Math.max(...options.map((o) => o.maxPercent)),
  };
}

export type AssignedPercentResult = { ok: true; percent: number } | { ok: false; message: string };

/**
 * Porcentaje asignado por el comité (HU-31): debe caer en el rango efectivo del tipo en la oferta.
 * Rango fijo (min = max) → se toma automáticamente. `option` null = el tipo no está habilitado.
 */
export function resolveAssignedPercent(
  option: Pick<ScholarshipOption, 'name' | 'minPercent' | 'maxPercent'> | null,
  percent?: number | null,
): AssignedPercentResult {
  if (!option) {
    return { ok: false, message: 'El tipo de beca no está habilitado en esta oferta.' };
  }
  if (option.minPercent === option.maxPercent) {
    if (percent !== undefined && percent !== null && percent !== option.minPercent) {
      return {
        ok: false,
        message: `${option.name} es de ${option.minPercent}% fijo en esta oferta.`,
      };
    }
    return { ok: true, percent: option.minPercent };
  }
  if (
    percent === undefined ||
    percent === null ||
    !Number.isInteger(percent) ||
    percent < option.minPercent ||
    percent > option.maxPercent
  ) {
    return {
      ok: false,
      message: `${option.name}: indica un porcentaje entero entre ${option.minPercent}% y ${option.maxPercent}%.`,
    };
  }
  return { ok: true, percent };
}
