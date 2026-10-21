import { OfferAvailability } from '../../offers/policies/offer-status.policy';
import {
  decideBalancePayment,
  decideEnrollmentCheckout,
  type EnrollmentCheckoutInput,
} from './checkout.policy';

describe('checkout.policy (HU-22/23)', () => {
  const base: EnrollmentCheckoutInput = {
    type: 'DIPLOMA',
    origin: 'NAS',
    isFree: false,
    availability: OfferAvailability.ENROLLMENT_OPEN,
    enrollmentOpensAt: null,
    hasPrice: true,
    soldOut: false,
    existingEnrollmentStatus: null,
    applicationStatus: null,
  };

  it('NAS abierta con precio y cupo → ok', () => {
    expect(decideEnrollmentCheckout(base)).toEqual({ ok: true });
    expect(decideEnrollmentCheckout({ ...base, existingEnrollmentStatus: 'CANCELLED' })).toEqual({
      ok: true,
    });
    expect(
      decideEnrollmentCheckout({ ...base, existingEnrollmentStatus: 'PENDING_PAYMENT' }),
    ).toEqual({ ok: true }); // continuar / reemplazar su checkout
  });

  it('ya inscrito (también suspendido) → ENROLLMENT_ALREADY_EXISTS', () => {
    for (const status of ['ACTIVE', 'COMPLETED', 'SUSPENDED'] as const) {
      expect(decideEnrollmentCheckout({ ...base, existingEnrollmentStatus: status })).toMatchObject(
        {
          ok: false,
          code: 'ENROLLMENT_ALREADY_EXISTS',
        },
      );
    }
  });

  it('Moodle, convocatoria, gratuita, saldo pendiente o sin precio → PAYMENT_NOT_ALLOWED', () => {
    const reason = (input: Partial<EnrollmentCheckoutInput>) => {
      const d = decideEnrollmentCheckout({ ...base, ...input });
      return d.ok ? null : d.code === 'PAYMENT_NOT_ALLOWED' ? d.meta.reason : d.code;
    };
    expect(reason({ origin: 'MOODLE' })).toBe('MOODLE');
    expect(reason({ type: 'OPEN_CALL' })).toBe('OPEN_CALL');
    expect(reason({ isFree: true })).toBe('FREE');
    expect(reason({ applicationStatus: 'APPROVED_PENDING_PAYMENT' })).toBe('PAY_BALANCE');
    expect(reason({ hasPrice: false })).toBe('PRICE_NOT_AVAILABLE');
  });

  it('cerradas / próximamente / finalizada / cupo agotado', () => {
    expect(
      decideEnrollmentCheckout({ ...base, availability: OfferAvailability.ENROLLMENT_CLOSED }),
    ).toMatchObject({ code: 'ENROLLMENT_CLOSED', meta: { reason: 'ENROLLMENT_CLOSED' } });
    expect(
      decideEnrollmentCheckout({ ...base, availability: OfferAvailability.UPCOMING }),
    ).toMatchObject({ code: 'ENROLLMENT_CLOSED', meta: { reason: 'ENROLLMENT_NOT_OPEN_YET' } });
    expect(decideEnrollmentCheckout({ ...base, soldOut: true })).toMatchObject({
      code: 'OFFER_SOLD_OUT',
    });
  });

  it('saldo tras beca: solo aprobada con saldo, en plazo y sin comprobante pendiente', () => {
    const now = new Date('2026-11-05T12:00:00Z');
    const ok = {
      status: 'APPROVED_PENDING_PAYMENT' as const,
      balanceCents: 510_000,
      hasCurrency: true,
      responseDueAt: new Date('2026-11-10T12:00:00Z'),
      pendingTransfer: false,
      now,
    };
    expect(decideBalancePayment(ok)).toEqual({ ok: true });
    expect(decideBalancePayment({ ...ok, status: 'ENROLLED' })).toMatchObject({
      code: 'PAYMENT_BALANCE_NOT_DUE',
    });
    expect(decideBalancePayment({ ...ok, balanceCents: 0 })).toMatchObject({
      code: 'PAYMENT_BALANCE_NOT_DUE',
    });
    expect(decideBalancePayment({ ...ok, responseDueAt: now })).toMatchObject({
      code: 'APPLICATION_DEADLINE_PASSED',
    });
    expect(decideBalancePayment({ ...ok, pendingTransfer: true })).toMatchObject({
      code: 'PAYMENT_TRANSFER_PENDING',
    });
  });
});
