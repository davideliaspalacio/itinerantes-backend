import { Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import type { AdminUser } from '../../../common/guards/permissions.guard';
import { paginate, type PaginatedResponseDto } from '../../../common/dto/pagination.dto';
import { extractEmailsFromCsv } from '../../../common/utils/csv';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { MoodleAccessService } from '../moodle-access.service';
import {
  type AccessCodeDto,
  type GeneratedCodesDto,
  type GenerateCodesRequestDto,
  type ImportRosterRequestDto,
  type ListCodesQueryDto,
  type ListRosterQueryDto,
  MOODLE_ROSTER_MAX_EMAILS,
  type RosterEntryDto,
  type RosterImportResultDto,
} from './dto/admin-moodle.dto';

const USER_REF = { select: { id: true, fullName: true, email: true } } as const;

/**
 * Acceso Moodle desde el panel (HU-25 / HU-27 paso "Origen y precio"): lista de correos inscritos y
 * códigos de acceso. Reutiliza `MoodleAccessService.importRoster` / `generateCodes`.
 */
@Injectable()
export class AdminMoodleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moodle: MoodleAccessService,
    private readonly audit: AuditService,
  ) {}

  async roster(
    offerId: string,
    query: ListRosterQueryDto,
  ): Promise<PaginatedResponseDto<RosterEntryDto>> {
    await this.requireMoodleOffer(offerId);
    const where: Prisma.MoodleRosterEntryWhereInput = {
      offerId,
      ...(query.q ? { email: { contains: query.q.trim().toLowerCase() } } : {}),
      ...(query.linked === undefined
        ? {}
        : query.linked
          ? { linkedUserId: { not: null } }
          : { linkedUserId: null }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.moodleRosterEntry.findMany({
        where,
        orderBy: [{ email: 'asc' }],
        skip: query.skip,
        take: query.take,
        include: { linkedUser: USER_REF },
      }),
      this.prisma.moodleRosterEntry.count({ where }),
    ]);
    return paginate(
      rows.map((r) => ({
        id: r.id,
        email: r.email,
        linked: r.linkedUserId !== null,
        linkedUser: r.linkedUser,
        linkedAt: r.linkedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      query,
    );
  }

  async importRoster(
    offerId: string,
    dto: ImportRosterRequestDto,
    user: AdminUser,
  ): Promise<RosterImportResultDto> {
    const offer = await this.requireMoodleOffer(offerId);
    if ((dto.csv === undefined) === (dto.emails === undefined)) {
      throw AppException.validation([
        {
          field: 'csv',
          code: 'INVALID',
          message: 'Envía el CSV o la lista de correos (uno de los dos).',
        },
      ]);
    }
    const emails = dto.emails ?? extractEmailsFromCsv(dto.csv ?? '');
    if (emails.length === 0 || emails.length > MOODLE_ROSTER_MAX_EMAILS) {
      throw AppException.validation([
        {
          field: dto.emails ? 'emails' : 'csv',
          code: 'INVALID',
          message: `La lista debe tener entre 1 y ${MOODLE_ROSTER_MAX_EMAILS} correos.`,
        },
      ]);
    }
    const result = await this.moodle.importRoster(offerId, emails, user.id);
    await this.audit.record({
      actor: user,
      action: 'moodle.import-roster',
      entityType: 'Offer',
      entityId: offerId,
      summary: `Cargó ${result.added} correos a la lista Moodle de «${offer.name}» (${result.linkedUsers} vinculados).`,
      after: { ...result, invalid: result.invalid.length },
    });
    return result;
  }

  async removeRosterEntry(offerId: string, entryId: string, user: AdminUser): Promise<void> {
    await this.requireMoodleOffer(offerId);
    const entry = await this.prisma.moodleRosterEntry.findFirst({
      where: { id: entryId, offerId },
    });
    if (!entry) throw AppException.notFound('El correo no está en la lista.');
    if (entry.linkedUserId) {
      throw new AppException('CONFLICT', {
        message: 'Ese correo ya quedó vinculado a una inscripción: no se puede quitar de la lista.',
      });
    }
    await this.prisma.moodleRosterEntry.delete({ where: { id: entryId } });
    await this.audit.record({
      actor: user,
      action: 'moodle.remove-roster-entry',
      entityType: 'Offer',
      entityId: offerId,
      summary: `Quitó ${entry.email} de la lista Moodle.`,
      before: { email: entry.email },
    });
  }

  async codes(
    offerId: string,
    query: ListCodesQueryDto,
  ): Promise<PaginatedResponseDto<AccessCodeDto>> {
    await this.requireMoodleOffer(offerId);
    const where: Prisma.MoodleAccessCodeWhereInput = {
      offerId,
      ...(query.used === undefined
        ? {}
        : query.used
          ? { usedAt: { not: null } }
          : { usedAt: null }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.moodleAccessCode.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: query.skip,
        take: query.take,
        include: { usedBy: USER_REF },
      }),
      this.prisma.moodleAccessCode.count({ where }),
    ]);
    return paginate(
      rows.map((c) => ({
        id: c.id,
        hint: c.codeHint,
        expiresAt: c.expiresAt?.toISOString() ?? null,
        used: c.usedAt !== null,
        usedBy: c.usedBy,
        usedAt: c.usedAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
      })),
      total,
      query,
    );
  }

  async generateCodes(
    offerId: string,
    dto: GenerateCodesRequestDto,
    user: AdminUser,
  ): Promise<GeneratedCodesDto> {
    const offer = await this.requireMoodleOffer(offerId);
    const codes = await this.moodle.generateCodes(offerId, dto.count, user.id);
    await this.audit.record({
      actor: user,
      action: 'moodle.generate-codes',
      entityType: 'Offer',
      entityId: offerId,
      summary: `Generó ${codes.length} códigos de acceso Moodle para «${offer.name}».`,
      after: { count: codes.length },
    });
    return { codes, expiresAt: offer.endsAt?.toISOString() ?? null };
  }

  private async requireMoodleOffer(offerId: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      select: { id: true, name: true, origin: true, endsAt: true },
    });
    if (!offer) throw AppException.notFound('La oferta no existe.');
    if (offer.origin !== 'MOODLE') throw new AppException('OFFER_NOT_MOODLE');
    return offer;
  }
}
