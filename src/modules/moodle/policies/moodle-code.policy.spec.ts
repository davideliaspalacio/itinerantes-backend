import {
  accessCodeHint,
  decideAccessCode,
  generateAccessCode,
  hashAccessCode,
  normalizeAccessCode,
} from './moodle-code.policy';

describe('moodle-code.policy (HU-25)', () => {
  it('normaliza mayúsculas, espacios y guion', () => {
    expect(normalizeAccessCode(' k7qm-3xpa ')).toBe('K7QM-3XPA');
    expect(normalizeAccessCode('K7QM3XPA')).toBe('K7QM-3XPA');
    expect(normalizeAccessCode('K7QM-3XP')).toBeNull();
    expect(normalizeAccessCode('O0I1-LLLL')).toBeNull(); // caracteres ambiguos
  });

  it('genera códigos válidos; hash estable; pista de 4', () => {
    const code = generateAccessCode();
    expect(normalizeAccessCode(code)).toBe(code);
    expect(hashAccessCode(code)).toBe(hashAccessCode(code));
    expect(hashAccessCode(code)).toHaveLength(64);
    expect(accessCodeHint('K7QM-3XPA')).toBe('3XPA');
  });

  it('inválido, usado o vencido → error específico', () => {
    const now = new Date('2026-11-01T00:00:00Z');
    const ok = { usedAt: null, expiresAt: new Date('2026-12-01T00:00:00Z'), offerOrigin: 'MOODLE' };
    expect(decideAccessCode(ok, now)).toEqual({ ok: true });
    expect(decideAccessCode(null, now)).toEqual({ ok: false, code: 'MOODLE_CODE_INVALID' });
    expect(decideAccessCode({ ...ok, offerOrigin: 'NAS' }, now).ok).toBe(false);
    expect(decideAccessCode({ ...ok, usedAt: now }, now)).toEqual({
      ok: false,
      code: 'MOODLE_CODE_USED',
    });
    expect(decideAccessCode({ ...ok, expiresAt: now }, now)).toEqual({
      ok: false,
      code: 'MOODLE_CODE_EXPIRED',
    });
    expect(decideAccessCode({ ...ok, expiresAt: null }, now)).toEqual({ ok: true });
  });
});
