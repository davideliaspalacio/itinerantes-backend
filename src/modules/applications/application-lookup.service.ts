import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { OfferApplicationLookup, OfferApplicationRef } from '../offers/application-lookup';
import { formatFolio } from './policies/application-rules.policy';

/**
 * Implementación real de `OfferApplicationLookup` (Fase 04): acciones [Ver mi postulación] /
 * [Pagar saldo] de la ficha (HU-16/21). Registrada en OffersModule con
 * `{ provide: OFFER_APPLICATION_LOOKUP, useExisting: ApplicationLookupService }`.
 */
@Injectable()
export class ApplicationLookupService implements OfferApplicationLookup {
  constructor(private readonly prisma: PrismaService) {}

  async applicationsForUser(
    userId: string,
    offerIds: readonly string[],
  ): Promise<Map<string, OfferApplicationRef>> {
    if (offerIds.length === 0) return new Map();
    const rows = await this.prisma.application.findMany({
      where: { userId, offerId: { in: [...offerIds] } },
      select: { id: true, offerId: true, kind: true, status: true, number: true },
    });
    return new Map(
      rows.map((r) => [
        r.offerId,
        { id: r.id, kind: r.kind, status: r.status, folio: formatFolio(r.kind, r.number) },
      ]),
    );
  }
}
