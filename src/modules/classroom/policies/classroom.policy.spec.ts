import {
  deriveModuleStatus,
  finalProjectKeyPrefix,
  finalProjectSubmissionState,
  isPublishedNow,
  isValidFinalProjectFile,
  showsFinalProject,
  whatsappInfo,
} from './classroom.policy';

const now = new Date('2026-11-10T12:00:00Z');
const before = new Date('2026-11-01T00:00:00Z');
const after = new Date('2026-11-20T00:00:00Z');

describe('isPublishedNow (HU-28)', () => {
  it('PUBLISHED sin fecha o con fecha pasada → visible', () => {
    expect(isPublishedNow({ visibility: 'PUBLISHED', publishAt: null }, now)).toBe(true);
    expect(isPublishedNow({ visibility: 'PUBLISHED', publishAt: before }, now)).toBe(true);
  });
  it('oculto o programado a futuro → no visible', () => {
    expect(isPublishedNow({ visibility: 'HIDDEN', publishAt: null }, now)).toBe(false);
    expect(isPublishedNow({ visibility: 'PUBLISHED', publishAt: after }, now)).toBe(false);
  });
});

describe('deriveModuleStatus (HU-17)', () => {
  const s = (start: string, end: string, status: 'SCHEDULED' | 'CANCELLED' = 'SCHEDULED') => ({
    status,
    startsAt: new Date(start),
    endsAt: new Date(end),
  });
  const offer = { startsAt: before, endsAt: after };

  it('por sesiones: completado, en curso o próximo', () => {
    expect(deriveModuleStatus([s('2026-11-02T16:00Z', '2026-11-02T19:00Z')], offer, now)).toBe(
      'COMPLETED',
    );
    expect(
      deriveModuleStatus(
        [s('2026-11-02T16:00Z', '2026-11-02T19:00Z'), s('2026-11-12T16:00Z', '2026-11-12T19:00Z')],
        offer,
        now,
      ),
    ).toBe('IN_PROGRESS');
    expect(deriveModuleStatus([s('2026-11-12T16:00Z', '2026-11-12T19:00Z')], offer, now)).toBe(
      'UPCOMING',
    );
  });

  it('ignora canceladas y, sin sesiones, usa las fechas de la oferta', () => {
    expect(
      deriveModuleStatus([s('2026-11-12T16:00Z', '2026-11-12T19:00Z', 'CANCELLED')], offer, now),
    ).toBe('IN_PROGRESS');
    expect(deriveModuleStatus([], { startsAt: after, endsAt: null }, now)).toBe('UPCOMING');
    expect(deriveModuleStatus([], { startsAt: null, endsAt: before }, now)).toBe('COMPLETED');
  });
});

describe('whatsappInfo (HU-17)', () => {
  const url = 'https://chat.whatsapp.com/abc';
  it('visible desde la fecha del equipo', () => {
    expect(whatsappInfo({ url, visibleFrom: before, firstSessionStartsAt: after }, now)).toEqual({
      available: true,
      url,
      availableFrom: null,
      preStart: true,
    });
  });
  it('antes de la fecha: sin URL y con availableFrom', () => {
    expect(whatsappInfo({ url, visibleFrom: after, firstSessionStartsAt: after }, now)).toEqual({
      available: false,
      url: null,
      availableFrom: after,
      preStart: true,
    });
  });
  it('sin enlace configurado y clases iniciadas', () => {
    expect(
      whatsappInfo({ url: null, visibleFrom: null, firstSessionStartsAt: before }, now),
    ).toEqual({ available: false, url: null, availableFrom: null, preStart: false });
  });
});

describe('proyecto final (HU-17)', () => {
  it('solo en diplomados', () => {
    expect(showsFinalProject('DIPLOMA')).toBe(true);
    expect(showsFinalProject('COURSE')).toBe(false);
  });

  it('estado de la entrega', () => {
    const base = { type: 'DIPLOMA' as const, submissionEnabled: true, dueAt: after };
    expect(finalProjectSubmissionState(base, now)).toBe('OPEN');
    expect(finalProjectSubmissionState({ ...base, dueAt: before }, now)).toBe('CLOSED');
    expect(finalProjectSubmissionState({ ...base, submissionEnabled: false }, now)).toBe(
      'DISABLED',
    );
    expect(finalProjectSubmissionState({ ...base, type: 'WORKSHOP' }, now)).toBe('DISABLED');
  });

  it('valida tipo y tamaño (PDF/DOCX/PPTX/ZIP ≤ 20 MB)', () => {
    expect(isValidFinalProjectFile({ mimeType: 'application/pdf', sizeBytes: 1024 })).toBe(true);
    expect(
      isValidFinalProjectFile({ mimeType: 'application/zip', sizeBytes: 20 * 1024 ** 2 }),
    ).toBe(true);
    expect(
      isValidFinalProjectFile({ mimeType: 'application/pdf', sizeBytes: 20 * 1024 ** 2 + 1 }),
    ).toBe(false);
    expect(isValidFinalProjectFile({ mimeType: 'image/png', sizeBytes: 10 })).toBe(false);
    expect(isValidFinalProjectFile({ mimeType: 'application/pdf', sizeBytes: 0 })).toBe(false);
  });

  it('prefijo de storage por oferta y persona', () => {
    expect(finalProjectKeyPrefix('o1', 'u1')).toBe('final-projects/o1/u1/');
  });
});
