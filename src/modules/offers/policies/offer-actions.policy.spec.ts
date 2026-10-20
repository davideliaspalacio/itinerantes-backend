import { computeOfferActions, type OfferActionsInput, windowState } from './offer-actions.policy';

const opensAt = new Date('2026-12-01T06:00:00Z');
const base: OfferActionsInput = {
  type: 'DIPLOMA',
  origin: 'NAS',
  isFree: false,
  availability: 'ENROLLMENT_OPEN',
  enrollmentOpensAt: null,
  installmentsEnabled: true,
  scholarshipOffered: true,
  scholarshipWindow: 'OPEN',
  scholarshipOpensAt: null,
  hasPriceInCurrency: true,
  soldOut: false,
  viewer: { authenticated: true, enrolled: false },
};
const summary = (input: OfferActionsInput) =>
  computeOfferActions(input).map((a) => [a.type, a.enabled, a.reason]);

describe('computeOfferActions (HU-16)', () => {
  it('diplomado NAS abierto: pagar (primario), cuotas y beca', () => {
    const actions = computeOfferActions(base);
    expect(summary(base)).toEqual([
      ['ENROLL_AND_PAY', true, null],
      ['PAY_IN_INSTALLMENTS', true, null],
      ['APPLY_SCHOLARSHIP', true, null],
    ]);
    expect(actions.filter((a) => a.primary).map((a) => a.type)).toEqual(['ENROLL_AND_PAY']);
    expect(actions.every((a) => !a.requiresLogin)).toBe(true);
  });

  it('sin sesión: mismas acciones con requiresLogin', () => {
    const actions = computeOfferActions({
      ...base,
      viewer: { authenticated: false, enrolled: false },
    });
    expect(actions.every((a) => a.requiresLogin)).toBe(true);
  });

  it('inscrito → solo Ir a mi aula', () => {
    expect(summary({ ...base, viewer: { authenticated: true, enrolled: true } })).toEqual([
      ['GO_TO_CLASSROOM', true, null],
    ]);
  });

  it('Moodle → solo activar acceso, sin compra ni beca', () => {
    expect(summary({ ...base, origin: 'MOODLE' })).toEqual([
      ['ACTIVATE_MOODLE_ACCESS', true, null],
    ]);
  });

  it('convocatoria → solo Postular, según su ventana', () => {
    const call = { ...base, type: 'OPEN_CALL' as const, scholarshipOffered: false };
    expect(summary(call)).toEqual([['APPLY_OPEN_CALL', true, null]]);
    expect(summary({ ...call, availability: 'ENROLLMENT_CLOSED' })).toEqual([
      ['APPLY_OPEN_CALL', false, 'ENROLLMENT_CLOSED'],
    ]);
  });

  it('próximamente: deshabilitadas con fecha de apertura', () => {
    const actions = computeOfferActions({
      ...base,
      availability: 'UPCOMING',
      enrollmentOpensAt: opensAt,
      scholarshipWindow: 'UPCOMING',
      scholarshipOpensAt: opensAt,
    });
    expect(actions.map((a) => [a.type, a.enabled, a.reason, a.availableFrom])).toEqual([
      ['ENROLL_AND_PAY', false, 'ENROLLMENT_NOT_OPEN_YET', opensAt],
      ['PAY_IN_INSTALLMENTS', false, 'ENROLLMENT_NOT_OPEN_YET', opensAt],
      ['APPLY_SCHOLARSHIP', false, 'SCHOLARSHIP_NOT_OPEN_YET', opensAt],
    ]);
  });

  it('cupo agotado y finalizada', () => {
    expect(summary({ ...base, soldOut: true })).toEqual([
      ['ENROLL_AND_PAY', false, 'SOLD_OUT'],
      ['PAY_IN_INSTALLMENTS', false, 'SOLD_OUT'],
      ['APPLY_SCHOLARSHIP', false, 'SOLD_OUT'],
    ]);
    expect(summary({ ...base, availability: 'FINISHED' })).toEqual([
      ['ENROLL_AND_PAY', false, 'OFFER_FINISHED'],
      ['PAY_IN_INSTALLMENTS', false, 'OFFER_FINISHED'],
      ['APPLY_SCHOLARSHIP', false, 'OFFER_FINISHED'],
    ]);
  });

  it('convocatoria de becas cerrada no bloquea el pago', () => {
    expect(summary({ ...base, scholarshipWindow: 'CLOSED' })).toEqual([
      ['ENROLL_AND_PAY', true, null],
      ['PAY_IN_INSTALLMENTS', true, null],
      ['APPLY_SCHOLARSHIP', false, 'SCHOLARSHIP_CLOSED'],
    ]);
  });

  it('curso sin cuotas ni beca; gratuito; sin precio en la moneda', () => {
    const course = {
      ...base,
      type: 'COURSE' as const,
      installmentsEnabled: false,
      scholarshipOffered: false,
    };
    expect(summary(course)).toEqual([['ENROLL_AND_PAY', true, null]]);
    expect(summary({ ...course, isFree: true })).toEqual([['ENROLL_FREE', true, null]]);
    expect(summary({ ...course, hasPriceInCurrency: false })).toEqual([
      ['ENROLL_AND_PAY', false, 'PRICE_NOT_AVAILABLE'],
    ]);
  });

  it('windowState', () => {
    const now = new Date('2026-10-20T00:00:00Z');
    expect(windowState(null, null, now)).toBe('OPEN');
    expect(windowState(opensAt, null, now)).toBe('UPCOMING');
    expect(windowState(null, new Date('2026-10-19T00:00:00Z'), now)).toBe('CLOSED');
  });
});
