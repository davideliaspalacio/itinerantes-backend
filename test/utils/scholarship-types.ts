import type { PrismaService } from '../../src/infra/prisma/prisma.service';

/**
 * Tipos de beca en e2e: el global-setup corre el seed, así que los 5 tipos por defecto
 * (AGUA_VIVA, RIOS_VIVOS, AGUAS_LIBRES, CENOTES_VIVOS, SPECIAL) siempre existen.
 */

/** Relación anidada `Offer.scholarshipTypes` para `prisma.offer.create` (conecta por key). */
export function withScholarshipTypes(
  keys: readonly string[],
  overrides: Record<string, { minPercent?: number; maxPercent?: number }> = {},
) {
  return {
    create: keys.map((key) => ({ ...overrides[key], scholarshipType: { connect: { key } } })),
  };
}

/** key → id de los tipos de beca existentes. */
export async function scholarshipTypeIds(prisma: PrismaService): Promise<Record<string, string>> {
  const types = await prisma.scholarshipType.findMany({ select: { id: true, key: true } });
  return Object.fromEntries(types.map((t) => [t.key, t.id]));
}
