const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/**
 * Convierte una duración corta a segundos: `900` → 900, `15m` → 900, `1h` → 3600, `7d` → 604800.
 * @throws Error si el formato no es válido.
 */
export function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)([smhd]?)$/.exec(value.trim());
  if (!match) throw new Error(`Duración inválida: "${value}"`);
  const [, amount, unit] = match;
  return Number(amount) * UNIT_SECONDS[unit || 's'];
}
