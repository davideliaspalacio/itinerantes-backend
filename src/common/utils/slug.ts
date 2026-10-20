/**
 * Genera un slug URL-safe en minúsculas sin acentos.
 * @example slugify('Diplomado en Ecotecnologías del Agua') → 'diplomado-en-ecotecnologias-del-agua'
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
