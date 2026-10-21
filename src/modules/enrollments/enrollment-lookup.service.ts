import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { OfferEnrollmentLookup } from '../offers/enrollment-lookup';
import { nowUtc } from '../../common/utils/time';
import type { OfferEnrollmentState } from '../offers/enrollment-lookup';
import { CLASSROOM_ACCESS_STATUSES, seatHoldingWhere } from './policies/enrollment.policy';

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
      where: { offerId: { in: [...offerIds] }, ...seatHoldingWhere(nowUtc()) },
      _count: { _all: true },
    });
    return new Map(groups.map((g) => [g.offerId, g._count._all]));
  }

  async enrollmentStatesForUser(
    userId: string,
    offerIds: readonly string[],
  ): Promise<Map<string, OfferEnrollmentState>> {
    if (offerIds.length === 0) return new Map();
    const now = nowUtc();
    const rows = await this.prisma.enrollment.findMany({
      where: { userId, offerId: { in: [...offerIds] } },
      select: { offerId: true, status: true, applicationId: true, seatHoldExpiresAt: true },
    });
    return new Map(
      rows.map((r) => [
        r.offerId,
        {
          status: r.status,
          // Reserva de un checkout propio aún abierto ("Continuar pago", HU-22).
          checkoutPending:
            r.status === 'PENDING_PAYMENT' &&
            r.applicationId === null &&
            r.seatHoldExpiresAt !== null &&
            r.seatHoldExpiresAt > now,
        },
      ]),
    );
  }
}
