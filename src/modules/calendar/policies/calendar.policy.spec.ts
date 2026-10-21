import {
  compareCalendarItems,
  isEventVisibleTo,
  matchesCategories,
  overlapsRange,
  validateCalendarRange,
} from './calendar.policy';

const d = (iso: string) => new Date(iso);

describe('validateCalendarRange', () => {
  it('acepta un mes con semanas de relleno', () => {
    expect(validateCalendarRange(d('2026-10-26T06:00Z'), d('2026-12-07T06:00Z'))).toBeNull();
  });
  it('rechaza rangos invertidos o demasiado largos', () => {
    expect(validateCalendarRange(d('2026-11-02T00:00Z'), d('2026-11-01T00:00Z'))?.code).toBe(
      'INVALID_RANGE',
    );
    expect(validateCalendarRange(d('2026-01-01T00:00Z'), d('2026-06-01T00:00Z'))?.code).toBe(
      'RANGE_TOO_LARGE',
    );
  });
});

describe('isEventVisibleTo (HU-10 audiencia)', () => {
  const enrolled = new Set(['offer-a']);
  it('ALL_REGISTERED general: visible para todas las personas', () => {
    expect(
      isEventVisibleTo(
        { audience: 'ALL_REGISTERED', offerId: null, offerPublished: null },
        enrolled,
      ),
    ).toBe(true);
  });
  it('fecha importante de oferta: solo si la oferta está publicada', () => {
    expect(
      isEventVisibleTo(
        { audience: 'ALL_REGISTERED', offerId: 'x', offerPublished: true },
        enrolled,
      ),
    ).toBe(true);
    expect(
      isEventVisibleTo(
        { audience: 'ALL_REGISTERED', offerId: 'x', offerPublished: false },
        enrolled,
      ),
    ).toBe(false);
  });
  it('OFFER_ENROLLED: solo inscritos de esa oferta', () => {
    expect(
      isEventVisibleTo(
        { audience: 'OFFER_ENROLLED', offerId: 'offer-a', offerPublished: true },
        enrolled,
      ),
    ).toBe(true);
    expect(
      isEventVisibleTo(
        { audience: 'OFFER_ENROLLED', offerId: 'offer-b', offerPublished: true },
        enrolled,
      ),
    ).toBe(false);
    expect(
      isEventVisibleTo(
        { audience: 'OFFER_ENROLLED', offerId: null, offerPublished: null },
        enrolled,
      ),
    ).toBe(false);
  });
});

describe('overlapsRange', () => {
  const from = d('2026-11-01T06:00Z');
  const to = d('2026-12-01T06:00Z');
  it('incluye eventos dentro o que cruzan el borde', () => {
    expect(overlapsRange(d('2026-11-07T16:00Z'), d('2026-11-07T19:00Z'), from, to)).toBe(true);
    expect(overlapsRange(d('2026-10-31T23:00Z'), d('2026-11-01T07:00Z'), from, to)).toBe(true);
    expect(overlapsRange(d('2026-11-05T00:00Z'), null, from, to)).toBe(true);
  });
  it('excluye fuera del rango (fin exclusivo)', () => {
    expect(overlapsRange(d('2026-12-01T06:00Z'), null, from, to)).toBe(false);
    expect(overlapsRange(d('2026-10-01T00:00Z'), d('2026-10-02T00:00Z'), from, to)).toBe(false);
  });
});

describe('compareCalendarItems / matchesCategories', () => {
  it('ordena por inicio, día completo primero y luego título', () => {
    const items = [
      { startsAt: d('2026-11-07T16:00Z'), allDay: false, title: 'B' },
      { startsAt: d('2026-11-07T16:00Z'), allDay: true, title: 'Z' },
      { startsAt: d('2026-11-06T16:00Z'), allDay: false, title: 'A' },
    ];
    expect([...items].sort(compareCalendarItems).map((i) => i.title)).toEqual(['A', 'Z', 'B']);
  });
  it('sin filtro: todas las categorías', () => {
    expect(matchesCategories('TRAINING', undefined)).toBe(true);
    expect(matchesCategories('TRAINING', ['EVENTS'])).toBe(false);
    expect(matchesCategories('EVENTS', ['EVENTS', 'COMMUNITY'])).toBe(true);
  });
});
