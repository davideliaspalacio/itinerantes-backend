import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import type { AdminUser } from '../../../common/guards/permissions.guard';
import { nowUtc } from '../../../common/utils/time';
import { BUSINESS_RULES } from '../../../config/business-rules';
import type {
  ModuleResource,
  ModuleResourceType,
  OfferModule,
  Prisma,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { StorageService } from '../../../infra/storage/storage.service';
import { AuditService } from '../../audit/audit.service';
import { isPublishedNow, publishedNowWhere } from '../../classroom/policies/classroom.policy';
import { CLASSROOM_ACCESS_STATUSES } from '../../enrollments/policies/enrollment.policy';
import { recordingInfo } from '../../live-sessions/policies/session.policy';
import { NotificationsService } from '../../notifications/notifications.service';
import { PORTAL_LINKS } from '../../notifications/portal-links';
import type {
  AdminModuleDto,
  AdminModulesDto,
  AdminRecordingRowDto,
  AdminResourceDto,
  CreateModuleRequestDto,
  CreateResourceRequestDto,
  ModuleMutationDto,
  ReorderModulesRequestDto,
  ReorderResourcesRequestDto,
  ResourceFieldsDto,
  ResourceMutationDto,
  ResourceUploadUrlDto,
  ResourceUploadUrlRequestDto,
  UpdateModuleRequestDto,
} from './dto/admin-content.dto';
import {
  isCompletePermutation,
  isValidModuleResourceFile,
  isValidScheduledPublish,
  isWithinOfferPeriod,
  keyMatchesPrefix,
  MODULE_RESOURCE_MIME_TYPES,
  moduleResourcePrefix,
} from './policies/admin-content.policy';

const RESOURCE_LABELS: Record<ModuleResourceType, string> = {
  PRESENTATION: 'Presentación',
  PRE_READING: 'Lectura previa',
  ACTIVITY: 'Actividad',
};

const MODULE_INCLUDE = {
  teacher: { select: { id: true, fullName: true } },
  resources: {
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: { libraryResource: { select: { id: true, title: true } } },
  },
  sessions: {
    orderBy: { startsAt: 'asc' },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      status: true,
      recordingUrl: true,
      recordingPublishedAt: true,
    },
  },
} as const satisfies Prisma.OfferModuleInclude;

type ModuleRow = Prisma.OfferModuleGetPayload<{ include: typeof MODULE_INCLUDE }>;
type ResourceRow = ModuleRow['resources'][number];
type SessionRow = ModuleRow['sessions'][number];

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/**
 * Contenido del aula en el panel (HU-28): módulos (crear al final ocultos, ordenar, publicar u
 * ocultar, publicación programada) y recursos (presentación única, lecturas, actividades; archivo,
 * enlace o recurso de la Biblioteca). Al quedar visible algo con "Notificar a inscritos" se avisa una
 * sola vez (claim de `publishedNotifiedAt` + dedupeKey); la publicación programada la avisa el job
 * `AdminContentJobsService`.
 */
@Injectable()
export class AdminContentService {
  private readonly logger = new Logger(AdminContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async list(offerId: string): Promise<AdminModulesDto> {
    const now = nowUtc();
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      select: { id: true, name: true, modality: true },
    });
    if (!offer) throw AppException.notFound('La oferta no existe.');
    const [modules, unassigned, activeEnrollees] = await Promise.all([
      this.prisma.offerModule.findMany({
        where: { offerId },
        orderBy: { position: 'asc' },
        include: MODULE_INCLUDE,
      }),
      this.prisma.offerSession.findMany({
        where: { offerId, moduleId: null },
        orderBy: { startsAt: 'asc' },
        select: MODULE_INCLUDE.sessions.select,
      }),
      this.prisma.enrollment.count({
        where: { offerId, status: { in: [...CLASSROOM_ACCESS_STATUSES] } },
      }),
    ]);
    return {
      offerId,
      offerName: offer.name,
      modules: await Promise.all(
        modules.map((m, i) => this.toModuleDto(m, i + 1, offer.modality, now)),
      ),
      unassignedRecordings: unassigned.map((s) => toRecording(s, offer.modality, now)),
      activeEnrollees,
    };
  }

  // --- Módulos ------------------------------------------------------------------------------------

  async createModule(
    offerId: string,
    dto: CreateModuleRequestDto,
    user: AdminUser,
  ): Promise<ModuleMutationDto> {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      select: { id: true, name: true },
    });
    if (!offer) throw AppException.notFound('La oferta no existe.');
    if (dto.teacherId) await this.assertTeacher(dto.teacherId);
    const last = await this.prisma.offerModule.aggregate({
      where: { offerId },
      _max: { position: true },
    });
    const module = await this.prisma.offerModule.create({
      data: {
        offerId,
        position: (last._max.position ?? 0) + 1,
        title: dto.title.trim(),
        description: dto.description ?? null,
        teacherId: dto.teacherId ?? null,
        visibility: 'HIDDEN',
      },
    });
    await this.audit.record({
      actor: user,
      action: 'module.create',
      entityType: 'OfferModule',
      entityId: module.id,
      summary: `Agregó el módulo ${module.position} «${module.title}» a «${offer.name}».`,
      after: { offerId, position: module.position, title: module.title },
    });
    return { module: await this.moduleDto(module.id), notifiedCount: 0 };
  }

  async updateModule(
    moduleId: string,
    dto: UpdateModuleRequestDto,
    user: AdminUser,
  ): Promise<ModuleMutationDto> {
    const now = nowUtc();
    const current = await this.requireModule(moduleId);
    const data: Prisma.OfferModuleUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.teacherId !== undefined) {
      if (dto.teacherId) await this.assertTeacher(dto.teacherId);
      data.teacherId = dto.teacherId;
    }
    if (dto.visibility !== undefined) data.visibility = dto.visibility;
    if (dto.publishAt !== undefined) {
      const publishAt = dto.publishAt === null ? null : new Date(dto.publishAt);
      if (publishAt?.getTime() !== current.publishAt?.getTime()) {
        assertFuture(publishAt, now);
      }
      data.publishAt = publishAt;
    }
    if (dto.notifyEnrollees !== undefined) data.notifyEnrollees = dto.notifyEnrollees;
    await this.prisma.offerModule.update({ where: { id: moduleId }, data });
    const notifiedCount = await this.publishPending(now, current.offerId);
    await this.audit.record({
      actor: user,
      action: 'module.update',
      entityType: 'OfferModule',
      entityId: moduleId,
      summary: `Editó el módulo «${current.title}»${notifiedCount ? ` y notificó a ${notifiedCount} inscritos` : ''}.`,
      before: pick(current, Object.keys(data)),
      after: data,
    });
    return { module: await this.moduleDto(moduleId), notifiedCount };
  }

  async reorderModules(
    offerId: string,
    dto: ReorderModulesRequestDto,
    user: AdminUser,
  ): Promise<AdminModulesDto> {
    const existing = await this.prisma.offerModule.findMany({
      where: { offerId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    if (
      !isCompletePermutation(
        dto.moduleIds,
        existing.map((m) => m.id),
      )
    ) {
      throw AppException.validation([
        {
          field: 'moduleIds',
          code: 'INVALID',
          message: 'Envía todos los módulos de la oferta, sin repetir.',
        },
      ]);
    }
    await this.prisma.$transaction(
      dto.moduleIds.map((id, index) =>
        this.prisma.offerModule.update({ where: { id }, data: { position: index + 1 } }),
      ),
    );
    await this.audit.record({
      actor: user,
      action: 'module.reorder',
      entityType: 'Offer',
      entityId: offerId,
      summary: 'Reordenó los módulos.',
      before: { moduleIds: existing.map((m) => m.id) },
      after: { moduleIds: dto.moduleIds },
    });
    return this.list(offerId);
  }

  async deleteModule(moduleId: string, user: AdminUser): Promise<void> {
    const module = await this.prisma.offerModule.findUnique({
      where: { id: moduleId },
      include: { resources: { select: { id: true, fileKey: true } } },
    });
    if (!module) throw AppException.notFound('El módulo no existe.');
    await this.prisma.$transaction(async (tx) => {
      await tx.offerModule.delete({ where: { id: moduleId } });
      const rest = await tx.offerModule.findMany({
        where: { offerId: module.offerId },
        orderBy: { position: 'asc' },
        select: { id: true },
      });
      for (const [index, m] of rest.entries()) {
        await tx.offerModule.update({ where: { id: m.id }, data: { position: index + 1 } });
      }
    });
    for (const r of module.resources) if (r.fileKey) await this.deleteFileIfUnused(r.fileKey);
    await this.audit.record({
      actor: user,
      action: 'module.delete',
      entityType: 'OfferModule',
      entityId: moduleId,
      summary: `Borró el módulo «${module.title}» y sus ${module.resources.length} recursos.`,
      before: {
        title: module.title,
        position: module.position,
        resources: module.resources.length,
      },
    });
  }

  // --- Recursos -----------------------------------------------------------------------------------

  async resourceUploadUrl(
    moduleId: string,
    dto: ResourceUploadUrlRequestDto,
  ): Promise<ResourceUploadUrlDto> {
    const module = await this.requireModule(moduleId);
    if (
      !isValidModuleResourceFile(dto.type, { mimeType: dto.contentType, sizeBytes: dto.sizeBytes })
    ) {
      throw invalidFile(dto.type);
    }
    const key = StorageService.buildKey(
      moduleResourcePrefix(module.offerId, moduleId),
      dto.fileName,
    );
    const signed = await this.storage.getUploadUrl(key, { contentType: dto.contentType });
    return {
      uploadUrl: signed.url,
      method: 'PUT',
      headers: { 'Content-Type': dto.contentType },
      key,
      expiresAt: signed.expiresAt,
      maxBytes: BUSINESS_RULES.FILE_LIMITS.MODULE_RESOURCE.maxBytes,
    };
  }

  async createResource(
    moduleId: string,
    dto: CreateResourceRequestDto,
    user: AdminUser,
  ): Promise<ResourceMutationDto> {
    const now = nowUtc();
    const module = await this.requireModule(moduleId);
    const data = await this.resourceData(module, dto.type, dto, null, now);
    const previous =
      dto.type === 'PRESENTATION'
        ? await this.prisma.moduleResource.findMany({ where: { moduleId, type: 'PRESENTATION' } })
        : [];
    const last = await this.prisma.moduleResource.aggregate({
      where: { moduleId, type: dto.type },
      _max: { position: true },
    });
    const resource = await this.prisma.$transaction(async (tx) => {
      if (previous.length) {
        await tx.moduleResource.deleteMany({ where: { id: { in: previous.map((p) => p.id) } } });
      }
      return tx.moduleResource.create({
        data: {
          moduleId,
          type: dto.type,
          title: dto.title.trim(),
          position: (last._max.position ?? -1) + 1,
          visibility: 'HIDDEN',
          ...data,
        } as Prisma.ModuleResourceUncheckedCreateInput,
      });
    });
    for (const p of previous) if (p.fileKey) await this.deleteFileIfUnused(p.fileKey);
    const notifiedCount = await this.publishPending(now, module.offerId);
    await this.audit.record({
      actor: user,
      action: 'resource.create',
      entityType: 'ModuleResource',
      entityId: resource.id,
      summary:
        `Agregó «${resource.title}» (${RESOURCE_LABELS[resource.type]}) al módulo «${module.title}»` +
        `${previous.length ? ', reemplazando la presentación anterior' : ''}` +
        `${notifiedCount ? ` y notificó a ${notifiedCount} inscritos` : ''}.`,
      after: { moduleId, type: resource.type, title: resource.title, ...data },
    });
    return {
      resource: await this.resourceDto(resource.id, now),
      notifiedCount,
      replacedResourceId: previous[0]?.id ?? null,
    };
  }

  async updateResource(
    resourceId: string,
    dto: ResourceFieldsDto,
    user: AdminUser,
  ): Promise<ResourceMutationDto> {
    const now = nowUtc();
    const current = await this.prisma.moduleResource.findUnique({
      where: { id: resourceId },
      include: { module: { include: { offer: { select: { startsAt: true, endsAt: true } } } } },
    });
    if (!current) throw AppException.notFound('El recurso no existe.');
    const data = await this.resourceData(current.module, current.type, dto, current, now);
    if (dto.title !== undefined) data.title = dto.title.trim();
    await this.prisma.moduleResource.update({ where: { id: resourceId }, data });
    if (current.fileKey && data.fileKey !== undefined && data.fileKey !== current.fileKey) {
      await this.deleteFileIfUnused(current.fileKey);
    }
    const notifiedCount = await this.publishPending(now, current.module.offerId);
    await this.audit.record({
      actor: user,
      action: 'resource.update',
      entityType: 'ModuleResource',
      entityId: resourceId,
      summary: `Editó «${current.title}»${notifiedCount ? ` y notificó a ${notifiedCount} inscritos` : ''}.`,
      before: pick(current, Object.keys(data)),
      after: data,
    });
    return {
      resource: await this.resourceDto(resourceId, now),
      notifiedCount,
      replacedResourceId: null,
    };
  }

  async reorderResources(
    moduleId: string,
    dto: ReorderResourcesRequestDto,
    user: AdminUser,
  ): Promise<AdminModuleDto> {
    await this.requireModule(moduleId);
    const existing = await this.prisma.moduleResource.findMany({
      where: { moduleId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    if (
      !isCompletePermutation(
        dto.resourceIds,
        existing.map((r) => r.id),
      )
    ) {
      throw AppException.validation([
        {
          field: 'resourceIds',
          code: 'INVALID',
          message: 'Envía todos los recursos del módulo, sin repetir.',
        },
      ]);
    }
    await this.prisma.$transaction(
      dto.resourceIds.map((id, index) =>
        this.prisma.moduleResource.update({ where: { id }, data: { position: index } }),
      ),
    );
    await this.audit.record({
      actor: user,
      action: 'resource.reorder',
      entityType: 'OfferModule',
      entityId: moduleId,
      summary: 'Reordenó los recursos del módulo.',
      before: { resourceIds: existing.map((r) => r.id) },
      after: { resourceIds: dto.resourceIds },
    });
    return this.moduleDto(moduleId);
  }

  async deleteResource(resourceId: string, user: AdminUser): Promise<void> {
    const resource = await this.prisma.moduleResource.findUnique({ where: { id: resourceId } });
    if (!resource) throw AppException.notFound('El recurso no existe.');
    await this.prisma.moduleResource.delete({ where: { id: resourceId } });
    if (resource.fileKey) await this.deleteFileIfUnused(resource.fileKey);
    await this.audit.record({
      actor: user,
      action: 'resource.delete',
      entityType: 'ModuleResource',
      entityId: resourceId,
      summary: `Borró «${resource.title}» (${RESOURCE_LABELS[resource.type]}).`,
      before: {
        title: resource.title,
        type: resource.type,
        fileKey: resource.fileKey,
        url: resource.url,
      },
    });
  }

  // --- Notificación de publicación (HU-28) ---------------------------------------------------------

  /**
   * Notifica a los inscritos activos lo que quedó VISIBLE y está pendiente de aviso: primero módulos
   * (un solo aviso que incluye sus recursos visibles pendientes) y luego recursos sueltos de módulos
   * visibles. Idempotente: claim atómico de `publishedNotifiedAt` + dedupeKey. Devuelve el número de
   * avisos creados (personas × elementos). La usan los endpoints y el job.
   */
  async publishPending(now: Date = nowUtc(), offerId?: string): Promise<number> {
    let notified = 0;
    const modules = await this.prisma.offerModule.findMany({
      where: {
        notifyEnrollees: true,
        publishedNotifiedAt: null,
        ...publishedNowWhere(now),
        ...(offerId ? { offerId } : {}),
      },
      include: { offer: { select: { id: true, name: true } } },
      orderBy: { position: 'asc' },
    });
    for (const module of modules) {
      const claim = await this.prisma.offerModule.updateMany({
        where: { id: module.id, publishedNotifiedAt: null },
        data: { publishedNotifiedAt: now },
      });
      if (claim.count === 0) continue;
      const absorbed = await this.prisma.moduleResource.updateMany({
        where: {
          moduleId: module.id,
          notifyEnrollees: true,
          publishedNotifiedAt: null,
          ...publishedNowWhere(now),
        },
        data: { publishedNotifiedAt: now },
      });
      notified += await this.notifyEnrollees(module.offer, {
        title: `Nuevo módulo disponible: ${module.title}`,
        body:
          `Ya puedes consultar el módulo «${module.title}» de ${module.offer.name}` +
          `${absorbed.count ? ` con ${absorbed.count} material${absorbed.count === 1 ? '' : 'es'}` : ''} en tu aula.`,
        moduleId: module.id,
        dedupeKey: `material:module:${module.id}`,
      });
    }

    const resources = await this.prisma.moduleResource.findMany({
      where: {
        notifyEnrollees: true,
        publishedNotifiedAt: null,
        ...publishedNowWhere(now),
        module: { ...publishedNowWhere(now), ...(offerId ? { offerId } : {}) },
      },
      include: {
        module: { select: { id: true, title: true, offer: { select: { id: true, name: true } } } },
      },
    });
    for (const resource of resources) {
      const claim = await this.prisma.moduleResource.updateMany({
        where: { id: resource.id, publishedNotifiedAt: null },
        data: { publishedNotifiedAt: now },
      });
      if (claim.count === 0) continue;
      notified += await this.notifyEnrollees(resource.module.offer, {
        title: `Nuevo material: ${resource.title}`,
        body:
          `Se publicó «${resource.title}» (${RESOURCE_LABELS[resource.type]}) en el módulo ` +
          `«${resource.module.title}» de ${resource.module.offer.name}.`,
        moduleId: resource.module.id,
        dedupeKey: `material:resource:${resource.id}`,
        resourceId: resource.id,
      });
    }
    return notified;
  }

  private async notifyEnrollees(
    offer: { id: string; name: string },
    message: {
      title: string;
      body: string;
      moduleId: string;
      dedupeKey: string;
      resourceId?: string;
    },
  ): Promise<number> {
    try {
      const enrollments = await this.prisma.enrollment.findMany({
        where: { offerId: offer.id, status: { in: [...CLASSROOM_ACCESS_STATUSES] } },
        select: { userId: true },
      });
      const created = await this.notifications.notify({
        userIds: enrollments.map((e) => e.userId),
        type: 'MATERIAL_PUBLISHED',
        title: message.title,
        body: message.body,
        action: {
          label: 'Ver materiales',
          path: PORTAL_LINKS.materials(offer.id, message.moduleId),
        },
        data: {
          offerId: offer.id,
          moduleId: message.moduleId,
          resourceId: message.resourceId ?? null,
        },
        dedupeKey: message.dedupeKey,
      });
      return created.length;
    } catch (error) {
      this.logger.error(
        { err: error, offerId: offer.id },
        'No se pudo notificar el material publicado',
      );
      return 0;
    }
  }

  // ------------------------------------------------------------------------------------------------

  /** Datos validados de un recurso (fuente única, archivo verificado, fecha de actividad, publicación). */
  private async resourceData(
    module: OfferModule & { offer: { startsAt: Date | null; endsAt: Date | null } },
    type: ModuleResourceType,
    dto: ResourceFieldsDto,
    current: ModuleResource | null,
    now: Date,
  ): Promise<Prisma.ModuleResourceUncheckedUpdateInput> {
    const data: Prisma.ModuleResourceUncheckedUpdateInput = {};
    if (dto.description !== undefined) data.description = dto.description;
    const touched =
      !current ||
      dto.fileKey !== undefined ||
      dto.url !== undefined ||
      dto.libraryResourceId !== undefined;
    if (touched) {
      const fileKey = dto.fileKey ?? null;
      const url = dto.url ?? null;
      const libraryResourceId = dto.libraryResourceId ?? null;
      const sources = [fileKey, url, libraryResourceId].filter((v) => v !== null).length;
      if (sources !== 1) {
        throw AppException.validation([
          {
            field: 'fileKey',
            code: 'INVALID',
            message: 'Indica una sola fuente: archivo, enlace o recurso de la Biblioteca.',
          },
        ]);
      }
      if (libraryResourceId) {
        if (type !== 'PRE_READING') {
          throw AppException.validation([
            {
              field: 'libraryResourceId',
              code: 'NOT_APPLICABLE',
              message: 'Solo las lecturas previas enlazan la Biblioteca.',
            },
          ]);
        }
        const exists = await this.prisma.libraryResource.count({
          where: { id: libraryResourceId },
        });
        if (!exists) {
          throw AppException.validation([
            {
              field: 'libraryResourceId',
              code: 'INVALID',
              message: 'El recurso de la Biblioteca no existe.',
            },
          ]);
        }
      }
      Object.assign(data, { fileKey, url, libraryResourceId });
      if (fileKey && fileKey !== current?.fileKey) {
        Object.assign(data, await this.verifyFile(module, type, fileKey, dto.fileName));
      } else if (!fileKey) {
        Object.assign(data, { fileName: null, mimeType: null, sizeBytes: null });
      }
    }
    if (dto.activityDueAt !== undefined) {
      const due = dto.activityDueAt === null ? null : new Date(dto.activityDueAt);
      if (due && type !== 'ACTIVITY') {
        throw AppException.validation([
          {
            field: 'activityDueAt',
            code: 'NOT_APPLICABLE',
            message: 'Solo las actividades llevan fecha.',
          },
        ]);
      }
      if (due && !isWithinOfferPeriod(due, module.offer)) {
        throw AppException.validation([
          {
            field: 'activityDueAt',
            code: 'INVALID',
            message: 'La fecha debe estar dentro del periodo de la oferta.',
          },
        ]);
      }
      data.activityDueAt = due;
    }
    if (dto.visibility !== undefined) data.visibility = dto.visibility;
    if (dto.publishAt !== undefined) {
      const publishAt = dto.publishAt === null ? null : new Date(dto.publishAt);
      if (publishAt?.getTime() !== current?.publishAt?.getTime()) assertFuture(publishAt, now);
      data.publishAt = publishAt;
    }
    if (dto.notifyEnrollees !== undefined) data.notifyEnrollees = dto.notifyEnrollees;
    return data;
  }

  private async verifyFile(
    module: OfferModule,
    type: ModuleResourceType,
    key: string,
    fileName?: string,
  ): Promise<Prisma.ModuleResourceUncheckedUpdateInput> {
    if (!keyMatchesPrefix(key, moduleResourcePrefix(module.offerId, module.id))) {
      throw new AppException('ADMIN_UPLOAD_NOT_FOUND');
    }
    const head = await this.storage.head(key);
    if (!head) throw new AppException('ADMIN_UPLOAD_NOT_FOUND');
    const mimeType = head.contentType ?? '';
    const sizeBytes = head.contentLength ?? 0;
    if (!isValidModuleResourceFile(type, { mimeType, sizeBytes })) {
      await this.deleteFileIfUnused(key);
      throw invalidFile(type);
    }
    return { fileName: fileName ?? key.split('/').pop()!, mimeType, sizeBytes };
  }

  /** Borra un archivo de storage si ningún recurso lo usa (las ofertas duplicadas comparten keys). */
  private async deleteFileIfUnused(key: string): Promise<void> {
    try {
      const used = await this.prisma.moduleResource.count({ where: { fileKey: key } });
      if (used === 0) await this.storage.delete(key);
    } catch (error) {
      this.logger.warn({ err: error, key }, 'No se pudo borrar el archivo del recurso');
    }
  }

  private async assertTeacher(teacherId: string): Promise<void> {
    const exists = await this.prisma.teacher.count({ where: { id: teacherId } });
    if (!exists) {
      throw AppException.validation([
        { field: 'teacherId', code: 'INVALID', message: 'El docente no existe.' },
      ]);
    }
  }

  private async requireModule(
    moduleId: string,
  ): Promise<OfferModule & { offer: { startsAt: Date | null; endsAt: Date | null } }> {
    const module = await this.prisma.offerModule.findUnique({
      where: { id: moduleId },
      include: { offer: { select: { startsAt: true, endsAt: true } } },
    });
    if (!module) throw AppException.notFound('El módulo no existe.');
    return module;
  }

  private async moduleDto(moduleId: string): Promise<AdminModuleDto> {
    const now = nowUtc();
    const module = await this.prisma.offerModule.findUniqueOrThrow({
      where: { id: moduleId },
      include: { ...MODULE_INCLUDE, offer: { select: { modality: true } } },
    });
    const number =
      (await this.prisma.offerModule.count({
        where: { offerId: module.offerId, position: { lt: module.position } },
      })) + 1;
    return this.toModuleDto(module, number, module.offer.modality, now);
  }

  private async resourceDto(resourceId: string, now: Date): Promise<AdminResourceDto> {
    const resource = await this.prisma.moduleResource.findUniqueOrThrow({
      where: { id: resourceId },
      include: {
        libraryResource: { select: { id: true, title: true } },
        module: { select: { visibility: true, publishAt: true } },
      },
    });
    return this.toResourceDto(resource, isPublishedNow(resource.module, now), now);
  }

  private async toModuleDto(
    module: ModuleRow,
    number: number,
    modality: 'ONLINE_LIVE' | 'IN_PERSON',
    now: Date,
  ): Promise<AdminModuleDto> {
    const moduleVisible = isPublishedNow(module, now);
    const resources = await Promise.all(
      module.resources.map((r) => this.toResourceDto(r, moduleVisible, now)),
    );
    const presentations = resources
      .filter((r) => r.type === 'PRESENTATION')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return {
      id: module.id,
      number,
      title: module.title,
      description: module.description,
      teacher: module.teacher,
      visibility: module.visibility,
      publishAt: iso(module.publishAt),
      visibleNow: moduleVisible,
      notifyEnrollees: module.notifyEnrollees,
      notifiedAt: iso(module.publishedNotifiedAt),
      sections: {
        presentation: presentations[0] ?? null,
        preReadings: resources.filter((r) => r.type === 'PRE_READING'),
        activities: resources.filter((r) => r.type === 'ACTIVITY'),
        recordings: module.sessions.map((s) => toRecording(s, modality, now)),
      },
    };
  }

  private async toResourceDto(
    r: ResourceRow,
    moduleVisible: boolean,
    now: Date,
  ): Promise<AdminResourceDto> {
    return {
      id: r.id,
      type: r.type,
      title: r.title,
      description: r.description,
      source: r.fileKey ? 'FILE' : r.url ? 'URL' : r.libraryResourceId ? 'LIBRARY' : 'NONE',
      file: r.fileKey
        ? {
            key: r.fileKey,
            fileName: r.fileName,
            mimeType: r.mimeType,
            sizeBytes: r.sizeBytes,
            downloadUrl: (
              await this.storage.getDownloadUrl(r.fileKey, {
                expiresInSeconds: BUSINESS_RULES.PRIVATE_FILE_URL_TTL_SECONDS,
                downloadFileName: r.fileName ?? undefined,
              })
            ).url,
          }
        : null,
      url: r.url,
      library: r.libraryResource,
      activityDueAt: iso(r.activityDueAt),
      position: r.position,
      visibility: r.visibility,
      publishAt: iso(r.publishAt),
      visibleNow: moduleVisible && isPublishedNow(r, now),
      notifyEnrollees: r.notifyEnrollees,
      notifiedAt: iso(r.publishedNotifiedAt),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}

function toRecording(
  s: SessionRow,
  modality: 'ONLINE_LIVE' | 'IN_PERSON',
  now: Date,
): AdminRecordingRowDto {
  const info = recordingInfo(
    { status: s.status, modality, endsAt: s.endsAt, recordingUrl: s.recordingUrl },
    now,
  );
  return {
    sessionId: s.id,
    startsAt: s.startsAt.toISOString(),
    endsAt: s.endsAt.toISOString(),
    status: s.status,
    recordingUrl: s.recordingUrl,
    recordingPublishedAt: iso(s.recordingPublishedAt),
    state: info.state,
    pending: info.state === 'PENDING',
  };
}

function assertFuture(publishAt: Date | null, now: Date): void {
  if (!isValidScheduledPublish(publishAt, now)) {
    throw AppException.validation([
      {
        field: 'publishAt',
        code: 'INVALID',
        message: 'La publicación programada debe ser a futuro.',
      },
    ]);
  }
}

function invalidFile(type: ModuleResourceType): AppException {
  return new AppException('ADMIN_UPLOAD_INVALID_FILE', {
    message: `Formato o tamaño no permitido para ${RESOURCE_LABELS[type].toLowerCase()} (máximo 50 MB).`,
    meta: {
      allowedTypes: MODULE_RESOURCE_MIME_TYPES[type],
      maxBytes: BUSINESS_RULES.FILE_LIMITS.MODULE_RESOURCE.maxBytes,
    },
  });
}

function pick(source: object, keys: string[]): Record<string, unknown> {
  const record = source as Record<string, unknown>;
  return Object.fromEntries(keys.map((k) => [k, record[k]]));
}
