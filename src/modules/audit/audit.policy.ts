/**
 * Resumen de cambios para el registro de auditoría (Fase 06). Función PURA: guarda solo los campos
 * que cambiaron, recorta valores largos y nunca guarda secretos.
 */

/** Campos que nunca se guardan en la auditoría (hashes, tokens, enlaces privados de anfitrión). */
const SENSITIVE_KEYS = /(password|hash|token|secret|^codes?$|hostUrl)/i;
const MAX_STRING = 200;
const MAX_ARRAY = 20;

export type AuditValue =
  string | number | boolean | null | AuditValue[] | { [k: string]: AuditValue };

export interface AuditChanges {
  before?: Record<string, AuditValue>;
  after?: Record<string, AuditValue>;
}

/** Normaliza un valor para JSON: fechas ISO, textos recortados, arreglos acotados. */
export function auditValue(value: unknown, depth = 0): AuditValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY).map((v) => auditValue(v, depth + 1));
    return value.length > MAX_ARRAY ? [...items, `… (+${value.length - MAX_ARRAY})`] : items;
  }
  if (typeof value === 'object') {
    if (depth >= 2) return auditValue(JSON.stringify(value), depth + 1);
    const out: Record<string, AuditValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!SENSITIVE_KEYS.test(k)) out[k] = auditValue(v, depth + 1);
    }
    return out;
  }
  return null; // funciones, símbolos: no se auditan
}

function same(a: AuditValue, b: AuditValue): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * `{ before, after }` solo con los campos que cambiaron. Sin `before` (alta) → solo `after`; sin
 * `after` (baja) → solo `before`. Devuelve null si no hay nada que registrar.
 *
 * @example summarizeChanges({ name: 'A', x: 1 }, { name: 'B', x: 1 }) → { before: { name: 'A' }, after: { name: 'B' } }
 */
export function summarizeChanges(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): AuditChanges | null {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const b: Record<string, AuditValue> = {};
  const a: Record<string, AuditValue> = {};
  for (const key of keys) {
    if (SENSITIVE_KEYS.test(key)) continue;
    const vb = before ? auditValue(before[key]) : undefined;
    const va = after ? auditValue(after[key]) : undefined;
    if (before && after) {
      if (!(key in after)) continue; // solo se compara lo que la acción tocó
      if (same(vb ?? null, va ?? null)) continue;
    }
    if (before && vb !== undefined) b[key] = vb;
    if (after && va !== undefined) a[key] = va;
  }
  const result: AuditChanges = {};
  if (Object.keys(b).length > 0) result.before = b;
  if (Object.keys(a).length > 0) result.after = a;
  return result.before || result.after ? result : null;
}
