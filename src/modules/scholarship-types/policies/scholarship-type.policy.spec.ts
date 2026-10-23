import { testLink } from './scholarship-type.fixtures';
import {
  effectiveRange,
  isValidScholarshipTypeKey,
  percentRangeIssues,
  resolveAssignedPercent,
  scholarshipOptions,
  scholarshipPercentRange,
  suggestScholarshipTypeKey,
  summaryInOffer,
} from './scholarship-type.policy';

describe('tipos de beca parametrizables', () => {
  it('clave MAYÚSCULAS_CON_GUION_BAJO', () => {
    expect(isValidScholarshipTypeKey('AGUA_VIVA')).toBe(true);
    expect(isValidScholarshipTypeKey('BECA_2027')).toBe(true);
    expect(isValidScholarshipTypeKey('agua_viva')).toBe(false);
    expect(isValidScholarshipTypeKey('_AGUA')).toBe(false);
    expect(isValidScholarshipTypeKey('AGUA__VIVA')).toBe(false);
    expect(isValidScholarshipTypeKey('AGUA-VIVA')).toBe(false);
    expect(isValidScholarshipTypeKey('2AGUA')).toBe(false);
    expect(isValidScholarshipTypeKey('A'.repeat(41))).toBe(false);
  });

  it('sugiere una clave desde el nombre', () => {
    expect(suggestScholarshipTypeKey('Ríos Vivos')).toBe('RIOS_VIVOS');
    expect(suggestScholarshipTypeKey('  Beca especial (2027) ')).toBe('BECA_ESPECIAL_2027');
    expect(isValidScholarshipTypeKey(suggestScholarshipTypeKey('Ñandú 50%'))).toBe(true);
  });

  it('rango 1 ≤ min ≤ max ≤ 100', () => {
    expect(percentRangeIssues(10, 10)).toEqual([]);
    expect(percentRangeIssues(1, 100)).toEqual([]);
    expect(percentRangeIssues(0, 10).map((i) => i.field)).toEqual(['minPercent']);
    expect(percentRangeIssues(10, 101).map((i) => i.field)).toEqual(['maxPercent']);
    expect(percentRangeIssues(80, 71)).toEqual([
      expect.objectContaining({ field: 'maxPercent', code: 'INVALID' }),
    ]);
    expect(percentRangeIssues(10.5, 20).map((i) => i.field)).toEqual(['minPercent']);
  });

  it('rango efectivo: override de la oferta (parcial o total) o el del tipo', () => {
    expect(effectiveRange(testLink('SPECIAL'))).toEqual({ minPercent: 71, maxPercent: 80 });
    expect(effectiveRange(testLink('SPECIAL', { minPercent: 75 }))).toEqual({
      minPercent: 75,
      maxPercent: 80,
    });
    expect(effectiveRange(testLink('SPECIAL', { minPercent: 72, maxPercent: 74 }))).toEqual({
      minPercent: 72,
      maxPercent: 74,
    });
  });

  it('opciones: solo activas por defecto, ordenadas por sortOrder (de la oferta o del tipo)', () => {
    const links = [
      testLink('SPECIAL'),
      testLink('AGUA_VIVA', { active: false }),
      testLink('RIOS_VIVOS', { sortOrder: 9 }),
      testLink('AGUAS_LIBRES', { maxPercent: 55 }),
    ];
    const active = scholarshipOptions(links);
    expect(active.map((o) => o.key)).toEqual(['AGUAS_LIBRES', 'SPECIAL', 'RIOS_VIVOS']);
    expect(active[0]).toMatchObject({ minPercent: 50, maxPercent: 55, rangeOverridden: true });
    expect(active[1].rangeOverridden).toBe(false);
    expect(scholarshipOptions(links, { activeOnly: false }).map((o) => o.key)).toEqual([
      'AGUA_VIVA',
      'AGUAS_LIBRES',
      'SPECIAL',
      'RIOS_VIVOS',
    ]);
  });

  it('badge "10%–80%"', () => {
    const all = ['AGUA_VIVA', 'RIOS_VIVOS', 'AGUAS_LIBRES', 'CENOTES_VIVOS', 'SPECIAL'].map((k) =>
      testLink(k),
    );
    expect(scholarshipPercentRange(scholarshipOptions(all))).toEqual({
      minPercent: 10,
      maxPercent: 80,
    });
    expect(
      scholarshipPercentRange(
        scholarshipOptions([testLink('RIOS_VIVOS'), testLink('AGUAS_LIBRES')]),
      ),
    ).toEqual({ minPercent: 25, maxPercent: 50 });
    expect(scholarshipPercentRange([])).toBeNull();
  });

  it('resumen en la oferta: rango efectivo aunque el tipo esté desactivado', () => {
    const special = testLink('SPECIAL', { minPercent: 75, active: false });
    expect(summaryInOffer(special.scholarshipType, [special])).toEqual({
      id: 'st-SPECIAL',
      key: 'SPECIAL',
      name: 'Beca especial',
      minPercent: 75,
      maxPercent: 80,
      requiresInterview: true,
    });
    // No habilitado en la oferta → rango propio del tipo.
    expect(summaryInOffer(special.scholarshipType, [])?.minPercent).toBe(71);
    expect(summaryInOffer(null, [special])).toBeNull();
  });

  describe('% asignado por el comité (HU-31)', () => {
    const [fixed] = scholarshipOptions([testLink('AGUAS_LIBRES')]);
    const [special] = scholarshipOptions([testLink('SPECIAL')]);
    const [narrowed] = scholarshipOptions([
      testLink('SPECIAL', { minPercent: 75, maxPercent: 78 }),
    ]);

    it('rango fijo → se toma solo; otro % → error', () => {
      expect(resolveAssignedPercent(fixed)).toEqual({ ok: true, percent: 50 });
      expect(resolveAssignedPercent(fixed, 50)).toEqual({ ok: true, percent: 50 });
      expect(resolveAssignedPercent(fixed, 60).ok).toBe(false);
    });

    it('rango variable → entero dentro del rango efectivo', () => {
      expect(resolveAssignedPercent(special, 75)).toEqual({ ok: true, percent: 75 });
      expect(resolveAssignedPercent(special, 71)).toEqual({ ok: true, percent: 71 });
      expect(resolveAssignedPercent(special, 70).ok).toBe(false);
      expect(resolveAssignedPercent(special, 81).ok).toBe(false);
      expect(resolveAssignedPercent(special, 72.5).ok).toBe(false);
      expect(resolveAssignedPercent(special).ok).toBe(false);
      expect(resolveAssignedPercent(narrowed, 74).ok).toBe(false);
      expect(resolveAssignedPercent(narrowed, 76)).toEqual({ ok: true, percent: 76 });
    });

    it('tipo no habilitado en la oferta → error', () => {
      expect(resolveAssignedPercent(null, 50)).toEqual({
        ok: false,
        message: 'El tipo de beca no está habilitado en esta oferta.',
      });
    });
  });
});
