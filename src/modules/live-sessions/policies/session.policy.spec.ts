import {
  attendanceInfo,
  attendanceRegistrationError,
  effectiveAttendanceWindowHours,
  joinInfo,
  recordingInfo,
  sessionPlatform,
} from './session.policy';

const startsAt = new Date('2026-11-07T16:00:00Z'); // 10:00 CDMX
const endsAt = new Date('2026-11-07T19:00:00Z'); // 13:00 CDMX
const minutes = (n: number) => new Date(startsAt.getTime() + n * 60_000);
const online = {
  status: 'SCHEDULED' as const,
  modality: 'ONLINE_LIVE' as const,
  startsAt,
  endsAt,
  joinUrl: 'https://zoom.us/j/123?pwd=x',
};

describe('joinInfo (HU-12)', () => {
  it('antes de 10 min: NOT_YET sin URL y con la hora de habilitación', () => {
    const info = joinInfo(online, minutes(-11));
    expect(info).toEqual({ state: 'NOT_YET', opensAt: minutes(-10), url: null });
  });

  it('desde 10 min antes y hasta el fin: OPEN con join_url', () => {
    expect(joinInfo(online, minutes(-10))).toMatchObject({ state: 'OPEN', url: online.joinUrl });
    expect(joinInfo(online, minutes(170))).toMatchObject({ state: 'OPEN' });
  });

  it('terminada: ENDED', () => {
    expect(joinInfo(online, minutes(180))).toMatchObject({ state: 'ENDED', url: null });
  });

  it('cancelada, sin enlace o presencial: sin URL', () => {
    expect(joinInfo({ ...online, status: 'CANCELLED' }, minutes(0)).state).toBe('CANCELLED');
    expect(joinInfo({ ...online, joinUrl: null }, minutes(0))).toMatchObject({
      state: 'LINK_PENDING',
      url: null,
    });
    expect(joinInfo({ ...online, modality: 'IN_PERSON' }, minutes(0))).toMatchObject({
      state: 'IN_PERSON',
      url: null,
    });
  });

  it('respeta la anticipación configurable', () => {
    expect(joinInfo(online, minutes(-20), 30).state).toBe('OPEN');
  });
});

describe('sessionPlatform', () => {
  it.each([
    ['https://us02web.zoom.us/j/1', 'ZOOM'],
    ['https://zoom.us/j/1', 'ZOOM'],
    ['https://meet.google.com/abc-defg-hij', 'GOOGLE_MEET'],
    ['https://teams.microsoft.com/x', 'OTHER'],
    ['no-es-url', 'OTHER'],
    [null, null],
  ])('%s → %s', (url, platform) => {
    expect(sessionPlatform(url)).toBe(platform);
  });
});

describe('recordingInfo (HU-08 / HU-12)', () => {
  it('con enlace: AVAILABLE', () => {
    expect(recordingInfo({ ...online, recordingUrl: 'https://youtu.be/x' }, minutes(200))).toEqual({
      state: 'AVAILABLE',
      url: 'https://youtu.be/x',
    });
  });
  it('antes de terminar: AFTER_SESSION; después sin enlace: PENDING', () => {
    expect(recordingInfo({ ...online, recordingUrl: null }, minutes(10)).state).toBe(
      'AFTER_SESSION',
    );
    expect(recordingInfo({ ...online, recordingUrl: null }, minutes(200)).state).toBe('PENDING');
  });
  it('cancelada o presencial sin enlace: NOT_APPLICABLE', () => {
    expect(
      recordingInfo({ ...online, status: 'CANCELLED', recordingUrl: 'https://x' }, minutes(200))
        .state,
    ).toBe('NOT_APPLICABLE');
    expect(
      recordingInfo({ ...online, modality: 'IN_PERSON', recordingUrl: null }, minutes(200)).state,
    ).toBe('NOT_APPLICABLE');
  });
});

describe('effectiveAttendanceWindowHours', () => {
  it('sesión > oferta > regla por defecto', () => {
    expect(effectiveAttendanceWindowHours(48, 24)).toBe(48);
    expect(effectiveAttendanceWindowHours(null, 12)).toBe(12);
    expect(effectiveAttendanceWindowHours(null, null)).toBe(24);
  });
});

describe('attendanceInfo (HU-18)', () => {
  const input = { status: 'SCHEDULED' as const, endsAt, windowHours: 24, record: null };
  const hours = (n: number) => new Date(endsAt.getTime() + n * 3600_000);

  it('antes de terminar: Pendiente, ventana no abierta', () => {
    const info = attendanceInfo(input, minutes(60));
    expect(info).toMatchObject({
      status: 'PENDING',
      windowState: 'NOT_OPEN_YET',
      canRegister: false,
      opensAt: endsAt,
      closesAt: hours(24),
    });
    expect(attendanceRegistrationError(info)).toBe('ATTENDANCE_NOT_OPEN_YET');
  });

  it('dentro de la ventana: Pendiente y se puede registrar', () => {
    const info = attendanceInfo(input, hours(23.9));
    expect(info).toMatchObject({ status: 'PENDING', windowState: 'OPEN', canRegister: true });
    expect(attendanceRegistrationError(info)).toBeNull();
  });

  it('ventana vencida sin registro: No registrada', () => {
    const info = attendanceInfo(input, hours(24));
    expect(info).toMatchObject({ status: 'NOT_REGISTERED', windowState: 'CLOSED' });
    expect(attendanceRegistrationError(info)).toBe('ATTENDANCE_WINDOW_CLOSED');
  });

  it('registrada (también la manual del equipo): Registrada y no duplicable', () => {
    const registeredAt = hours(2);
    const info = attendanceInfo(
      { ...input, record: { registeredAt, source: 'MANUAL', comment: null } },
      hours(30),
    );
    expect(info).toMatchObject({
      status: 'REGISTERED',
      canRegister: false,
      registeredAt,
      source: 'MANUAL',
    });
    expect(attendanceRegistrationError(info)).toBe('ATTENDANCE_ALREADY_REGISTERED');
  });

  it('cancelada: no aplica', () => {
    const info = attendanceInfo({ ...input, status: 'CANCELLED' }, hours(1));
    expect(info).toMatchObject({ status: 'NOT_APPLICABLE', windowState: 'NOT_APPLICABLE' });
    expect(attendanceRegistrationError(info)).toBe('SESSION_CANCELLED');
  });
});
