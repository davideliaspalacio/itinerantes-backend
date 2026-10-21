import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { paginate, type PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { nowUtc } from '../../common/utils/time';
import { BUSINESS_RULES } from '../../config/business-rules';
import type { LibraryResource, LibraryResourceType, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { publishedNowWhere } from '../classroom/policies/classroom.policy';
import type { AccessUrlDto } from '../enrollments/dto/portal-shared.dto';
import { EnrollmentAccessService } from '../enrollments/enrollment-access.service';
import type { LibraryItemDto, ListLibraryQueryDto } from './dto/library.dto';
import { canSeeLibraryResource, matchesLibrarySearch, resourceAccessKind } from './library.policy';

type Row = LibraryResource & { offer: { id: string; slug: string; name: string } | null };

/**
 * Biblioteca digital (HU-09). Recursos publicados; los exclusivos de un curso solo para quien tiene
 * acceso al Aula de esa oferta. Archivos privados → URL firmada temporal al abrirlos.
 */
@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly access: EnrollmentAccessService,
  ) {}

  async list(
    userId: string,
    query: ListLibraryQueryDto,
  ): Promise<PaginatedResponseDto<LibraryItemDto>> {
    const rows = await this.visibleRows(userId, query.type);
    const filtered = rows.filter((r) => matchesLibrarySearch(r, query.q));
    const page = filtered.slice(query.skip, query.skip + query.take);
    return paginate(await Promise.all(page.map((r) => this.toItem(r))), filtered.length, query);
  }

  /** Material recomendado del Dashboard (HU-06): destacados; si no hay, los más recientes. */
  async recommended(
    userId: string,
    limit: number = BUSINESS_RULES.DASHBOARD_RECOMMENDED_RESOURCES_LIMIT,
  ): Promise<LibraryItemDto[]> {
    const rows = await this.visibleRows(userId);
    const featured = rows.filter((r) => r.featured);
    return Promise.all(
      (featured.length ? featured : rows).slice(0, limit).map((r) => this.toItem(r)),
    );
  }

  async accessUrl(userId: string, id: string): Promise<AccessUrlDto> {
    const now = nowUtc();
    const row = await this.prisma.libraryResource.findFirst({
      where: { id, ...publishedNowWhere(now) },
    });
    const offerIds = await this.access.accessibleOfferIds(userId);
    // Recurso oculto, programado o exclusivo de un curso ajeno: no se revela (404).
    if (!row || !canSeeLibraryResource(row, offerIds)) {
      throw AppException.notFound('El recurso no existe.');
    }
    const kind = resourceAccessKind(row);
    if (kind === 'FILE') {
      const signed = await this.storage.getDownloadUrl(row.fileKey!, {
        expiresInSeconds: BUSINESS_RULES.PRIVATE_FILE_URL_TTL_SECONDS,
        downloadFileName: row.fileName ?? undefined,
      });
      return { kind, url: signed.url, expiresAt: signed.expiresAt, fileName: row.fileName };
    }
    if (kind === 'EXTERNAL_LINK') {
      return { kind, url: row.url!, expiresAt: null, fileName: null };
    }
    throw new AppException('RESOURCE_FILE_UNAVAILABLE');
  }

  // ------------------------------------------------------------------------------------------------

  private async visibleRows(
    userId: string,
    types?: readonly LibraryResourceType[],
  ): Promise<Row[]> {
    const now = nowUtc();
    const offerIds = await this.access.accessibleOfferIds(userId);
    const where: Prisma.LibraryResourceWhereInput = {
      ...publishedNowWhere(now),
      ...(types?.length ? { type: { in: [...types] } } : {}),
      AND: [
        {
          OR: [
            { audience: 'ALL_REGISTERED' },
            { audience: 'OFFER_ENROLLED', offerId: { in: [...offerIds] } },
          ],
        },
      ],
    };
    const rows = await this.prisma.libraryResource.findMany({
      where,
      include: { offer: { select: { id: true, slug: true, name: true } } },
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }, { title: 'asc' }],
    });
    return rows.filter((r) => canSeeLibraryResource(r, offerIds));
  }

  private async toItem(row: Row): Promise<LibraryItemDto> {
    const kind = resourceAccessKind(row);
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      type: row.type,
      author: row.author,
      keywords: row.keywords,
      thumbnailUrl: row.thumbnailKey
        ? await this.storage.getPublicUrl(
            row.thumbnailKey,
            BUSINESS_RULES.PUBLIC_IMAGE_SIGNED_URL_TTL_SECONDS,
          )
        : null,
      audience: row.audience,
      offer: row.offer,
      kind,
      fileName: kind === 'FILE' ? row.fileName : null,
      sizeBytes: kind === 'FILE' ? row.sizeBytes : null,
      featured: row.featured,
    };
  }
}
