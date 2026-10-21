import {
  adminSessionState,
  attendanceSummary,
  decideGeneration,
  groupByTimezone,
  overlaps,
  participantAttendance,
  scheduledMinutes,
  sessionCancelledMessage,
  sessionFlags,
  sessionRescheduledMessage,
} from './session-admin.policy';

const d = (iso: string) => new Date(iso);

describe('session-admin.policy', () => {
  describe('decideGeneration (HU-29)', () => {
    it('diplomado 20 sesiones · 60 h sin conflictos → se puede confirmar', () => {
      const r = decideGeneration(
        'DIPLOMA',
        { sessionCount: 20, conflictCount: 0, totalMinutes: 3600 },
        0,
      );
      expect(r).toMatchObject({ canConfirm: true, totalHours: 60, violations: [], warnings: [] });
    });

    it('curso mayor a 9 h → bloqueado con el texto de la HU', () => {
      const r = decideGeneration(
        'COURSE',
        { sessionCount: 4, conflictCount: 0, totalMinutes: 720 },
        0,
      );
      expect(r.canConfirm).toBe(false);
      expect(r.violations).toEqual(['COURSE_MAX_HOURS_EXCEEDED']);
      expect(r.blockedReason).toBe('Los cursos tienen una duración máxima de 9 horas.');
    });

    it('suma las horas existentes', () => {
      const r = decideGeneration(
        'COURSE',
        { sessionCount: 1, conflictCount: 0, totalMinutes: 180 },
        420,
      );
      expect(r.totalHours).toBe(10);
      expect(r.canConfirm).toBe(false);
    });

    it('diplomado ≠ 60 h solo advierte; conflictos o 0 sesiones bloquean', () => {
      const warn = decideGeneration(
        'DIPLOMA',
        { sessionCount: 3, conflictCount: 0, totalMinutes: 540 },
        0,
      );
      expect(warn).toMatchObject({ canConfirm: true, warnings: ['DIPLOMA_HOURS_MISMATCH'] });
      expect(
        decideGeneration('WORKSHOP', { sessionCount: 2, conflictCount: 1, totalMinutes: 360 }, 0)
          .canConfirm,
      ).toBe(false);
      expect(
        decideGeneration('WORKSHOP', { sessionCount: 0, conflictCount: 0, totalMinutes: 0 }, 0)
          .blockedReason,
      ).toMatch(/ninguna sesión/);
    });
  });

  it('scheduledMinutes ignora canceladas; overlaps con fin exclusivo', () => {
    const s = (a: string, b: string, status: 'SCHEDULED' | 'CANCELLED' = 'SCHEDULED') => ({
      status,
      startsAt: d(a),
      endsAt: d(b),
    });
    expect(
      scheduledMinutes([
        s('2026-11-07T16:00:00Z', '2026-11-07T19:00:00Z'),
        s('2026-11-08T16:00:00Z', '2026-11-08T19:00:00Z', 'CANCELLED'),
      ]),
    ).toBe(180);
    expect(
      overlaps(
        s('2026-11-07T16:00:00Z', '2026-11-07T19:00:00Z'),
        s('2026-11-07T19:00:00Z', '2026-11-07T20:00:00Z'),
      ),
    ).toBe(false);
    expect(
      overlaps(
        s('2026-11-07T16:00:00Z', '2026-11-07T19:00:00Z'),
        s('2026-11-07T18:00:00Z', '2026-11-07T20:00:00Z'),
      ),
    ).toBe(true);
  });

  it('adminSessionState mapea la ventana de asistencia', () => {
    expect(adminSessionState('NOT_OPEN_YET')).toBe('SCHEDULED');
    expect(adminSessionState('OPEN')).toBe('REGISTRATION_OPEN');
    expect(adminSessionState('CLOSED')).toBe('CLOSED');
    expect(adminSessionState('NOT_APPLICABLE')).toBe('CANCELLED');
  });

  it('sessionFlags', () => {
    const now = d('2026-11-10T00:00:00Z');
    const base = {
      status: 'SCHEDULED' as const,
      endsAt: d('2026-11-07T19:00:00Z'),
      joinUrl: null,
      recordingUrl: null,
      originalStartsAt: null,
    };
    expect(sessionFlags(base, 'ONLINE_LIVE', now)).toEqual({
      edited: false,
      cancelled: false,
      missingLink: true,
      recordingPending: true,
    });
    expect(sessionFlags(base, 'IN_PERSON', now)).toMatchObject({
      missingLink: false,
      recordingPending: false,
    });
    expect(
      sessionFlags(
        { ...base, status: 'CANCELLED', originalStartsAt: d('2026-11-01T00:00:00Z') },
        'ONLINE_LIVE',
        now,
      ),
    ).toEqual({ edited: true, cancelled: true, missingLink: false, recordingPending: false });
  });

  it('participantAttendance: asistidas ÷ sesiones realizadas no canceladas', () => {
    const now = d('2026-11-20T00:00:00Z');
    const sessions = [
      { id: 'a', status: 'SCHEDULED' as const, endsAt: d('2026-11-07T19:00:00Z') },
      { id: 'b', status: 'SCHEDULED' as const, endsAt: d('2026-11-08T19:00:00Z') },
      { id: 'c', status: 'CANCELLED' as const, endsAt: d('2026-11-09T19:00:00Z') },
      { id: 'd', status: 'SCHEDULED' as const, endsAt: d('2026-12-01T19:00:00Z') },
    ];
    expect(participantAttendance(sessions, new Set(['a', 'c', 'd']), now)).toEqual({
      attended: 1,
      heldSessions: 2,
      percent: 50,
      belowThreshold: true,
    });
    expect(participantAttendance(sessions, new Set(['a', 'b']), now).belowThreshold).toBe(false);
    expect(participantAttendance([], new Set(), now)).toEqual({
      attended: 0,
      heldSessions: 0,
      percent: null,
      belowThreshold: false,
    });
  });

  it('attendanceSummary arma el texto de la HU', () => {
    expect(attendanceSummary(18, 25)).toEqual({
      registered: 18,
      total: 25,
      percent: 72,
      label: '18 de 25 registraron asistencia (72%)',
    });
    expect(attendanceSummary(0, 0).percent).toBe(0);
  });

  it('mensajes con hora local + CDMX y motivo', () => {
    const m = sessionRescheduledMessage({
      offerName: 'Diplomado',
      previousStartsAt: d('2026-11-07T16:00:00Z'),
      startsAt: d('2026-11-14T16:00:00Z'),
      reason: 'Ponente enferma',
      userTimezone: 'America/Bogota',
    });
    expect(m.type).toBe('SESSION_RESCHEDULED');
    expect(m.body).toContain('14/11/2026 a las 11:00 (tu hora) · 10:00 hora CDMX');
    expect(m.body).toContain('Ponente enferma');
    const c = sessionCancelledMessage({
      offerName: 'Diplomado',
      startsAt: d('2026-11-07T16:00:00Z'),
      reason: 'Lluvia',
      userTimezone: 'America/Mexico_City',
    });
    expect(c.body).toContain('7/11/2026 a las 10:00 hora CDMX');
  });

  it('groupByTimezone', () => {
    const g = groupByTimezone([
      { id: '1', timezone: 'A' },
      { id: '2', timezone: 'B' },
      { id: '3', timezone: 'A' },
    ]);
    expect(g.get('A')?.map((x) => x.id)).toEqual(['1', '3']);
    expect(g.size).toBe(2);
  });
});
