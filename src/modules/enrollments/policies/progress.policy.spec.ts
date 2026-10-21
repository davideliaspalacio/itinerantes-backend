import { computeProgress, nextSession } from './progress.policy';

const at = (iso: string) => new Date(iso);

describe('computeProgress (HU-07 / HU-17)', () => {
  it('asistidas ÷ programadas, sin canceladas', () => {
    const sessions = [
      { id: 'a', status: 'SCHEDULED' as const },
      { id: 'b', status: 'SCHEDULED' as const },
      { id: 'c', status: 'CANCELLED' as const },
      { id: 'd', status: 'SCHEDULED' as const },
    ];
    expect(computeProgress(sessions, new Set(['a', 'c']))).toEqual({
      attendedSessions: 1,
      scheduledSessions: 3,
      percent: 33,
    });
  });

  it('sin sesiones → 0%', () => {
    expect(computeProgress([], new Set())).toEqual({
      attendedSessions: 0,
      scheduledSessions: 0,
      percent: 0,
    });
  });

  it('todas asistidas → 100%', () => {
    expect(computeProgress([{ id: 'a', status: 'SCHEDULED' }], new Set(['a'])).percent).toBe(100);
  });
});

describe('nextSession', () => {
  const now = at('2026-11-07T17:00:00Z');
  const s = (id: string, start: string, end: string, status: 'SCHEDULED' | 'CANCELLED') => ({
    id,
    status,
    startsAt: at(start),
    endsAt: at(end),
  });

  it('elige la sesión en curso o la futura más cercana, ignorando canceladas', () => {
    const sessions = [
      s('future', '2026-11-08T16:00:00Z', '2026-11-08T19:00:00Z', 'SCHEDULED'),
      s('cancelled', '2026-11-07T18:00:00Z', '2026-11-07T19:30:00Z', 'CANCELLED'),
      s('current', '2026-11-07T16:00:00Z', '2026-11-07T19:00:00Z', 'SCHEDULED'),
      s('past', '2026-11-01T16:00:00Z', '2026-11-01T19:00:00Z', 'SCHEDULED'),
    ];
    expect(nextSession(sessions, now)?.id).toBe('current');
  });

  it('sin sesiones futuras → null', () => {
    expect(
      nextSession([s('past', '2026-11-01T16:00:00Z', '2026-11-01T19:00:00Z', 'SCHEDULED')], now),
    ).toBeNull();
  });
});
