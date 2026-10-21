import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import type { Enrollment } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CLASSROOM_ACCESS_STATUSES, hasClassroomAccess } from './policies/enrollment.policy';

/**
 * Autorización del portal: ¿la persona puede ver el Aula / materiales / sesiones de una oferta?
 *
 * Convención de errores (docs/frontend/fase-03-portal.md):
 * - Oferta inexistente, o no publicada y sin inscripción → 404 `NOT_FOUND` (no se revela).
 * - Oferta publicada sin inscripción con acceso → 403 `ENROLLMENT_REQUIRED`
 *   (`meta.offerSlug` para ofrecer la ficha, `meta.enrollmentStatus` si existe p. ej. PENDING_PAYMENT).
 * - Inscripción suspendida por mora → 403 `ENROLLMENT_SUSPENDED` (`meta.offerSlug`).
 */
@Injectable()
export class EnrollmentAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireClassroomAccess(userId: string, offerId: string): Promise<Enrollment> {
    const [offer, enrollment] = await Promise.all([
      this.prisma.offer.findUnique({
        where: { id: offerId },
        select: { slug: true, publicationStatus: true },
      }),
      this.prisma.enrollment.findUnique({ where: { userId_offerId: { userId, offerId } } }),
    ]);
    if (!offer) throw notFound();
    if (enrollment && hasClassroomAccess(enrollment.status)) return enrollment;
    if (!enrollment && offer.publicationStatus !== 'PUBLISHED') throw notFound();
    if (enrollment?.status === 'SUSPENDED') {
      throw new AppException('ENROLLMENT_SUSPENDED', { meta: { offerSlug: offer.slug } });
    }
    throw new AppException('ENROLLMENT_REQUIRED', {
      meta: {
        offerSlug: offer.publicationStatus === 'PUBLISHED' ? offer.slug : null,
        enrollmentStatus: enrollment?.status ?? null,
      },
    });
  }

  /** Ids de las ofertas en que la persona tiene acceso al Aula. */
  async accessibleOfferIds(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.enrollment.findMany({
      where: { userId, status: { in: [...CLASSROOM_ACCESS_STATUSES] } },
      select: { offerId: true },
    });
    return new Set(rows.map((r) => r.offerId));
  }
}

function notFound(): AppException {
  return AppException.notFound('La formación no existe.');
}
