import type { ApplicationStatus } from '../../../generated/prisma/client';
import {
  occupiesScholarshipSeat,
  offerQuotaState,
  quotaState,
  quotaViolation,
  SCHOLARSHIP_SEAT_STATUSES,
} from './scholarship-quota.policy';

describe('cupo de becas', () => {
  it('ocupan cupo: aprobadas (pago o confirmación) e inscritas; el resto no', () => {
    expect([...SCHOLARSHIP_SEAT_STATUSES].sort()).toEqual([
      'APPROVED_PENDING_CONFIRMATION',
      'APPROVED_PENDING_PAYMENT',
      'ENROLLED',
    ]);
    const free: ApplicationStatus[] = [
      'DRAFT',
      'SUBMITTED',
      'IN_REVIEW',
      'INTERVIEW_SCHEDULED',
      'NOT_SELECTED',
      'EXPIRED',
    ];
    for (const status of free) expect(occupiesScholarshipSeat(status)).toBe(false);
    expect(occupiesScholarshipSeat('ENROLLED')).toBe(true);
  });

  it('estado: ilimitado, con disponible, lleno y bajado por debajo de lo usado', () => {
    expect(quotaState(null, 7)).toEqual({
      maxRecipients: null,
      usedRecipients: 7,
      availableRecipients: null,
      isFull: false,
    });
    expect(quotaState(200, 15)).toMatchObject({ availableRecipients: 185, isFull: false });
    expect(quotaState(2, 2)).toMatchObject({ availableRecipients: 0, isFull: true });
    expect(quotaState(1, 3)).toMatchObject({ availableRecipients: 0, isFull: true });
  });

  it('en la oferta: mínimo entre el cupo global y el de la oferta', () => {
    const s = offerQuotaState({
      type: { maxRecipients: 200, usedRecipients: 190 },
      offer: { maxRecipients: 20, usedRecipients: 5 },
    });
    expect(s.availableRecipients).toBe(10);
    expect(
      offerQuotaState({
        type: { maxRecipients: null, usedRecipients: 0 },
        offer: { maxRecipients: null, usedRecipients: 0 },
      }),
    ).toMatchObject({ availableRecipients: null, isFull: false });
    expect(
      offerQuotaState({
        type: { maxRecipients: null, usedRecipients: 9 },
        offer: { maxRecipients: 3, usedRecipients: 3 },
      }),
    ).toMatchObject({ availableRecipients: 0, isFull: true });
  });

  it('violación: primero el tipo, luego la oferta; null si cabe', () => {
    const unlimited = { maxRecipients: null, usedRecipients: 0 };
    expect(quotaViolation({ type: unlimited, offer: unlimited })).toBeNull();
    expect(
      quotaViolation({ type: { maxRecipients: 2, usedRecipients: 1 }, offer: unlimited }),
    ).toBeNull();
    expect(
      quotaViolation({
        type: { maxRecipients: 2, usedRecipients: 2 },
        offer: { maxRecipients: 1, usedRecipients: 1 },
      }),
    ).toEqual({ scope: 'TYPE', maxRecipients: 2, used: 2 });
    expect(
      quotaViolation({ type: unlimited, offer: { maxRecipients: 1, usedRecipients: 1 } }),
    ).toEqual({ scope: 'OFFER', maxRecipients: 1, used: 1 });
  });
});
