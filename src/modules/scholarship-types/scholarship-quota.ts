import { AppException } from '../../common/errors/app.exception';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import {
  type OfferQuotaState,
  offerQuotaState,
  quotaViolation,
  SCHOLARSHIP_SEAT_STATUSES,
} from './policies/scholarship-quota.policy';
import type { OfferScholarshipTypeLink } from './policies/scholarship-type.policy';

/** Cliente Prisma o transacción. */
type Db = Pick<PrismaClient, 'application'> | Prisma.TransactionClient;

const seatWhere = { status: { in: [...SCHOLARSHIP_SEAT_STATUSES] } };

/** Cupo usado por tipo (global, todas las ofertas). */
export async function usedRecipientsByType(
  db: Db,
  typeIds: readonly string[],
): Promise<Map<string, number>> {
  const used = new Map<string, number>(typeIds.map((id) => [id, 0]));
  if (typeIds.length === 0) return used;
  const rows = await db.application.groupBy({
    by: ['assignedScholarshipTypeId'],
    where: { ...seatWhere, assignedScholarshipTypeId: { in: [...typeIds] } },
    _count: { _all: true },
  });
  for (const row of rows) {
    if (row.assignedScholarshipTypeId) used.set(row.assignedScholarshipTypeId, row._count._all);
  }
  return used;
}

/** Cupo usado por tipo dentro de una oferta. */
export async function usedRecipientsInOffer(db: Db, offerId: string): Promise<Map<string, number>> {
  const rows = await db.application.groupBy({
    by: ['assignedScholarshipTypeId'],
    where: { ...seatWhere, offerId, assignedScholarshipTypeId: { not: null } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.assignedScholarshipTypeId!, r._count._all]));
}

/** Estado del cupo de cada tipo habilitado en la oferta (global + propio de la oferta). */
export async function offerQuotas(
  db: Db,
  offerId: string,
  links: readonly OfferScholarshipTypeLink[],
): Promise<Map<string, OfferQuotaState>> {
  const ids = links.map((l) => l.scholarshipType.id);
  const [global, inOffer] = await Promise.all([
    usedRecipientsByType(db, ids),
    usedRecipientsInOffer(db, offerId),
  ]);
  return new Map(
    links.map((link) => {
      const id = link.scholarshipType.id;
      return [
        id,
        offerQuotaState({
          type: {
            maxRecipients: link.scholarshipType.maxRecipients,
            usedRecipients: global.get(id) ?? 0,
          },
          offer: { maxRecipients: link.maxRecipients, usedRecipients: inOffer.get(id) ?? 0 },
        }),
      ];
    }),
  );
}

/**
 * Dentro de la transacción que ASIGNA la beca: bloquea la fila del tipo y la de la oferta
 * (`SELECT … FOR NO KEY UPDATE`: las aprobaciones concurrentes del mismo tipo se serializan) y
 * verifica que quepa una más. Es `FOR NO KEY UPDATE` y no `FOR UPDATE` porque la postulación ya se
 * actualizó con la FK al tipo, lo que toma `FOR KEY SHARE` sobre esa fila: con `FOR UPDATE` dos
 * aprobaciones concurrentes se bloquearían mutuamente (deadlock). `excludeApplicationId` = la
 * postulación que se está aprobando (ya actualizada en la transacción; no se cuenta dos veces).
 * Sin cupo → 409 `SCHOLARSHIP_TYPE_FULL` con `meta { scholarshipTypeId, scope, maxRecipients, used }`.
 */
export async function lockAndAssertScholarshipQuota(
  tx: Prisma.TransactionClient,
  input: { scholarshipTypeId: string; offerId: string; excludeApplicationId: string },
): Promise<void> {
  const { scholarshipTypeId, offerId, excludeApplicationId } = input;
  const [type] = await tx.$queryRaw<Array<{ max_recipients: number | null }>>`
    SELECT "max_recipients" FROM "scholarship_types"
    WHERE "id" = ${scholarshipTypeId}::uuid FOR NO KEY UPDATE`;
  const [link] = await tx.$queryRaw<Array<{ max_recipients: number | null }>>`
    SELECT "max_recipients" FROM "offer_scholarship_types"
    WHERE "offer_id" = ${offerId}::uuid AND "scholarship_type_id" = ${scholarshipTypeId}::uuid
    FOR NO KEY UPDATE`;
  const typeMax = type?.max_recipients ?? null;
  const offerMax = link?.max_recipients ?? null;
  if (typeMax === null && offerMax === null) return;
  const base = {
    ...seatWhere,
    assignedScholarshipTypeId: scholarshipTypeId,
    id: { not: excludeApplicationId },
  };
  const [typeUsed, offerUsed] = await Promise.all([
    typeMax === null ? Promise.resolve(0) : tx.application.count({ where: base }),
    offerMax === null ? Promise.resolve(0) : tx.application.count({ where: { ...base, offerId } }),
  ]);
  const violation = quotaViolation({
    type: { maxRecipients: typeMax, usedRecipients: typeUsed },
    offer: { maxRecipients: offerMax, usedRecipients: offerUsed },
  });
  if (violation) {
    throw new AppException('SCHOLARSHIP_TYPE_FULL', {
      message:
        violation.scope === 'TYPE'
          ? 'Ya no hay cupo para este tipo de beca.'
          : 'Ya no hay cupo para este tipo de beca en esta oferta.',
      meta: { scholarshipTypeId, ...violation },
    });
  }
}
