import { auditValue, summarizeChanges } from './audit.policy';

describe('audit.policy', () => {
  it('solo guarda los campos que cambiaron', () => {
    expect(
      summarizeChanges({ name: 'A', capacity: 20, type: 'COURSE' }, { name: 'B', capacity: 20 }),
    ).toEqual({ before: { name: 'A' }, after: { name: 'B' } });
  });

  it('alta: solo after; baja: solo before', () => {
    expect(summarizeChanges(null, { title: 'Módulo 1' })).toEqual({ after: { title: 'Módulo 1' } });
    expect(summarizeChanges({ title: 'Módulo 1' }, null)).toEqual({
      before: { title: 'Módulo 1' },
    });
  });

  it('sin cambios → null', () => {
    expect(summarizeChanges({ a: 1 }, { a: 1 })).toBeNull();
    expect(summarizeChanges(null, null)).toBeNull();
  });

  it('nunca guarda secretos ni el enlace de anfitrión', () => {
    expect(
      summarizeChanges(null, { passwordHash: 'x', hostUrl: 'https://zoom.us/s/1', title: 't' }),
    ).toEqual({ after: { title: 't' } });
  });

  it('normaliza fechas, textos largos y arreglos', () => {
    const date = new Date('2026-11-07T16:00:00.000Z');
    expect(auditValue(date)).toBe('2026-11-07T16:00:00.000Z');
    expect((auditValue('x'.repeat(300)) as string).length).toBe(201);
    const arr = auditValue(Array.from({ length: 25 }, (_, i) => i)) as unknown[];
    expect(arr).toHaveLength(21);
    expect(arr[20]).toBe('… (+5)');
  });
});
