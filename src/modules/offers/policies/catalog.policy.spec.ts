import {
  type CatalogEntry,
  compareCatalogEntries,
  matchesCatalogFilters,
  normalizeSearchText,
} from './catalog.policy';
import { resolveTopic } from './public-topics';

const entry = (overrides: Partial<CatalogEntry>): CatalogEntry => ({
  name: 'Diplomado en Ecotecnologías del Agua',
  type: 'DIPLOMA',
  modality: 'ONLINE_LIVE',
  publicTopic: 'ECOTECH_WATER_DIPLOMA',
  availability: 'ENROLLMENT_OPEN',
  scholarshipOffered: true,
  startsAt: new Date('2026-11-07T16:00:00Z'),
  teacherNames: ['Ana Solís Ríos'],
  ...overrides,
});
const open = ['ENROLLMENT_OPEN', 'UPCOMING'] as const;

describe('filtros del catálogo (HU-15)', () => {
  it('búsqueda sin acentos ni mayúsculas, por nombre o docente', () => {
    expect(normalizeSearchText('  Ecotecnologías  DEL agua')).toBe('ecotecnologias del agua');
    expect(matchesCatalogFilters(entry({}), { statuses: open, q: 'ecotecnologias' })).toBe(true);
    expect(matchesCatalogFilters(entry({}), { statuses: open, q: 'solis' })).toBe(true);
    expect(matchesCatalogFilters(entry({}), { statuses: open, q: 'humedal' })).toBe(false);
  });

  it('todos los filtros se combinan (AND)', () => {
    const e = entry({});
    expect(matchesCatalogFilters(e, { statuses: open, types: ['COURSE', 'DIPLOMA'] })).toBe(true);
    expect(matchesCatalogFilters(e, { statuses: open, types: ['COURSE'] })).toBe(false);
    expect(matchesCatalogFilters(e, { statuses: open, modality: 'IN_PERSON' })).toBe(false);
    expect(matchesCatalogFilters(e, { statuses: ['FINISHED'] })).toBe(false);
    expect(matchesCatalogFilters(e, { statuses: open, topic: 'DRY_TOILETS' })).toBe(false);
    expect(
      matchesCatalogFilters(entry({ scholarshipOffered: false }), {
        statuses: open,
        scholarship: true,
      }),
    ).toBe(false);
  });

  it('orden: inicio más cercano; cerradas y finalizadas al final', () => {
    const list = [
      entry({ name: 'F', availability: 'FINISHED', startsAt: new Date('2026-01-01') }),
      entry({ name: 'C', availability: 'ENROLLMENT_CLOSED', startsAt: new Date('2026-02-01') }),
      entry({ name: 'Sin fecha', availability: 'UPCOMING', startsAt: null }),
      entry({ name: 'B', availability: 'UPCOMING', startsAt: new Date('2026-12-01') }),
      entry({ name: 'A', availability: 'ENROLLMENT_OPEN', startsAt: new Date('2026-11-07') }),
    ];
    expect(list.sort(compareCatalogEntries).map((e) => e.name)).toEqual([
      'A',
      'B',
      'Sin fecha',
      'C',
      'F',
    ]);
  });
});

describe('resolveTopic (HU-34)', () => {
  const offer = (slug: string, availability: CatalogEntry['availability'], type = 'COURSE') => ({
    slug,
    availability,
    type: type as CatalogEntry['type'],
    startsAt: null,
  });

  it('sin oferta vigente → Sin fechas programadas, sin enlace', () => {
    expect(resolveTopic([])).toEqual({
      availability: 'NO_SCHEDULED_DATES',
      linkKind: 'NONE',
      slug: null,
      offerCount: 0,
    });
    expect(resolveTopic([offer('a', 'FINISHED')]).availability).toBe('NO_SCHEDULED_DATES');
  });

  it('una oferta → su ficha con su estado', () => {
    expect(resolveTopic([offer('a', 'UPCOMING'), offer('old', 'FINISHED')])).toEqual({
      availability: 'UPCOMING',
      linkKind: 'OFFER',
      slug: 'a',
      offerCount: 1,
    });
  });

  it('varias → catálogo filtrado con el mejor estado', () => {
    expect(resolveTopic([offer('a', 'ENROLLMENT_CLOSED'), offer('b', 'ENROLLMENT_OPEN')])).toEqual({
      availability: 'ENROLLMENT_OPEN',
      linkKind: 'CATALOG',
      slug: null,
      offerCount: 2,
    });
  });

  it('convocatoria → Programa por convocatoria', () => {
    expect(resolveTopic([offer('call', 'ENROLLMENT_OPEN', 'OPEN_CALL')]).availability).toBe(
      'OPEN_CALL',
    );
  });
});
