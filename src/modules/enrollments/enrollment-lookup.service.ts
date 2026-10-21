import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { OfferEnrollmentLookup } from '../offers/enrollment-lookup';
import { CLASSROOM_ACCESS_STATUSES, SEAT_HOLDING_STATUSES } from './policies/enrollment.policy';

/**
 * Implementación real de `OfferEnrollmentLookup` (Fase 03): badge "Inscrito", `GO_TO_CLASSROOM` y
 * "Cupo agotado" del catálogo y la ficha (HU-15/16). Se registra en OffersModule con
 * `{ provide: OFFER_ENROLLMENT_LOOKUP, useExisting: EnrollmentLookupService }`.
 */
@Injectable()
export class EnrollmentLookupService implements OfferEnrollmentLookup {
  constructor(private readonly prisma: PrismaService) {}

  async activeOfferIdsForUser(userId: string, offerIds: readonly string[]): Promise<Set<string>> {
    if (offerIds.length === 0) return new Set();
    const rows = await this.prisma.enrollment.findMany({
      where: {
        userId,
        offerId: { in: [...offerIds] },
        status: { in: [...CLASSROOM_ACCESS_STATUSES] },
      },
      select: { offerId: true },
    });
    return new Set(rows.map((r) => r.offerId));
  }

  async countSeatsTaken(offerIds: readonly string[]): Promise<Map<string, number>> {
    if (offerIds.length === 0) return new Map();
    const groups = await this.prisma.enrollment.groupBy({
      by: ['offerId'],
      where: { offerId: { in: [...offerIds] }, status: { in: [...SEAT_HOLDING_STATUSES] } },
      _count: { _all: true },
    });
    return new Map(groups.map((g) => [g.offerId, g._count._all]));
  }
}
