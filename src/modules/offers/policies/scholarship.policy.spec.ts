import { testLink } from '../../scholarship-types/policies/scholarship-type.fixtures';
import { estimateScholarshipTypes, offersScholarship } from './scholarship.policy';

describe('beca (HU-16 / HU-19)', () => {
  const allTypes = ['SPECIAL', 'AGUA_VIVA', 'RIOS_VIVOS', 'AGUAS_LIBRES', 'CENOTES_VIVOS'].map(
    (key) => testLink(key),
  );

  it('solo diplomados NAS con beca habilitada y al menos un tipo activo', () => {
    const base = {
      type: 'DIPLOMA' as const,
      origin: 'NAS' as const,
      scholarshipEnabled: true,
      scholarshipTypes: [testLink('AGUA_VIVA')],
    };
    expect(offersScholarship(base)).toBe(true);
    expect(offersScholarship({ ...base, type: 'COURSE' })).toBe(false);
    expect(offersScholarship({ ...base, type: 'OPEN_CALL' })).toBe(false);
    expect(offersScholarship({ ...base, origin: 'MOODLE' })).toBe(false);
    expect(offersScholarship({ ...base, scholarshipEnabled: false })).toBe(false);
    expect(offersScholarship({ ...base, scholarshipTypes: [] })).toBe(false);
    expect(
      offersScholarship({ ...base, scholarshipTypes: [testLink('AGUA_VIVA', { active: false })] }),
    ).toBe(false);
  });

  it('montos estimados por tipo en MXN ($10,200) ordenados por sortOrder', () => {
    const types = estimateScholarshipTypes(allTypes, 1_020_000, 'MXN');
    expect(types.map((t) => t.scholarshipType.key)).toEqual([
      'AGUA_VIVA',
      'RIOS_VIVOS',
      'AGUAS_LIBRES',
      'CENOTES_VIVOS',
      'SPECIAL',
    ]);
    expect(types[0]).toMatchObject({
      scholarshipTypeId: 'st-AGUA_VIVA',
      scholarshipType: {
        name: 'Agua Viva',
        minPercent: 10,
        maxPercent: 10,
        requiresInterview: false,
      },
      estimatedScholarship: { minAmountCents: 102_000, maxAmountCents: 102_000, currency: 'MXN' },
      estimatedBalance: { minAmountCents: 918_000, maxAmountCents: 918_000, currency: 'MXN' },
    });
    expect(types[3].scholarshipType.requiresInterview).toBe(false);
    expect(types[4]).toMatchObject({
      scholarshipType: {
        name: 'Beca especial',
        minPercent: 71,
        maxPercent: 80,
        requiresInterview: true,
      },
      estimatedScholarship: { minAmountCents: 724_200, maxAmountCents: 816_000 },
      estimatedBalance: { minAmountCents: 204_000, maxAmountCents: 295_800 },
    });
  });

  it('usa el rango propio de la oferta y omite los tipos desactivados', () => {
    const types = estimateScholarshipTypes(
      [
        testLink('SPECIAL', { minPercent: 75, maxPercent: 78 }),
        testLink('AGUA_VIVA', { active: false }),
      ],
      1_000_000,
      'MXN',
    );
    expect(types).toHaveLength(1);
    expect(types[0].scholarshipType).toMatchObject({ minPercent: 75, maxPercent: 78 });
    expect(types[0].estimatedScholarship).toMatchObject({
      minAmountCents: 750_000,
      maxAmountCents: 780_000,
    });
  });

  it('USD $585 redondea al centavo', () => {
    const [rios] = estimateScholarshipTypes([testLink('RIOS_VIVOS')], 58_500, 'USD');
    expect(rios.estimatedScholarship).toEqual({
      minAmountCents: 14_625,
      maxAmountCents: 14_625,
      currency: 'USD',
    });
  });

  it('sin precio en la moneda → montos null', () => {
    const [type] = estimateScholarshipTypes([testLink('AGUA_VIVA')], null, 'USD');
    expect(type.estimatedScholarship).toBeNull();
    expect(type.estimatedBalance).toBeNull();
  });
});
