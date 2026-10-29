import {
  isMeetingProvider,
  isValidExternalId,
  meetingAuditEntityId,
  validateMeetingSchedule,
} from './meetings.policy';

describe('meetings.policy', () => {
  const now = new Date('2030-01-01T12:00:00Z');

  it('startAt debe ser futuro', () => {
    expect(validateMeetingSchedule(new Date('2030-01-01T12:00:01Z'), now)).toEqual([]);
    expect(validateMeetingSchedule(now, now)).toEqual([
      expect.objectContaining({ field: 'startAt', code: 'MUST_BE_FUTURE' }),
    ]);
  });

  it('proveedor y externalId de ruta', () => {
    expect(isMeetingProvider('ZOOM')).toBe(true);
    expect(isMeetingProvider('GOOGLE_MEET')).toBe(true);
    expect(isMeetingProvider('zoom')).toBe(false);
    expect(isValidExternalId('85746065432')).toBe(true);
    expect(isValidExternalId('a1b2c3_d-4')).toBe(true);
    expect(isValidExternalId('../users/me')).toBe(false);
    expect(isValidExternalId('')).toBe(false);
  });

  it('entityId de auditoría cabe en 64 caracteres', () => {
    expect(meetingAuditEntityId('ZOOM', '123')).toBe('ZOOM:123');
    expect(meetingAuditEntityId('GOOGLE_MEET', 'x'.repeat(100))).toHaveLength(64);
  });
});
