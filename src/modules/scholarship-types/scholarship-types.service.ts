import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import type { Prisma, ScholarshipType } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { type AuditActor, AuditService } from '../audit/audit.service';
import type {
  AdminScholarshipTypeDto,
  AdminScholarshipTypesResponseDto,
  CreateScholarshipTypeRequestDto,
  ScholarshipTypeDto,
  ScholarshipTypesResponseDto,
  UpdateScholarshipTypeRequestDto,
} from './dto/scholarship-types.dto';
import { percentRangeIssues, type ScholarshipTypeDef } from './policies/scholarship-type.policy';
import { SCHOLARSHIP_TYPE_SELECT } from './scholarship-type.select';

const ORDER_BY = [
  { sortOrder: 'asc' },
  { name: 'asc' },
] as const satisfies Prisma.ScholarshipTypeOrderByWithRelationInput[];

type Usage = AdminScholarshipTypeDto['usage'];
const NO_USAGE: Usage = { offers: 0, applications: 0, evaluations: 0 };

/** Campos que se auditan (sin fechas). */
function auditable(type: ScholarshipType): Record<string, unknown> {
  const { createdAt: _c, updatedAt: _u, ...rest } = type;
  void _c;
  void _u;
  return rest;
}

function toDto(type: ScholarshipTypeDef): ScholarshipTypeDto {
  return {
    id: type.id,
    key: type.key,
    name: type.name,
    description: type.description,
    minPercent: type.minPercent,
    maxPercent: type.maxPercent,
    requiresInterview: type.requiresInterview,
    sortOrder: type.sortOrder,
  };
}

function rangeError(minPercent: number, maxPercent: number): AppException | null {
  const issues = percentRangeIssues(minPercent, maxPercent);
  return issues.length > 0
    ? new AppException('SCHOLARSHIP_TYPE_INVALID_RANGE', { details: issues })
    : null;
}

/**
 * Tipos de beca parametrizables: catálogo público (activos) y CRUD del panel (SUPER_ADMIN).
 * Los demás dominios (ofertas, postulaciones) usan `findByIds` para validar lo que reciben.
 */
@Injectable()
export class ScholarshipTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listPublic(): Promise<ScholarshipTypesResponseDto> {
    const types = await this.prisma.scholarshipType.findMany({
      where: { active: true },
      orderBy: ORDER_BY,
      select: SCHOLARSHIP_TYPE_SELECT,
    });
    return { data: types.map(toDto) };
  }

  async listAdmin(): Promise<AdminScholarshipTypesResponseDto> {
    const types = await this.prisma.scholarshipType.findMany({ orderBy: ORDER_BY });
    const usage = await this.usageFor(types.map((t) => t.id));
    return { data: types.map((type) => toAdminDto(type, usage.get(type.id) ?? NO_USAGE)) };
  }

  /** Tipos por id (los que no existen no vienen). */
  async findByIds(ids: readonly string[]): Promise<ScholarshipTypeDef[]> {
    if (ids.length === 0) return [];
    return this.prisma.scholarshipType.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: SCHOLARSHIP_TYPE_SELECT,
    });
  }

  async create(
    dto: CreateScholarshipTypeRequestDto,
    actor: AuditActor,
  ): Promise<AdminScholarshipTypeDto> {
    const invalid = rangeError(dto.minPercent, dto.maxPercent);
    if (invalid) throw invalid;
    const existing = await this.prisma.scholarshipType.findUnique({
      where: { key: dto.key },
      select: { id: true },
    });
    if (existing) throw keyTaken();
    const sortOrder =
      dto.sortOrder ??
      ((await this.prisma.scholarshipType.aggregate({ _max: { sortOrder: true } }))._max
        .sortOrder ?? 0) + 1;
    const created = await this.prisma.scholarshipType
      .create({
        data: {
          key: dto.key,
          name: dto.name,
          description: dto.description || null,
          minPercent: dto.minPercent,
          maxPercent: dto.maxPercent,
          requiresInterview: dto.requiresInterview ?? false,
          active: dto.active ?? true,
          sortOrder,
        },
      })
      .catch((error: unknown) => {
        if ((error as { code?: string }).code === 'P2002') throw keyTaken();
        throw error;
      });
    await this.audit.record({
      actor,
      action: 'scholarship_type.create',
      entityType: 'ScholarshipType',
      entityId: created.id,
      summary: `Creó el tipo de beca «${created.name}» (${rangeLabel(created)}).`,
      after: auditable(created),
    });
    return toAdminDto(created, NO_USAGE);
  }

  async update(
    id: string,
    dto: UpdateScholarshipTypeRequestDto,
    actor: AuditActor,
  ): Promise<AdminScholarshipTypeDto> {
    const before = await this.require(id);
    const minPercent = dto.minPercent ?? before.minPercent;
    const maxPercent = dto.maxPercent ?? before.maxPercent;
    const invalid = rangeError(minPercent, maxPercent);
    if (invalid) throw invalid;
    const data: Prisma.ScholarshipTypeUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description || null;
    if (dto.minPercent !== undefined) data.minPercent = dto.minPercent;
    if (dto.maxPercent !== undefined) data.maxPercent = dto.maxPercent;
    if (dto.requiresInterview !== undefined) data.requiresInterview = dto.requiresInterview;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    const after = await this.prisma.scholarshipType.update({ where: { id }, data });
    const verb =
      dto.active === false && before.active
        ? 'Desactivó'
        : dto.active === true && !before.active
          ? 'Reactivó'
          : 'Editó';
    await this.audit.record({
      actor,
      action: 'scholarship_type.update',
      entityType: 'ScholarshipType',
      entityId: id,
      summary: `${verb} el tipo de beca «${after.name}» (${rangeLabel(after)}).`,
      before: auditable(before),
      after: auditable(after),
    });
    return toAdminDto(after, (await this.usageFor([id])).get(id) ?? NO_USAGE);
  }

  /** Borra un tipo que nadie usa; si alguna oferta/postulación/evaluación lo usa → 409. */
  async remove(id: string, actor: AuditActor): Promise<void> {
    const type = await this.require(id);
    const usage = (await this.usageFor([id])).get(id) ?? NO_USAGE;
    if (usage.offers + usage.applications + usage.evaluations > 0) {
      throw new AppException('SCHOLARSHIP_TYPE_IN_USE', { meta: { usage } });
    }
    await this.prisma.scholarshipType.delete({ where: { id } }).catch((error: unknown) => {
      // Carrera: alguien lo usó entre el conteo y el borrado (FK RESTRICT).
      if ((error as { code?: string }).code === 'P2003') {
        throw new AppException('SCHOLARSHIP_TYPE_IN_USE');
      }
      throw error;
    });
    await this.audit.record({
      actor,
      action: 'scholarship_type.delete',
      entityType: 'ScholarshipType',
      entityId: id,
      summary: `Borró el tipo de beca «${type.name}».`,
      before: auditable(type),
    });
  }

  // ---------------------------------------------------------------------------------------------

  private async require(id: string): Promise<ScholarshipType> {
    const type = await this.prisma.scholarshipType.findUnique({ where: { id } });
    if (!type) throw notFound();
    return type;
  }

  /** Uso por tipo: ofertas, postulaciones (solicitado O asignado, sin duplicar) y evaluaciones. */
  private async usageFor(ids: readonly string[]): Promise<Map<string, Usage>> {
    const usage = new Map<string, Usage>(ids.map((id) => [id, { ...NO_USAGE }]));
    if (ids.length === 0) return usage;
    const idList = [...ids];
    const [offers, evaluations, applications] = await Promise.all([
      this.prisma.offerScholarshipType.groupBy({
        by: ['scholarshipTypeId'],
        where: { scholarshipTypeId: { in: idList } },
        _count: { _all: true },
      }),
      this.prisma.applicationEvaluation.groupBy({
        by: ['suggestedScholarshipTypeId'],
        where: { suggestedScholarshipTypeId: { in: idList } },
        _count: { _all: true },
      }),
      this.prisma.application.findMany({
        where: {
          OR: [
            { requestedScholarshipTypeId: { in: idList } },
            { assignedScholarshipTypeId: { in: idList } },
          ],
        },
        select: { requestedScholarshipTypeId: true, assignedScholarshipTypeId: true },
      }),
    ]);
    for (const row of offers) usage.get(row.scholarshipTypeId)!.offers = row._count._all;
    for (const row of evaluations) {
      if (row.suggestedScholarshipTypeId) {
        usage.get(row.suggestedScholarshipTypeId)!.evaluations = row._count._all;
      }
    }
    for (const app of applications) {
      const typeIds = new Set([app.requestedScholarshipTypeId, app.assignedScholarshipTypeId]);
      for (const typeId of typeIds) {
        const entry = typeId ? usage.get(typeId) : undefined;
        if (entry) entry.applications++;
      }
    }
    return usage;
  }
}

function toAdminDto(type: ScholarshipType, usage: Usage): AdminScholarshipTypeDto {
  return {
    ...toDto(type),
    active: type.active,
    usage,
    createdAt: type.createdAt.toISOString(),
    updatedAt: type.updatedAt.toISOString(),
  };
}

function rangeLabel(type: Pick<ScholarshipType, 'minPercent' | 'maxPercent'>): string {
  return type.minPercent === type.maxPercent
    ? `${type.minPercent}%`
    : `${type.minPercent}–${type.maxPercent}%`;
}

function notFound(): AppException {
  return AppException.notFound('El tipo de beca no existe.');
}

function keyTaken(): AppException {
  return new AppException('SCHOLARSHIP_TYPE_KEY_TAKEN', {
    details: [
      { field: 'key', code: 'ALREADY_EXISTS', message: 'Ya existe un tipo de beca con esa clave.' },
    ],
  });
}
