import { canSeeLibraryResource, matchesLibrarySearch, resourceAccessKind } from './library.policy';

describe('library.policy (HU-09)', () => {
  const enrolled = new Set(['offer-a']);

  it('público: cualquier persona autenticada', () => {
    expect(canSeeLibraryResource({ audience: 'ALL_REGISTERED', offerId: null }, new Set())).toBe(
      true,
    );
  });

  it('exclusivo de un curso: solo inscritos de esa oferta', () => {
    expect(
      canSeeLibraryResource({ audience: 'OFFER_ENROLLED', offerId: 'offer-a' }, enrolled),
    ).toBe(true);
    expect(
      canSeeLibraryResource({ audience: 'OFFER_ENROLLED', offerId: 'offer-b' }, enrolled),
    ).toBe(false);
    expect(canSeeLibraryResource({ audience: 'OFFER_ENROLLED', offerId: null }, enrolled)).toBe(
      false,
    );
  });

  it('busca por título, autor o palabra clave sin acentos', () => {
    const resource = { title: 'Guía de humedales', keywords: ['saneamiento'], author: 'Ana Solís' };
    expect(matchesLibrarySearch(resource, 'HUMEDALES')).toBe(true);
    expect(matchesLibrarySearch(resource, 'guia')).toBe(true);
    expect(matchesLibrarySearch(resource, 'solis')).toBe(true);
    expect(matchesLibrarySearch(resource, 'saneam')).toBe(true);
    expect(matchesLibrarySearch(resource, 'baños')).toBe(false);
    expect(matchesLibrarySearch(resource, undefined)).toBe(true);
    expect(matchesLibrarySearch(resource, '   ')).toBe(true);
  });

  it('tipo de acceso', () => {
    expect(resourceAccessKind({ fileKey: 'k', url: 'https://x' })).toBe('FILE');
    expect(resourceAccessKind({ fileKey: null, url: 'https://x' })).toBe('EXTERNAL_LINK');
    expect(resourceAccessKind({ fileKey: null, url: null })).toBeNull();
  });
});
