import {
  addDaysInZone,
  cdmxToUtc,
  endOfDayInZone,
  formatInZone,
  isValidTimezone,
  startOfDayInZone,
  utcToCdmx,
  zonedToUtc,
} from './time';

describe('time utils', () => {
  it('CDMX → UTC: 10:00 CDMX = 16:00Z (UTC−6, sin horario de verano)', () => {
    expect(cdmxToUtc('2026-11-07', '10:00').toISOString()).toBe('2026-11-07T16:00:00.000Z');
    // En julio también es UTC−6 (México eliminó el horario de verano en 2022).
    expect(cdmxToUtc('2026-07-15', '10:00').toISOString()).toBe('2026-07-15T16:00:00.000Z');
  });

  it('UTC → CDMX', () => {
    const dt = utcToCdmx(new Date('2026-11-07T16:00:00.000Z'));
    expect(dt.toFormat('yyyy-MM-dd HH:mm')).toBe('2026-11-07 10:00');
    expect(dt.offset).toBe(-360);
  });

  it('zonedToUtc respeta zonas con horario de verano (Madrid)', () => {
    expect(zonedToUtc('2026-07-01', '18:00', 'Europe/Madrid').toISOString()).toBe(
      '2026-07-01T16:00:00.000Z',
    );
    expect(zonedToUtc('2026-12-01', '18:00', 'Europe/Madrid').toISOString()).toBe(
      '2026-12-01T17:00:00.000Z',
    );
  });

  it('zonedToUtc lanza con fecha inválida', () => {
    expect(() => zonedToUtc('2026-13-40', '10:00')).toThrow(/inválida/);
  });

  it('formatInZone', () => {
    const d = new Date('2026-11-07T16:00:00.000Z');
    expect(formatInZone(d, 'America/Bogota', 'HH:mm')).toBe('11:00');
    expect(formatInZone(d)).toBe('2026-11-07T10:00:00-06:00');
  });

  it('inicio y fin del día en CDMX', () => {
    const d = new Date('2026-11-07T03:00:00.000Z'); // 6 nov 21:00 CDMX
    expect(startOfDayInZone(d).toISOString()).toBe('2026-11-06T06:00:00.000Z');
    expect(endOfDayInZone(d).toISOString()).toBe('2026-11-07T05:59:59.999Z');
  });

  it('addDaysInZone suma días naturales (plazo de 7 días)', () => {
    const approved = new Date('2026-11-07T16:00:00.000Z');
    expect(addDaysInZone(approved, 7).toISOString()).toBe('2026-11-14T16:00:00.000Z');
  });

  it('isValidTimezone', () => {
    expect(isValidTimezone('America/Mexico_City')).toBe(true);
    expect(isValidTimezone('Mars/Olympus')).toBe(false);
  });
});
