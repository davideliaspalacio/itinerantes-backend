import { buildImportantDates } from './important-dates.policy';

describe('buildImportantDates (HU-29)', () => {
  it('genera solo las fechas existentes con su audiencia', () => {
    const dates = buildImportantDates({
      name: 'Diplomado',
      type: 'DIPLOMA',
      enrollmentClosesAt: new Date('2026-11-06T05:59:59Z'),
      startsAt: new Date('2026-11-07T16:00:00Z'),
      scholarshipClosesAt: null,
      finalProjectDueAt: new Date('2027-02-27T16:00:00Z'),
    });
    expect(dates.map((d) => [d.kind, d.audience])).toEqual([
      ['ENROLLMENT_CLOSES', 'ALL_REGISTERED'],
      ['OFFER_STARTS', 'OFFER_ENROLLED'],
      ['FINAL_PROJECT', 'OFFER_ENROLLED'],
    ]);
    expect(dates[0].title).toBe('Cierre de inscripciones: Diplomado');
  });

  it('convocatoria: "Cierre de convocatoria"', () => {
    const [close] = buildImportantDates({
      name: 'Siembra de Agua',
      type: 'OPEN_CALL',
      enrollmentClosesAt: new Date('2026-12-15T05:59:59Z'),
      startsAt: null,
      scholarshipClosesAt: null,
      finalProjectDueAt: null,
    });
    expect(close.title).toBe('Cierre de convocatoria: Siembra de Agua');
  });
});
