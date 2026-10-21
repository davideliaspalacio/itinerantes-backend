import type { LibraryAudience } from '../../generated/prisma/client';
import { normalizeSearchText } from '../offers/policies/catalog.policy';

/**
 * Reglas puras de la biblioteca digital (HU-09).
 */

/**
 * "Público" (ALL_REGISTERED) lo ve cualquier persona autenticada; "exclusivo de un curso"
 * (OFFER_ENROLLED) solo quien tiene acceso al Aula de esa oferta. Un recurso exclusivo sin oferta
 * no se muestra a nadie (configuración incompleta).
 */
export function canSeeLibraryResource(
  resource: { audience: LibraryAudience; offerId: string | null },
  accessibleOfferIds: ReadonlySet<string>,
): boolean {
  if (resource.audience === 'ALL_REGISTERED') return true;
  return !!resource.offerId && accessibleOfferIds.has(resource.offerId);
}

/** Búsqueda por título o palabra clave, sin acentos ni mayúsculas. */
export function matchesLibrarySearch(
  resource: { title: string; keywords: readonly string[]; author: string | null },
  q: string | undefined,
): boolean {
  const needle = q ? normalizeSearchText(q) : '';
  if (!needle) return true;
  return [resource.title, resource.author ?? '', ...resource.keywords]
    .map(normalizeSearchText)
    .some((text) => text.includes(needle));
}

/** Cómo se abre el recurso: archivo privado (URL firmada) o enlace externo (pestaña nueva). */
export type ResourceAccessKind = 'FILE' | 'EXTERNAL_LINK';

export function resourceAccessKind(resource: {
  fileKey: string | null;
  url: string | null;
}): ResourceAccessKind | null {
  if (resource.fileKey) return 'FILE';
  if (resource.url) return 'EXTERNAL_LINK';
  return null;
}
