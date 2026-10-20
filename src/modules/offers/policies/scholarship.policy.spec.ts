import {
  estimateScholarshipLevels,
  offersScholarship,
  scholarshipPercentRange,
} from './scholarship.policy';

describe('beca (HU-16 / HU-19)', () => {
  const allLevels = [
    'SPECIAL',
    'AGUA_VIVA',
    'RIOS_VIVOS',
    'AGUAS_LIBRES',
    'CENOTES_VIVOS',
  ] as const;

  it('solo diplomados NAS con beca habilitada y niveles', () => {
    const base = {
      type: 'DIPLOMA' as const,
      origin: 'NAS' as const,
      scholarshipEnabled: true,
      scholarshipLevels: ['AGUA_VIVA' as const],
    };
    expect(offersScholarship(base)).toBe(true);
    expect(offersScholarship({ ...base, type: 'COURSE' })).toBe(false);
    expect(offersScholarship({ ...base, type: 'OPEN_CALL' })).toBe(false);
    expect(offersScholarship({ ...base, origin: 'MOODLE' })).toBe(false);
    expect(offersScholarship({ ...base, scholarshipEnabled: false })).toBe(false);
    expect(offersScholarship({ ...base, scholarshipLevels: [] })).toBe(false);
  });

  it('rango del badge 10%–80%', () => {
    expect(scholarshipPercentRange([...allLevels])).toEqual({ minPercent: 10, maxPercent: 80 });
    expect(scholarshipPercentRange(['RIOS_VIVOS', 'AGUAS_LIBRES'])).toEqual({
      minPercent: 25,
      maxPercent: 50,
    });
    expect(scholarshipPercentRange([])).toBeNull();
  });

  it('montos estimados por nivel en MXN ($10,200) en orden canónico', () => {
    const levels = estimateScholarshipLevels([...allLevels], 1_020_000, 'MXN');
    expect(levels.map((l) => l.level)).toEqual([
      'AGUA_VIVA',
      'RIOS_VIVOS',
      'AGUAS_LIBRES',
      'CENOTES_VIVOS',
      'SPECIAL',
    ]);
    expect(levels[0]).toMatchObject({
      label: 'Agua Viva',
      minPercent: 10,
      maxPercent: 10,
      requiresInterview: false,
      estimatedScholarship: { minAmountCents: 102_000, maxAmountCents: 102_000, currency: 'MXN' },
      estimatedBalance: { minAmountCents: 918_000, maxAmountCents: 918_000, currency: 'MXN' },
    });
    expect(levels[3].requiresInterview).toBe(false);
    expect(levels[4]).toMatchObject({
      label: 'Beca especial',
      minPercent: 71,
      maxPercent: 80,
      requiresInterview: true,
      estimatedScholarship: { minAmountCents: 724_200, maxAmountCents: 816_000 },
      estimatedBalance: { minAmountCents: 204_000, maxAmountCents: 295_800 },
    });
  });

  it('USD $585 redondea al centavo', () => {
    const [rios] = estimateScholarshipLevels(['RIOS_VIVOS'], 58_500, 'USD');
    expect(rios.estimatedScholarship).toEqual({
      minAmountCents: 14_625,
      maxAmountCents: 14_625,
      currency: 'USD',
    });
  });

  it('sin precio en la moneda → montos null', () => {
    const [level] = estimateScholarshipLevels(['AGUA_VIVA'], null, 'USD');
    expect(level.estimatedScholarship).toBeNull();
    expect(level.estimatedBalance).toBeNull();
  });
});
