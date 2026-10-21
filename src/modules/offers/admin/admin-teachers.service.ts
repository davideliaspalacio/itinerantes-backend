import { Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import type { AdminUser } from '../../../common/guards/permissions.guard';
import { paginate, type PaginatedResponseDto } from '../../../common/dto/pagination.dto';
import { slugify } from '../../../common/utils/slug';
import type { Prisma, Teacher } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { AdminImagesService } from './admin-images.service';
import type {
  AdminTeacherDto,
  CreateTeacherRequestDto,
  ListTeachersQueryDto,
  UpdateTeacherRequestDto,
} from './dto/admin-teachers.dto';
import { uniqueSlug } from './policies/offer-wizard.policy';

type TeacherRow = Teacher & { _count: { offers: number; modules: number } };

/** Docentes (HU-27 pasos 1–2: "docente con CV"). */
@Injectable()
export class AdminTeachersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: AdminImagesService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListTeachersQueryDto): Promise<PaginatedResponseDto<AdminTeacherDto>> {
    const where: Prisma.TeacherWhereInput = query.q
      ? { fullName: { contains: query.q.trim(), mode: 'insensitive' } }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.teacher.findMany({
        where,
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        skip: query.skip,
        take: query.take,
        include: { _count: { select: { offers: true, modules: true } } },
      }),
      this.prisma.teacher.count({ where }),
    ]);
    return paginate(await Promise.all(rows.map((r) => this.toDto(r))), total, query);
  }

  async create(dto: CreateTeacherRequestDto, user: AdminUser): Promise<AdminTeacherDto> {
    if (dto.photoKey) await this.images.verify(dto.photoKey, 'TEACHER_PHOTO');
    const root = slugify(dto.fullName).slice(0, 130) || 'docente';
    const existing = await this.prisma.teacher.findMany({
      where: { slug: { startsWith: root } },
      select: { slug: true },
    });
    const taken = new Set(existing.map((t) => t.slug));
    const teacher = await this.prisma.teacher.create({
      data: {
        slug: uniqueSlug(root, (s) => taken.has(s)),
        fullName: dto.fullName.trim(),
        bio: dto.bio ?? null,
        cvUrl: dto.cvUrl ?? null,
        photoKey: dto.photoKey ?? null,
      },
      include: { _count: { select: { offers: true, modules: true } } },
    });
    await this.audit.record({
      actor: user,
      action: 'teacher.create',
      entityType: 'Teacher',
      entityId: teacher.id,
      summary: `Registró a la docente/el docente «${teacher.fullName}».`,
      after: { fullName: teacher.fullName, cvUrl: teacher.cvUrl, photoKey: teacher.photoKey },
    });
    return this.toDto(teacher);
  }

  async update(
    id: string,
    dto: UpdateTeacherRequestDto,
    user: AdminUser,
  ): Promise<AdminTeacherDto> {
    const current = await this.require(id);
    if (dto.photoKey && dto.photoKey !== current.photoKey) {
      await this.images.verify(dto.photoKey, 'TEACHER_PHOTO');
    }
    const data: Prisma.TeacherUpdateInput = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.bio !== undefined) data.bio = dto.bio;
    if (dto.cvUrl !== undefined) data.cvUrl = dto.cvUrl;
    if (dto.photoKey !== undefined) data.photoKey = dto.photoKey;
    const teacher = await this.prisma.teacher.update({
      where: { id },
      data,
      include: { _count: { select: { offers: true, modules: true } } },
    });
    await this.audit.record({
      actor: user,
      action: 'teacher.update',
      entityType: 'Teacher',
      entityId: id,
      summary: `Editó a «${teacher.fullName}».`,
      before: {
        fullName: current.fullName,
        bio: current.bio,
        cvUrl: current.cvUrl,
        photoKey: current.photoKey,
      },
      after: data,
    });
    return this.toDto(teacher);
  }

  async remove(id: string, user: AdminUser): Promise<void> {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      include: { _count: { select: { offers: true, modules: true } } },
    });
    if (!teacher) throw AppException.notFound('El docente no existe.');
    if (teacher._count.offers + teacher._count.modules > 0) {
      throw new AppException('TEACHER_IN_USE', { meta: { ...teacher._count } });
    }
    await this.prisma.teacher.delete({ where: { id } });
    await this.audit.record({
      actor: user,
      action: 'teacher.delete',
      entityType: 'Teacher',
      entityId: id,
      summary: `Borró a «${teacher.fullName}».`,
      before: { fullName: teacher.fullName },
    });
  }

  private async require(id: string): Promise<Teacher> {
    const teacher = await this.prisma.teacher.findUnique({ where: { id } });
    if (!teacher) throw AppException.notFound('El docente no existe.');
    return teacher;
  }

  private async toDto(row: TeacherRow): Promise<AdminTeacherDto> {
    return {
      id: row.id,
      slug: row.slug,
      fullName: row.fullName,
      bio: row.bio,
      cvUrl: row.cvUrl,
      photoKey: row.photoKey,
      photoUrl: row.photoKey ? await this.images.url(row.photoKey) : null,
      offerCount: row._count.offers,
      moduleCount: row._count.modules,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
