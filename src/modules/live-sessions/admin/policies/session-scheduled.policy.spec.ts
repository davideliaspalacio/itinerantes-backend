import {
  durationLabel,
  sessionScheduledMessage,
  sessionsGeneratedMessage,
} from './session-admin.policy';

describe('avisos de sesión agendada (HU-13 / HU-29)', () => {
  const startsAt = new Date('2026-11-12T00:00:00.000Z'); // 11/11 18:00 CDMX
  const endsAt = new Date('2026-11-12T01:30:00.000Z');

  it('durationLabel', () => {
    expect(durationLabel(startsAt, endsAt)).toBe('1 h 30 min');
    expect(durationLabel(startsAt, new Date('2026-11-12T02:00:00.000Z'))).toBe('2 h');
    expect(durationLabel(startsAt, new Date('2026-11-12T00:45:00.000Z'))).toBe('45 min');
  });

  it('sesión manual: hora CDMX, módulo y duración en los datos del correo', () => {
    const m = sessionScheduledMessage({
      offerName: 'Diplomado',
      startsAt,
      endsAt,
      moduleTitle: 'Módulo 1',
      userTimezone: 'America/Mexico_City',
    });
    expect(m.type).toBe('SESSION_SCHEDULED');
    expect(m.title).toBe('Nueva sesión: Diplomado');
    expect(m.body).toContain('11/11/2026 a las 18:00 hora CDMX');
    expect(m.email?.details).toEqual([
      { label: 'Formación', value: 'Diplomado' },
      { label: 'Módulo', value: 'Módulo 1' },
      { label: 'Fecha y hora', value: '11/11/2026 a las 18:00 hora CDMX' },
      { label: 'Duración', value: '1 h 30 min' },
    ]);
  });

  it('zona distinta: muestra su hora y la de CDMX', () => {
    const m = sessionScheduledMessage({
      offerName: 'Diplomado',
      startsAt,
      endsAt,
      userTimezone: 'America/Bogota',
    });
    expect(m.body).toContain('(tu hora) · 18:00 hora CDMX');
    expect(m.email?.details.map((d) => d.label)).not.toContain('Módulo');
  });

  it('generación: un solo aviso con el resumen; con 1 sesión usa el aviso individual', () => {
    const many = sessionsGeneratedMessage({
      offerName: 'Diplomado',
      count: 12,
      firstStartsAt: startsAt,
      firstEndsAt: endsAt,
      lastStartsAt: new Date('2027-02-04T00:00:00.000Z'),
      userTimezone: 'America/Mexico_City',
    });
    expect(many.title).toBe('Nuevas sesiones: Diplomado');
    expect(many.body).toContain('Se agendaron 12 sesiones');
    expect(many.email?.details).toContainEqual({ label: 'Sesiones agendadas', value: '12' });

    const one = sessionsGeneratedMessage({
      offerName: 'Diplomado',
      count: 1,
      firstStartsAt: startsAt,
      firstEndsAt: endsAt,
      lastStartsAt: startsAt,
      userTimezone: 'America/Mexico_City',
    });
    expect(one.title).toBe('Nueva sesión: Diplomado');
    expect(one.email?.details).toContainEqual({ label: 'Duración', value: '1 h 30 min' });
  });
});
