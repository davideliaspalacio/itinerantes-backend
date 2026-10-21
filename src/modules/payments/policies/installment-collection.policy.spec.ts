import { addDaysInZone, cdmxToUtc } from '../../../common/utils/time';
import {
  daysSinceFailure,
  delinquencyDueAt,
  isDelinquent,
  isUpcomingNoticeDue,
  maxChargeAttempts,
  nextRetryAt,
  retryOffsetsDays,
} from './installment-collection.policy';

describe('installment-collection.policy (HU-24 reintentos y mora)', () => {
  const failed = cdmxToUtc('2026-12-01', '09:00');

  it('3 reintentos repartidos en 7 días: días 3, 5 y 7', () => {
    expect(retryOffsetsDays()).toEqual([3, 5, 7]);
    expect(retryOffsetsDays(2, 6)).toEqual([3, 6]);
    expect(retryOffsetsDays(0, 7)).toEqual([]);
    expect(maxChargeAttempts()).toBe(4);
  });

  it('próximo reintento según intentos hechos; agotados → null', () => {
    expect(nextRetryAt(failed, 1)).toEqual(addDaysInZone(failed, 3));
    expect(nextRetryAt(failed, 2)).toEqual(addDaysInZone(failed, 5));
    expect(nextRetryAt(failed, 3)).toEqual(addDaysInZone(failed, 7));
    expect(nextRetryAt(failed, 4)).toBeNull();
    expect(nextRetryAt(failed, 0)).toBeNull();
  });

  it('mora a los 15 días del primer fallo', () => {
    expect(delinquencyDueAt(failed)).toEqual(addDaysInZone(failed, 15));
    expect(isDelinquent(failed, addDaysInZone(failed, 14))).toBe(false);
    expect(isDelinquent(failed, addDaysInZone(failed, 15))).toBe(true);
    expect(isDelinquent(null, addDaysInZone(failed, 30))).toBe(false);
    expect(daysSinceFailure(failed, addDaysInZone(failed, 4))).toBe(4);
    expect(daysSinceFailure(null, failed)).toBeNull();
  });

  it('aviso de cuota próxima: desde 7 días antes y antes del cobro', () => {
    const due = cdmxToUtc('2026-12-10', '10:00');
    expect(isUpcomingNoticeDue(due, addDaysInZone(due, -8))).toBe(false);
    expect(isUpcomingNoticeDue(due, addDaysInZone(due, -7))).toBe(true);
    expect(isUpcomingNoticeDue(due, addDaysInZone(due, -1))).toBe(true);
    expect(isUpcomingNoticeDue(due, due)).toBe(false);
  });
});
