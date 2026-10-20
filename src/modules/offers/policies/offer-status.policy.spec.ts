import {
  availabilitySortRank,
  deriveOfferAvailability,
  deriveOpenCallStatus,
  isPubliclyVisible,
  type OfferDates,
} from './offer-status.policy';

const d = (iso: string) => new Date(iso);
const diploma: OfferDates = {
  enrollmentOpensAt: d('2026-09-01T06:00:00Z'),
  enrollmentClosesAt: d('2026-11-06T06:00:00Z'),
  startsAt: d('2026-11-07T16:00:00Z'),
  endsAt: d('2027-01-31T19:00:00Z'),
};

describe('deriveOfferAvailability (HU-15 / HU-27)', () => {
  it.each([
    ['2026-08-15T00:00:00Z', 'UPCOMING'],
    ['2026-09-01T06:00:00Z', 'ENROLLMENT_OPEN'],
    ['2026-10-20T12:00:00Z', 'ENROLLMENT_OPEN'],
    ['2026-11-06T06:00:00Z', 'ENROLLMENT_CLOSED'],
    ['2026-12-15T00:00:00Z', 'ENROLLMENT_CLOSED'],
    ['2027-01-31T19:00:00Z', 'ENROLLMENT_CLOSED'],
    ['2027-02-01T00:00:00Z', 'FINISHED'],
  ])('en %s → %s', (now, expected) => {
    expect(deriveOfferAvailability(diploma, d(now))).toBe(expected);
  });

  it('sin cierre de inscripciones: cierra al iniciar la oferta', () => {
    const dates = { ...diploma, enrollmentClosesAt: null };
    expect(deriveOfferAvailability(dates, d('2026-11-07T15:59:59Z'))).toBe('ENROLLMENT_OPEN');
    expect(deriveOfferAvailability(dates, d('2026-11-07T16:00:00Z'))).toBe('ENROLLMENT_CLOSED');
  });

  it('sin apertura: abierta hasta el cierre', () => {
    const dates = { ...diploma, enrollmentOpensAt: null };
    expect(deriveOfferAvailability(dates, d('2026-01-01T00:00:00Z'))).toBe('ENROLLMENT_OPEN');
  });

  it('sin fechas programadas → Próximamente', () => {
    const none = {
      enrollmentOpensAt: null,
      enrollmentClosesAt: null,
      startsAt: null,
      endsAt: null,
    };
    expect(deriveOfferAvailability(none, d('2026-10-20T00:00:00Z'))).toBe('UPCOMING');
  });
});

describe('deriveOpenCallStatus', () => {
  it('solo aplica a convocatorias', () => {
    expect(deriveOpenCallStatus('DIPLOMA', 'ENROLLMENT_OPEN')).toBeNull();
    expect(deriveOpenCallStatus('OPEN_CALL', 'ENROLLMENT_OPEN')).toBe('OPEN');
    expect(deriveOpenCallStatus('OPEN_CALL', 'UPCOMING')).toBe('UPCOMING');
    expect(deriveOpenCallStatus('OPEN_CALL', 'ENROLLMENT_CLOSED')).toBe('CLOSED');
    expect(deriveOpenCallStatus('OPEN_CALL', 'FINISHED')).toBe('CLOSED');
  });
});

describe('visibilidad y orden', () => {
  it('el catálogo nunca muestra borradores ni archivadas', () => {
    expect(isPubliclyVisible('PUBLISHED')).toBe(true);
    expect(isPubliclyVisible('DRAFT')).toBe(false);
    expect(isPubliclyVisible('ARCHIVED')).toBe(false);
  });

  it('cerradas y finalizadas al final', () => {
    expect(availabilitySortRank('ENROLLMENT_OPEN')).toBe(availabilitySortRank('UPCOMING'));
    expect(availabilitySortRank('UPCOMING')).toBeLessThan(
      availabilitySortRank('ENROLLMENT_CLOSED'),
    );
    expect(availabilitySortRank('ENROLLMENT_CLOSED')).toBeLessThan(
      availabilitySortRank('FINISHED'),
    );
  });
});
