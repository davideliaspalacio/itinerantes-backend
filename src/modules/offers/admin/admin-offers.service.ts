import { Injectable } from '@nestjs/common';
import type { AdminUser } from '../../../common/guards/permissions.guard';
import { AppException, type ErrorDetail } from '../../../common/errors/app.exception';
import { paginate, type PaginatedResponseDto } from '../../../common/dto/pagination.dto';
import { slugify } from '../../../common/utils/slug';
import { nowUtc, OFFICIAL_TIMEZONE } from '../../../common/utils/time';
import { isWhatsappGroupUrl } from '../../../common/utils/urls';
import { Prisma, type Offer } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { seatHoldingWhere } from '../../enrollments/policies/enrollment.policy';
import { deriveOfferAvailability } from '../policies/offer-status.policy';
import { safeParseScheduleRule, scheduleRuleSchema } from '../policies/schedule-rule';
import { AdminImagesService } from './admin-images.service';
import type {
  AdminOfferDetailDto,
  AdminOfferListItemDto,
  CreateOfferRequestDto,
  DuplicateOfferRequestDto,
  ListAdminOffersQueryDto,
  UpdateAttendanceStepDto,
  UpdateContentStepDto,
  UpdateGeneralStepDto,
  UpdateOriginPricingStepDto,
  UpdateScheduleStepDto,
  UpdateWhatsappStepDto,
} from './dto/admin-offers.dto';
import {
  ADMIN_OFFER_STATUS_LABELS,
  adminOfferStatus,
  duplicateName,
  offerWizardStatus,
  type PublicationAction,
  publicationTransition,
  uniqueSlug,
  WIZARD_STEPS,
} from './policies/offer-wizard.policy';

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
const dateOrNull = (v: string | null | undefined): Date | null | undefined =>
  v === undefined ? undefined : v === null ? null : new Date(v);

function countsSelect(now: Date) {
  return {
    _count: {
      select: {
        enrollments: { where: seatHoldingWhere(now) },
        applications: { where: { status: { not: 'DRAFT' as const } } },
        sessions: { where: { status: 'SCHEDULED' as const } },
        modules: true,
      },
    },
  } satisfies Prisma.OfferSelect;
}

const LIST_SELECT = {
  id: true,
  slug: true,
  name: true,
  type: true,
  modality: true,
  origin: true,
  publicationStatus: true,
  cohortLabel: true,
  coverImageKey: true,
  enrollmentOpensAt: true,
  enrollmentClosesAt: true,
  startsAt: true,
  endsAt: true,
  updatedAt: true,
} as const satisfies Prisma.OfferSelect;

type ListRow = Prisma.OfferGetPayload<{ select: typeof LIST_SELECT }> & {
  _count: { enrollments: number; applications: number; sessions: number; modules: number };
};

/** Campos que toca cada paso (para la auditoría "antes"). */
type OfferData = Prisma.OfferUncheckedUpdateInput;

/**
 * Ofertas en el panel (HU-27): listado, asistente de 7 pasos con guardado por paso, publicación,
 * despublicación, archivo, duplicado y borrado de borradores. Toda escritura queda en la auditoría.
 */
@Injectable()
export class AdminOffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: AdminImagesService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListAdminOffersQueryDto): Promise<PaginatedResponseDto<AdminOfferListItemDto>> {
    const now = nowUtc();
    const rows = (await this.prisma.offer.findMany({
      where: {
        ...(query.q ? { name: { contains: query.q.trim(), mode: 'insensitive' } } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.modality ? { modality: query.modality } : {}),
        ...(query.origin ? { origin: query.origin } : {}),
      },
      select: { ...LIST_SELECT, ...countsSelect(now) },
    })) as ListRow[];
    const items = rows
      .map((row) => ({ row, status: this.statusOf(row, now) }))
      .filter(({ status }) => !query.status || status.adminStatus === query.status)
      .sort((a, b) => {
        switch (query.sort) {
          case 'NAME_ASC':
            return a.row.name.localeCompare(b.row.name, 'es');
          case 'STARTS_AT_ASC':
            return (
              (a.row.startsAt?.getTime() ?? Infinity) - (b.row.startsAt?.getTime() ?? Infinity)
            );
          default:
            return b.row.updatedAt.getTime() - a.row.updatedAt.getTime();
        }
      });
    const page = items.slice(query.skip, query.skip + query.take);
    const data = await Promise.all(page.map(({ row }) => this.toListItem(row, now)));
    return paginate(data, items.length, query);
  }

  async detail(offerId: string): Promise<AdminOfferDetailDto> {
    const now = nowUtc();
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        teachers: { orderBy: { position: 'asc' }, include: { teacher: true } },
        ...countsSelect(now),
      },
    });
    if (!offer) throw AppException.notFound('La oferta no existe.');
    const [publishedModules, resourceCount] = await Promise.all([
      this.prisma.offerModule.count({ where: { offerId, visibility: 'PUBLISHED' } }),
      this.prisma.moduleResource.count({ where: { module: { offerId } } }),
    ]);
    const base = await this.toListItem(offer, now);
    const rule = safeParseScheduleRule(offer.scheduleRule);
    const wizard = offerWizardStatus(offer);
    return {
      ...base,
      publishedAt: iso(offer.publishedAt),
      hasEnrollments: offer._count.enrollments > 0 || offer._count.applications > 0,
      general: {
        cohortLabel: offer.cohortLabel,
        summary: offer.summary,
        coverImage: offer.coverImageKey
          ? { key: offer.coverImageKey, url: await this.images.url(offer.coverImageKey) }
          : null,
        carouselImages: await Promise.all(
          offer.carouselImageKeys.map(async (key) => ({ key, url: await this.images.url(key) })),
        ),
        publicTopic: offer.publicTopic,
        teachers: await Promise.all(
          offer.teachers.map(async ({ teacher }) => ({
            id: teacher.id,
            fullName: teacher.fullName,
            photoUrl: teacher.photoKey ? await this.images.url(teacher.photoKey) : null,
          })),
        ),
        venue: {
          name: offer.venueName,
          address: offer.venueAddress,
          city: offer.venueCity,
          mapsUrl: offer.venueMapsUrl,
        },
        capacity: offer.capacity,
      },
      content: {
        description: offer.description,
        learningOutcomes: offer.learningOutcomes,
        requirements: offer.requirements,
        eligibilityText: offer.eligibilityText,
        eligibleCountryCodes: offer.eligibleCountryCodes,
        requiresTravel: offer.requiresTravel,
        classroomWelcome: offer.classroomWelcome,
        finalProjectSubmissionEnabled: offer.finalProjectSubmissionEnabled,
        finalProjectGuidelines: offer.finalProjectGuidelines,
      },
      schedule: {
        enrollmentOpensAt: iso(offer.enrollmentOpensAt),
        enrollmentClosesAt: iso(offer.enrollmentClosesAt),
        startsAt: iso(offer.startsAt),
        endsAt: iso(offer.endsAt),
        finalProjectDueAt: iso(offer.finalProjectDueAt),
        totalHours: offer.totalMinutes !== null ? offer.totalMinutes / 60 : null,
        scheduleRule: rule,
        calendarCategory: offer.calendarCategory,
        timezone: OFFICIAL_TIMEZONE,
      },
      originPricing: {
        origin: offer.origin,
        isFree: offer.isFree,
        priceMxnCents: offer.priceMxnCents,
        priceUsdCents: offer.priceUsdCents,
        installmentsEnabled: offer.installmentsEnabled,
        installmentsMax: offer.installmentsMax,
        moodleCourseUrl: offer.moodleCourseUrl,
        scholarshipEnabled: offer.scholarshipEnabled,
        scholarshipLevels: offer.scholarshipLevels,
        scholarshipOpensAt: iso(offer.scholarshipOpensAt),
        scholarshipClosesAt: iso(offer.scholarshipClosesAt),
      },
      resources: {
        moduleCount: offer._count.modules,
        publishedModuleCount: publishedModules,
        resourceCount,
      },
      attendance: { attendanceWindowHours: offer.attendanceWindowHours },
      whatsapp: {
        whatsappGroupUrl: offer.whatsappGroupUrl,
        whatsappVisibleFrom: iso(offer.whatsappVisibleFrom),
      },
      wizard,
      sessionPreview: { available: !!rule && !!offer.startsAt && !!offer.endsAt },
      createdAt: offer.createdAt.toISOString(),
    };
  }

  // --- Alta y pasos del asistente ----------------------------------------------------------------

  async create(dto: CreateOfferRequestDto, user: AdminUser): Promise<AdminOfferDetailDto> {
    const name = dto.name.trim();
    await this.assertNameFree(name);
    const slug = await this.freeSlug(name);
    const offer = await this.prisma.offer
      .create({
        data: {
          name,
          slug,
          type: dto.type,
          modality: dto.modality,
          summary: '',
          description: '',
          learningOutcomes: [],
        },
      })
      .catch(rethrowNameTaken);
    await this.audit.record({
      actor: user,
      action: 'offer.create',
      entityType: 'Offer',
      entityId: offer.id,
      summary: `Creó la oferta «${name}» (borrador).`,
      after: { name, type: dto.type, modality: dto.modality },
    });
    return this.detail(offer.id);
  }

  async updateGeneral(
    offerId: string,
    dto: UpdateGeneralStepDto,
    user: AdminUser,
  ): Promise<AdminOfferDetailDto> {
    const offer = await this.require(offerId);
    const data: OfferData = {};
    if (dto.name !== undefined && dto.name.trim() !== offer.name) {
      const name = dto.name.trim();
      await this.assertNameFree(name, offerId);
      data.name = name;
      // El slug solo cambia mientras la oferta nunca se publicó (los enlaces públicos son estables).
      if (!offer.publishedAt) data.slug = await this.freeSlug(name, offerId);
    }
    const locked =
      (dto.type !== undefined && dto.type !== offer.type) ||
      (dto.modality !== undefined && dto.modality !== offer.modality);
    if (locked) await this.assertNoEnrollments(offerId);
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.modality !== undefined) data.modality = dto.modality;
    if (dto.cohortLabel !== undefined) data.cohortLabel = dto.cohortLabel;
    if (dto.summary !== undefined) data.summary = dto.summary.trim();
    if (dto.coverImageKey !== undefined) {
      if (dto.coverImageKey && dto.coverImageKey !== offer.coverImageKey) {
        await this.images.verify(dto.coverImageKey, 'OFFER_COVER', offerId);
      }
      data.coverImageKey = dto.coverImageKey;
    }
    if (dto.carouselImageKeys !== undefined) {
      for (const key of dto.carouselImageKeys) {
        if (!offer.carouselImageKeys.includes(key)) {
          await this.images.verify(key, 'OFFER_CAROUSEL', offerId);
        }
      }
      data.carouselImageKeys = dto.carouselImageKeys;
    }
    if (dto.publicTopic !== undefined) data.publicTopic = dto.publicTopic;
    if (dto.venueName !== undefined) data.venueName = dto.venueName;
    if (dto.venueAddress !== undefined) data.venueAddress = dto.venueAddress;
    if (dto.venueCity !== undefined) data.venueCity = dto.venueCity;
    if (dto.venueMapsUrl !== undefined) data.venueMapsUrl = dto.venueMapsUrl;
    if (dto.capacity !== undefined) data.capacity = dto.capacity;

    let teachersBefore: string[] | undefined;
    if (dto.teacherIds !== undefined) {
      const found = await this.prisma.teacher.count({ where: { id: { in: dto.teacherIds } } });
      if (found !== dto.teacherIds.length) {
        throw AppException.validation([
          { field: 'teacherIds', code: 'INVALID', message: 'Algún docente no existe.' },
        ]);
      }
      teachersBefore = (
        await this.prisma.offerTeacher.findMany({
          where: { offerId },
          orderBy: { position: 'asc' },
          select: { teacherId: true },
        })
      ).map((t) => t.teacherId);
    }
    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.offer.update({ where: { id: offerId }, data }).catch(rethrowNameTaken);
      }
      if (dto.teacherIds !== undefined) {
        await tx.offerTeacher.deleteMany({ where: { offerId } });
        await tx.offerTeacher.createMany({
          data: dto.teacherIds.map((teacherId, position) => ({ offerId, teacherId, position })),
        });
      }
    });
    await this.recordStep(user, offer, 'general', data, {
      before: teachersBefore ? { teacherIds: teachersBefore } : undefined,
      after: dto.teacherIds ? { teacherIds: dto.teacherIds } : undefined,
    });
    return this.detail(offerId);
  }

  async updateContent(
    offerId: string,
    dto: UpdateContentStepDto,
    user: AdminUser,
  ): Promise<AdminOfferDetailDto> {
    const offer = await this.require(offerId);
    if (dto.eligibleCountryCodes?.length) {
      const found = await this.prisma.country.count({
        where: { code: { in: dto.eligibleCountryCodes } },
      });
      if (found !== dto.eligibleCountryCodes.length) {
        throw AppException.validation([
          { field: 'eligibleCountryCodes', code: 'INVALID', message: 'Algún país no existe.' },
        ]);
      }
    }
    const data: OfferData = {};
    const keys = [
      'description',
      'learningOutcomes',
      'requirements',
      'eligibilityText',
      'eligibleCountryCodes',
      'requiresTravel',
      'classroomWelcome',
      'finalProjectSubmissionEnabled',
      'finalProjectGuidelines',
    ] as const;
    for (const key of keys) if (dto[key] !== undefined) Object.assign(data, { [key]: dto[key] });
    if (dto.learningOutcomes) {
      data.learningOutcomes = dto.learningOutcomes.map((s) => s.trim()).filter(Boolean);
    }
    await this.prisma.offer.update({ where: { id: offerId }, data });
    await this.recordStep(user, offer, 'content', data);
    return this.detail(offerId);
  }

  async updateSchedule(
    offerId: string,
    dto: UpdateScheduleStepDto,
    user: AdminUser,
  ): Promise<AdminOfferDetailDto> {
    const offer = await this.require(offerId);
    const data: OfferData = {};
    for (const key of [
      'enrollmentOpensAt',
      'enrollmentClosesAt',
      'startsAt',
      'endsAt',
      'finalProjectDueAt',
    ] as const) {
      const value = dateOrNull(dto[key]);
      if (value !== undefined) data[key] = value;
    }
    if (dto.totalHours !== undefined) {
      data.totalMinutes = dto.totalHours === null ? null : Math.round(dto.totalHours * 60);
    }
    if (dto.scheduleRule !== undefined) {
      if (dto.scheduleRule === null) data.scheduleRule = Prisma.DbNull;
      else {
        const parsed = scheduleRuleSchema.safeParse(dto.scheduleRule);
        if (!parsed.success) {
          throw AppException.validation(
            parsed.error.issues.map((issue): ErrorDetail => ({
              field: ['scheduleRule', ...issue.path.map(String)].join('.'),
              code: 'INVALID',
              message: issue.message,
            })),
          );
        }
        data.scheduleRule = parsed.data;
      }
    }
    if (dto.calendarCategory !== undefined) data.calendarCategory = dto.calendarCategory;
    await this.prisma.offer.update({ where: { id: offerId }, data });
    await this.recordStep(user, offer, 'schedule', data);
    return this.detail(offerId);
  }

  async updateOriginPricing(
    offerId: string,
    dto: UpdateOriginPricingStepDto,
    user: AdminUser,
  ): Promise<AdminOfferDetailDto> {
    const offer = await this.require(offerId);
    if (dto.origin !== undefined && dto.origin !== offer.origin) {
      await this.assertNoEnrollments(offerId);
    }
    const data: OfferData = {};
    for (const key of [
      'origin',
      'isFree',
      'priceMxnCents',
      'priceUsdCents',
      'installmentsEnabled',
      'installmentsMax',
      'moodleCourseUrl',
      'scholarshipEnabled',
      'scholarshipLevels',
    ] as const) {
      if (dto[key] !== undefined) Object.assign(data, { [key]: dto[key] });
    }
    for (const key of ['scholarshipOpensAt', 'scholarshipClosesAt'] as const) {
      const value = dateOrNull(dto[key]);
      if (value !== undefined) data[key] = value;
    }
    // HU-27: "elijo origen Moodle → se ocultan precio, cuotas y beca".
    if ((dto.origin ?? offer.origin) === 'MOODLE') {
      Object.assign(data, {
        isFree: false,
        priceMxnCents: null,
        priceUsdCents: null,
        installmentsEnabled: false,
        installmentsMax: null,
        scholarshipEnabled: false,
        scholarshipLevels: [],
        scholarshipOpensAt: null,
        scholarshipClosesAt: null,
      });
    } else if (dto.origin === 'NAS') {
      data.moodleCourseUrl = dto.moodleCourseUrl ?? null;
    }
    await this.prisma.offer.update({ where: { id: offerId }, data });
    await this.recordStep(user, offer, 'origin-pricing', data);
    return this.detail(offerId);
  }

  async updateAttendance(
    offerId: string,
    dto: UpdateAttendanceStepDto,
    user: AdminUser,
  ): Promise<AdminOfferDetailDto> {
    const offer = await this.require(offerId);
    const data: OfferData = { attendanceWindowHours: dto.attendanceWindowHours };
    await this.prisma.offer.update({ where: { id: offerId }, data });
    await this.recordStep(user, offer, 'attendance', data);
    return this.detail(offerId);
  }

  async updateWhatsapp(
    offerId: string,
    dto: UpdateWhatsappStepDto,
    user: AdminUser,
  ): Promise<AdminOfferDetailDto> {
    const offer = await this.require(offerId);
    if (dto.whatsappGroupUrl && !isWhatsappGroupUrl(dto.whatsappGroupUrl)) {
      throw AppException.validation([
        {
          field: 'whatsappGroupUrl',
          code: 'INVALID',
          message: 'Usa un enlace https://chat.whatsapp.com/…',
        },
      ]);
    }
    const data: OfferData = {};
    if (dto.whatsappGroupUrl !== undefined) data.whatsappGroupUrl = dto.whatsappGroupUrl;
    const visibleFrom = dateOrNull(dto.whatsappVisibleFrom);
    if (visibleFrom !== undefined) data.whatsappVisibleFrom = visibleFrom;
    await this.prisma.offer.update({ where: { id: offerId }, data });
    await this.recordStep(user, offer, 'whatsapp', data);
    return this.detail(offerId);
  }

  // --- Publicación --------------------------------------------------------------------------------

  async changePublication(
    offerId: string,
    action: PublicationAction,
    user: AdminUser,
  ): Promise<AdminOfferDetailDto> {
    const offer = await this.require(offerId);
    const to = publicationTransition(offer.publicationStatus, action);
    if (!to) {
      throw new AppException('OFFER_INVALID_STATE', {
        meta: { publicationStatus: offer.publicationStatus },
      });
    }
    if (action === 'PUBLISH') {
      const wizard = offerWizardStatus(offer);
      if (!wizard.canPublish) {
        const steps = WIZARD_STEPS.filter((s) =>
          wizard.publishBlockers.some((b) => b.field.startsWith(`${s.slug}.`)),
        ).map((s) => s.step);
        throw new AppException('OFFER_INCOMPLETE', {
          details: wizard.publishBlockers,
          meta: { steps },
        });
      }
    }
    const now = nowUtc();
    const updated = await this.prisma.offer.updateMany({
      where: { id: offerId, publicationStatus: offer.publicationStatus },
      data: {
        publicationStatus: to,
        ...(to === 'PUBLISHED' ? { publishedAt: offer.publishedAt ?? now } : {}),
      },
    });
    if (updated.count === 0) {
      throw new AppException('OFFER_INVALID_STATE', {
        meta: { publicationStatus: offer.publicationStatus },
      });
    }
    const verb = { PUBLISH: 'Publicó', UNPUBLISH: 'Despublicó', ARCHIVE: 'Archivó' }[action];
    await this.audit.record({
      actor: user,
      action: `offer.${action.toLowerCase()}`,
      entityType: 'Offer',
      entityId: offerId,
      summary: `${verb} la oferta «${offer.name}».`,
      before: { publicationStatus: offer.publicationStatus },
      after: { publicationStatus: to },
    });
    return this.detail(offerId);
  }

  /**
   * "Duplicar" (nueva cohorte): copia contenido, precio, beca, regla (sin fechas excluidas), docentes,
   * módulos y recursos (OCULTOS y pendientes de notificar, sin fechas de actividad). Limpia fechas,
   * sesiones, WhatsApp e inscripciones. Queda en borrador.
   */
  async duplicate(
    offerId: string,
    dto: DuplicateOfferRequestDto,
    user: AdminUser,
  ): Promise<AdminOfferDetailDto> {
    const source = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        teachers: true,
        modules: { orderBy: { position: 'asc' }, include: { resources: true } },
      },
    });
    if (!source) throw AppException.notFound('La oferta no existe.');
    let name = dto.name?.trim();
    if (name) await this.assertNameFree(name);
    else {
      const similar = await this.prisma.offer.findMany({
        where: { name: { startsWith: source.name.replace(/ \(copia(?: \d+)?\)$/, '') } },
        select: { name: true },
      });
      const taken = new Set(similar.map((o) => o.name.toLowerCase()));
      name = duplicateName(source.name, (n) => taken.has(n.toLowerCase()));
    }
    const slug = await this.freeSlug(name);
    const rule = safeParseScheduleRule(source.scheduleRule);
    const {
      id: _id,
      teachers,
      modules,
      createdAt: _c,
      updatedAt: _u,
      scheduleRule: _r,
      ...fields
    } = source;
    void _id;
    void _c;
    void _u;
    void _r;
    const copy = await this.prisma
      .$transaction(async (tx) => {
        const created = await tx.offer.create({
          data: {
            ...fields,
            name,
            slug,
            cohortLabel: dto.cohortLabel !== undefined ? dto.cohortLabel : source.cohortLabel,
            publicationStatus: 'DRAFT',
            publishedAt: null,
            enrollmentOpensAt: null,
            enrollmentClosesAt: null,
            startsAt: null,
            endsAt: null,
            finalProjectDueAt: null,
            scholarshipOpensAt: null,
            scholarshipClosesAt: null,
            whatsappGroupUrl: null,
            whatsappVisibleFrom: null,
            whatsappNotifiedAt: null,
            scheduleRule: rule ? { ...rule, excludedDates: [] } : Prisma.DbNull,
          },
        });
        await tx.offerTeacher.createMany({
          data: teachers.map((t) => ({
            offerId: created.id,
            teacherId: t.teacherId,
            position: t.position,
          })),
        });
        for (const module of modules) {
          const newModule = await tx.offerModule.create({
            data: {
              offerId: created.id,
              position: module.position,
              title: module.title,
              description: module.description,
              teacherId: module.teacherId,
              visibility: 'HIDDEN',
              publishAt: null,
              notifyEnrollees: module.notifyEnrollees,
            },
          });
          await tx.moduleResource.createMany({
            data: module.resources.map((r) => ({
              moduleId: newModule.id,
              type: r.type,
              title: r.title,
              description: r.description,
              fileKey: r.fileKey,
              fileName: r.fileName,
              mimeType: r.mimeType,
              sizeBytes: r.sizeBytes,
              url: r.url,
              libraryResourceId: r.libraryResourceId,
              position: r.position,
              visibility: 'HIDDEN' as const,
              notifyEnrollees: r.notifyEnrollees,
            })),
          });
        }
        return created;
      })
      .catch(rethrowNameTaken);
    await this.audit.record({
      actor: user,
      action: 'offer.duplicate',
      entityType: 'Offer',
      entityId: copy.id,
      summary: `Duplicó «${source.name}» como «${name}».`,
      after: { sourceOfferId: offerId, name, modules: modules.length },
    });
    return this.detail(copy.id);
  }

  /** Borra un borrador sin inscripciones, postulaciones ni pagos. */
  async remove(offerId: string, user: AdminUser): Promise<void> {
    const offer = await this.require(offerId);
    if (offer.publicationStatus !== 'DRAFT') {
      throw new AppException('OFFER_INVALID_STATE', {
        message: 'Solo se pueden borrar ofertas en borrador. Archívala en su lugar.',
        meta: { publicationStatus: offer.publicationStatus },
      });
    }
    const [enrollments, applications, payments] = await Promise.all([
      this.prisma.enrollment.count({ where: { offerId } }),
      this.prisma.application.count({ where: { offerId } }),
      this.prisma.payment.count({ where: { offerId } }),
    ]);
    if (enrollments + applications + payments > 0) throw new AppException('OFFER_HAS_ENROLLMENTS');
    await this.prisma.offer.delete({ where: { id: offerId } });
    await this.audit.record({
      actor: user,
      action: 'offer.delete',
      entityType: 'Offer',
      entityId: offerId,
      summary: `Borró el borrador «${offer.name}».`,
      before: { name: offer.name, type: offer.type },
    });
  }

  // ------------------------------------------------------------------------------------------------

  private async require(offerId: string): Promise<Offer> {
    const offer = await this.prisma.offer.findUnique({ where: { id: offerId } });
    if (!offer) throw AppException.notFound('La oferta no existe.');
    return offer;
  }

  private async assertNameFree(name: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.offer.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) throw nameTaken();
  }

  private async freeSlug(name: string, excludeId?: string): Promise<string> {
    const root = slugify(name).slice(0, 130) || 'oferta';
    const rows = await this.prisma.offer.findMany({
      where: { slug: { startsWith: root }, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { slug: true },
    });
    const taken = new Set(rows.map((r) => r.slug));
    return uniqueSlug(root, (s) => taken.has(s));
  }

  /** Tipo, modalidad y origen quedan fijos con inscritos o postulaciones enviadas (HU-27). */
  private async assertNoEnrollments(offerId: string): Promise<void> {
    const now = nowUtc();
    const [enrollments, applications] = await Promise.all([
      this.prisma.enrollment.count({ where: { offerId, ...seatHoldingWhere(now) } }),
      this.prisma.application.count({ where: { offerId, status: { not: 'DRAFT' } } }),
    ]);
    if (enrollments + applications > 0) {
      throw new AppException('OFFER_HAS_ENROLLMENTS', { meta: { enrollments, applications } });
    }
  }

  private async recordStep(
    user: AdminUser,
    offer: Offer,
    step: string,
    data: OfferData,
    extra: { before?: Record<string, unknown>; after?: Record<string, unknown> } = {},
  ): Promise<void> {
    const before: Record<string, unknown> = { ...extra.before };
    const after: Record<string, unknown> = { ...extra.after };
    for (const [key, value] of Object.entries(data)) {
      before[key] = (offer as unknown as Record<string, unknown>)[key];
      after[key] = value === Prisma.DbNull ? null : value;
    }
    await this.audit.record({
      actor: user,
      action: 'offer.update-step',
      entityType: 'Offer',
      entityId: offer.id,
      summary: `Guardó el paso «${WIZARD_STEPS.find((s) => s.slug === step)?.label ?? step}» de «${offer.name}».`,
      before,
      after,
    });
  }

  private statusOf(
    row: Pick<
      Offer,
      'publicationStatus' | 'enrollmentOpensAt' | 'enrollmentClosesAt' | 'startsAt' | 'endsAt'
    >,
    now: Date,
  ) {
    const availability = deriveOfferAvailability(row, now);
    return { availability, adminStatus: adminOfferStatus(row.publicationStatus, availability) };
  }

  private async toListItem(row: ListRow, now: Date): Promise<AdminOfferListItemDto> {
    const { availability, adminStatus } = this.statusOf(row, now);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      type: row.type,
      modality: row.modality,
      origin: row.origin,
      publicationStatus: row.publicationStatus,
      adminStatus,
      availability,
      cohortLabel: row.cohortLabel,
      startsAt: iso(row.startsAt),
      endsAt: iso(row.endsAt),
      coverImageUrl: row.coverImageKey ? await this.images.url(row.coverImageKey) : null,
      counts: { ...row._count },
      publicPath: `/escuela/oferta/${row.slug}`,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

/** Etiquetas de `adminStatus` (re-exportadas para la guía). */
export { ADMIN_OFFER_STATUS_LABELS };

function nameTaken(): AppException {
  return new AppException('OFFER_NAME_TAKEN', {
    details: [
      { field: 'name', code: 'ALREADY_EXISTS', message: 'Ya existe una oferta con ese nombre.' },
    ],
  });
}

function rethrowNameTaken(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    JSON.stringify(error.meta ?? {}).includes('name')
  ) {
    throw nameTaken();
  }
  throw error;
}
