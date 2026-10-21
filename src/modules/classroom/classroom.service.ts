import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import type { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { nowUtc } from '../../common/utils/time';
import { BUSINESS_RULES } from '../../config/business-rules';
import type { ModuleResourceType, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import type { AccessUrlDto } from '../enrollments/dto/portal-shared.dto';
import { EnrollmentAccessService } from '../enrollments/enrollment-access.service';
import { deriveFormationPhase } from '../enrollments/policies/enrollment.policy';
import { computeProgress } from '../enrollments/policies/progress.policy';
import { resourceAccessKind } from '../library/library.policy';
import type { ListSessionsQueryDto, SessionCardDto } from '../live-sessions/dto/sessions.dto';
import { LiveSessionsService } from '../live-sessions/live-sessions.service';
import { recordingInfo } from '../live-sessions/policies/session.policy';
import { sessionViewSelect, toSessionCard } from '../live-sessions/session-view';
import type {
  ClassroomDto,
  ConfirmFinalProjectRequestDto,
  FinalProjectDto,
  FinalProjectUploadRequestDto,
  MaterialModuleDto,
  MaterialResourceDto,
  MaterialsDto,
  UploadUrlDto,
} from './dto/classroom.dto';
import {
  deriveModuleStatus,
  finalProjectKeyPrefix,
  finalProjectSubmissionState,
  isPublishedNow,
  isValidFinalProjectFile,
  publishedNowWhere,
  showsFinalProject,
  whatsappInfo,
} from './policies/classroom.policy';

const RESOURCE_SELECT = {
  id: true,
  type: true,
  title: true,
  description: true,
  fileKey: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  url: true,
  activityDueAt: true,
  position: true,
  updatedAt: true,
  libraryResource: {
    select: {
      fileKey: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      url: true,
      visibility: true,
      publishAt: true,
    },
  },
} as const satisfies Prisma.ModuleResourceSelect;

type ResourceRow = Prisma.ModuleResourceGetPayload<{ select: typeof RESOURCE_SELECT }>;

/**
 * Aula (HU-17), materiales (HU-08) y proyecto final. Todo exige acceso al Aula
 * (`EnrollmentAccessService.requireClassroomAccess`). Archivos privados SIEMPRE con URL firmada
 * temporal (`getDownloadUrl`), nunca `getPublicUrl`.
 */
@Injectable()
export class ClassroomService {
  private readonly logger = new Logger(ClassroomService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly access: EnrollmentAccessService,
    private readonly sessions: LiveSessionsService,
  ) {}

  async classroom(userId: string, offerId: string): Promise<ClassroomDto> {
    const enrollment = await this.access.requireClassroomAccess(userId, offerId);
    const now = nowUtc();
    const offer = await this.prisma.offer.findUniqueOrThrow({
      where: { id: offerId },
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        modality: true,
        coverImageKey: true,
        cohortLabel: true,
        startsAt: true,
        endsAt: true,
        totalMinutes: true,
        venueName: true,
        venueAddress: true,
        venueCity: true,
        venueMapsUrl: true,
        whatsappGroupUrl: true,
        whatsappVisibleFrom: true,
        classroomWelcome: true,
        finalProjectDueAt: true,
        finalProjectSubmissionEnabled: true,
        finalProjectGuidelines: true,
        teachers: {
          orderBy: { position: 'asc' },
          select: { teacher: { select: { fullName: true, photoKey: true } } },
        },
        sessions: {
          select: {
            id: true,
            moduleId: true,
            status: true,
            startsAt: true,
            endsAt: true,
            recordingUrl: true,
          },
          orderBy: { startsAt: 'asc' },
        },
        modules: {
          where: publishedNowWhere(now),
          orderBy: { position: 'asc' },
          select: {
            id: true,
            position: true,
            title: true,
            description: true,
            teacher: { select: { fullName: true } },
            resources: {
              where: publishedNowWhere(now),
              select: { type: true },
            },
          },
        },
      },
    });

    const [attended, next, submission] = await Promise.all([
      this.prisma.sessionAttendance.findMany({
        where: { userId, session: { offerId } },
        select: { sessionId: true },
      }),
      this.prisma.offerSession.findFirst({
        where: { offerId, status: 'SCHEDULED', endsAt: { gt: now } },
        orderBy: { startsAt: 'asc' },
        select: sessionViewSelect(userId),
      }),
      showsFinalProject(offer.type)
        ? this.prisma.finalProjectSubmission.findUnique({ where: { enrollmentId: enrollment.id } })
        : Promise.resolve(null),
    ]);

    const offerTeacherNames = offer.teachers.map(({ teacher }) => teacher.fullName);
    const firstSession =
      offer.sessions.find((s) => s.status === 'SCHEDULED')?.startsAt ?? offer.startsAt;
    const whatsapp = whatsappInfo(
      {
        url: offer.whatsappGroupUrl,
        visibleFrom: offer.whatsappVisibleFrom,
        firstSessionStartsAt: firstSession,
      },
      now,
    );

    return {
      enrollment: {
        id: enrollment.id,
        status: enrollment.status,
        phase: deriveFormationPhase(enrollment.status, offer.endsAt, now),
        origin: enrollment.origin,
        enrolledAt: (enrollment.activatedAt ?? enrollment.createdAt).toISOString(),
      },
      offer: {
        id: offer.id,
        slug: offer.slug,
        name: offer.name,
        type: offer.type,
        modality: offer.modality,
        coverImageUrl: offer.coverImageKey ? await this.publicImage(offer.coverImageKey) : null,
        cohortLabel: offer.cohortLabel,
        startsAt: offer.startsAt?.toISOString() ?? null,
        endsAt: offer.endsAt?.toISOString() ?? null,
        totalHours: offer.totalMinutes !== null ? offer.totalMinutes / 60 : null,
        venue:
          offer.modality === 'IN_PERSON' && offer.venueName
            ? {
                name: offer.venueName,
                address: offer.venueAddress,
                city: offer.venueCity,
                mapsUrl: offer.venueMapsUrl,
              }
            : null,
        teachers: await Promise.all(
          offer.teachers.map(async ({ teacher }) => ({
            fullName: teacher.fullName,
            photoUrl: teacher.photoKey ? await this.publicImage(teacher.photoKey) : null,
          })),
        ),
      },
      progress: computeProgress(offer.sessions, new Set(attended.map((a) => a.sessionId))),
      welcome: {
        preStart: whatsapp.preStart,
        message: offer.classroomWelcome,
        firstSessionStartsAt: firstSession?.toISOString() ?? null,
        whatsapp: {
          available: whatsapp.available,
          url: whatsapp.url,
          availableFrom: whatsapp.availableFrom?.toISOString() ?? null,
        },
      },
      nextSession: next ? toSessionCard(next, now) : null,
      modules: offer.modules.map((module) => {
        const moduleSessions = offer.sessions.filter((s) => s.moduleId === module.id);
        const count = (type: ModuleResourceType) =>
          module.resources.filter((r) => r.type === type).length;
        return {
          id: module.id,
          number: module.position,
          title: module.title,
          description: module.description,
          status: deriveModuleStatus(moduleSessions, offer, now),
          teacherNames: module.teacher ? [module.teacher.fullName] : offerTeacherNames,
          resourceCounts: {
            presentation: Math.min(count('PRESENTATION'), 1),
            preReadings: count('PRE_READING'),
            activities: count('ACTIVITY'),
            recordings: moduleSessions.filter((s) => s.status !== 'CANCELLED' && s.recordingUrl)
              .length,
          },
        };
      }),
      finalProject: showsFinalProject(offer.type) ? toFinalProject(offer, submission, now) : null,
    };
  }

  /** HU-08: módulos publicados con sus cuatro grupos fijos en orden. */
  async materials(userId: string, offerId: string): Promise<MaterialsDto> {
    await this.access.requireClassroomAccess(userId, offerId);
    const now = nowUtc();
    const offer = await this.prisma.offer.findUniqueOrThrow({
      where: { id: offerId },
      select: {
        modality: true,
        startsAt: true,
        endsAt: true,
        teachers: {
          orderBy: { position: 'asc' },
          select: { teacher: { select: { fullName: true } } },
        },
        modules: {
          where: publishedNowWhere(now),
          orderBy: { position: 'asc' },
          select: {
            id: true,
            position: true,
            title: true,
            description: true,
            teacher: { select: { fullName: true } },
            resources: {
              where: publishedNowWhere(now),
              orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
              select: RESOURCE_SELECT,
            },
            sessions: {
              orderBy: { startsAt: 'asc' },
              select: { id: true, status: true, startsAt: true, endsAt: true, recordingUrl: true },
            },
          },
        },
      },
    });
    const offerTeacherNames = offer.teachers.map(({ teacher }) => teacher.fullName);

    const modules: MaterialModuleDto[] = offer.modules.map((module) => {
      const resources = module.resources
        .map((r) => toMaterial(r, now))
        .filter((r): r is MaterialResourceDto & { updatedAt: Date } => r !== null);
      const strip = ({ updatedAt: _u, ...rest }: MaterialResourceDto & { updatedAt: Date }) => rest;
      const presentations = resources
        .filter((r) => r.type === 'PRESENTATION')
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      return {
        id: module.id,
        number: module.position,
        title: module.title,
        description: module.description,
        status: deriveModuleStatus(module.sessions, offer, now),
        teacherNames: module.teacher ? [module.teacher.fullName] : offerTeacherNames,
        presentation: presentations[0] ? strip(presentations[0]) : null,
        preReadings: resources.filter((r) => r.type === 'PRE_READING').map(strip),
        activities: resources.filter((r) => r.type === 'ACTIVITY').map(strip),
        recordings: module.sessions
          .filter((s) => s.status !== 'CANCELLED')
          .map((s) => ({
            sessionId: s.id,
            startsAt: s.startsAt.toISOString(),
            endsAt: s.endsAt.toISOString(),
            ...recordingInfo(
              {
                status: s.status,
                modality: offer.modality,
                endsAt: s.endsAt,
                recordingUrl: s.recordingUrl,
              },
              now,
            ),
          })),
      };
    });
    return { modules };
  }

  /** HU-08: URL de un recurso (firmada y temporal si es archivo; al vencer se pide otra). */
  async resourceAccess(userId: string, offerId: string, resourceId: string): Promise<AccessUrlDto> {
    await this.access.requireClassroomAccess(userId, offerId);
    const now = nowUtc();
    const resource = await this.prisma.moduleResource.findFirst({
      where: {
        id: resourceId,
        ...publishedNowWhere(now),
        module: { offerId, ...publishedNowWhere(now) },
      },
      select: RESOURCE_SELECT,
    });
    if (!resource) throw AppException.notFound('El recurso no existe.');
    const source = effectiveSource(resource, now);
    if (!source) throw new AppException('RESOURCE_FILE_UNAVAILABLE');
    if (source.fileKey) {
      const signed = await this.storage.getDownloadUrl(source.fileKey, {
        expiresInSeconds: BUSINESS_RULES.PRIVATE_FILE_URL_TTL_SECONDS,
        downloadFileName: source.fileName ?? undefined,
      });
      return {
        kind: 'FILE',
        url: signed.url,
        expiresAt: signed.expiresAt,
        fileName: source.fileName,
      };
    }
    return { kind: 'EXTERNAL_LINK', url: source.url!, expiresAt: null, fileName: null };
  }

  /** HU-17 "Sesiones pasadas" / próximas del Aula (todas las modalidades). */
  async sessionsOf(
    userId: string,
    offerId: string,
    query: ListSessionsQueryDto,
  ): Promise<PaginatedResponseDto<SessionCardDto>> {
    await this.access.requireClassroomAccess(userId, offerId);
    return this.sessions.listForOffers(userId, [offerId], query, nowUtc(), false);
  }

  // --- Proyecto final (HU-17) ---------------------------------------------------------------------

  async finalProjectUploadUrl(
    userId: string,
    offerId: string,
    dto: FinalProjectUploadRequestDto,
  ): Promise<UploadUrlDto> {
    await this.requireOpenFinalProject(userId, offerId);
    if (!isValidFinalProjectFile({ mimeType: dto.contentType, sizeBytes: dto.sizeBytes })) {
      throw new AppException('FINAL_PROJECT_INVALID_FILE');
    }
    const key = StorageService.buildKey(finalProjectKeyPrefix(offerId, userId), dto.fileName);
    const signed = await this.storage.getUploadUrl(key, {
      contentType: dto.contentType,
      expiresInSeconds: BUSINESS_RULES.FINAL_PROJECT_UPLOAD_URL_TTL_SECONDS,
    });
    return {
      uploadUrl: signed.url,
      method: 'PUT',
      headers: { 'Content-Type': dto.contentType },
      key,
      expiresAt: signed.expiresAt,
    };
  }

  async confirmFinalProject(
    userId: string,
    offerId: string,
    dto: ConfirmFinalProjectRequestDto,
  ): Promise<FinalProjectDto> {
    const { enrollment, offer } = await this.requireOpenFinalProject(userId, offerId);
    if (!dto.key.startsWith(finalProjectKeyPrefix(offerId, userId)) || dto.key.includes('..')) {
      throw new AppException('FINAL_PROJECT_UPLOAD_NOT_FOUND');
    }
    const head = await this.storage.head(dto.key);
    if (!head) throw new AppException('FINAL_PROJECT_UPLOAD_NOT_FOUND');
    const mimeType = head.contentType ?? '';
    const sizeBytes = head.contentLength ?? 0;
    if (!isValidFinalProjectFile({ mimeType, sizeBytes })) {
      await this.storage.delete(dto.key).catch(() => undefined);
      throw new AppException('FINAL_PROJECT_INVALID_FILE');
    }
    const fileName = dto.fileName ?? dto.key.split('/').pop() ?? 'proyecto-final';
    const now = nowUtc();
    const previous = await this.prisma.finalProjectSubmission.findUnique({
      where: { enrollmentId: enrollment.id },
    });
    const data = { fileKey: dto.key, fileName, mimeType, sizeBytes, submittedAt: now };
    const saved = await this.prisma.finalProjectSubmission.upsert({
      where: { enrollmentId: enrollment.id },
      create: { enrollmentId: enrollment.id, userId, offerId, ...data },
      update: data,
    });
    if (previous && previous.fileKey !== dto.key) {
      await this.storage.delete(previous.fileKey).catch((error: unknown) => {
        this.logger.warn({ err: error, key: previous.fileKey }, 'No se borró la entrega anterior');
      });
    }
    return toFinalProject(offer, saved, now);
  }

  async finalProjectDownload(userId: string, offerId: string): Promise<AccessUrlDto> {
    const enrollment = await this.access.requireClassroomAccess(userId, offerId);
    const submission = await this.prisma.finalProjectSubmission.findUnique({
      where: { enrollmentId: enrollment.id },
    });
    if (!submission) throw AppException.notFound('Aún no has entregado tu proyecto final.');
    const signed = await this.storage.getDownloadUrl(submission.fileKey, {
      expiresInSeconds: BUSINESS_RULES.PRIVATE_FILE_URL_TTL_SECONDS,
      downloadFileName: submission.fileName,
    });
    return {
      kind: 'FILE',
      url: signed.url,
      expiresAt: signed.expiresAt,
      fileName: submission.fileName,
    };
  }

  // ------------------------------------------------------------------------------------------------

  private async requireOpenFinalProject(userId: string, offerId: string) {
    const enrollment = await this.access.requireClassroomAccess(userId, offerId);
    const offer = await this.prisma.offer.findUniqueOrThrow({
      where: { id: offerId },
      select: {
        type: true,
        finalProjectDueAt: true,
        finalProjectSubmissionEnabled: true,
        finalProjectGuidelines: true,
      },
    });
    const state = finalProjectSubmissionState(
      {
        type: offer.type,
        submissionEnabled: offer.finalProjectSubmissionEnabled,
        dueAt: offer.finalProjectDueAt,
      },
      nowUtc(),
    );
    if (state === 'DISABLED') throw new AppException('FINAL_PROJECT_NOT_AVAILABLE');
    if (state === 'CLOSED') {
      throw new AppException('FINAL_PROJECT_DEADLINE_PASSED', {
        meta: { dueAt: offer.finalProjectDueAt?.toISOString() ?? null },
      });
    }
    return { enrollment, offer };
  }

  private publicImage(keyOrUrl: string): Promise<string> {
    return this.storage.getPublicUrl(keyOrUrl, BUSINESS_RULES.PUBLIC_IMAGE_SIGNED_URL_TTL_SECONDS);
  }
}

/** Archivo/enlace efectivo: el propio o el del recurso de Biblioteca enlazado (si está publicado). */
function effectiveSource(resource: ResourceRow, now: Date) {
  if (resource.fileKey || resource.url) return resource;
  const lib = resource.libraryResource;
  if (lib && isPublishedNow(lib, now) && (lib.fileKey || lib.url)) return lib;
  return null;
}

function toMaterial(
  resource: ResourceRow,
  now: Date,
): (MaterialResourceDto & { updatedAt: Date }) | null {
  const source = effectiveSource(resource, now);
  const kind = source ? resourceAccessKind(source) : null;
  return {
    id: resource.id,
    type: resource.type,
    title: resource.title,
    description: resource.description,
    kind,
    url: kind === 'EXTERNAL_LINK' ? source!.url : null,
    fileName: kind === 'FILE' ? source!.fileName : null,
    mimeType: kind === 'FILE' ? source!.mimeType : null,
    sizeBytes: kind === 'FILE' ? source!.sizeBytes : null,
    activityDueAt: resource.activityDueAt?.toISOString() ?? null,
    updatedAt: resource.updatedAt,
  };
}

function toFinalProject(
  offer: {
    type: Prisma.OfferGetPayload<object>['type'];
    finalProjectDueAt: Date | null;
    finalProjectSubmissionEnabled: boolean;
    finalProjectGuidelines: string | null;
  },
  submission: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    submittedAt: Date;
  } | null,
  now: Date,
): FinalProjectDto {
  return {
    dueAt: offer.finalProjectDueAt?.toISOString() ?? null,
    guidelines: offer.finalProjectGuidelines,
    submissionState: finalProjectSubmissionState(
      {
        type: offer.type,
        submissionEnabled: offer.finalProjectSubmissionEnabled,
        dueAt: offer.finalProjectDueAt,
      },
      now,
    ),
    acceptedMimeTypes: [...BUSINESS_RULES.FILE_LIMITS.FINAL_PROJECT.mimeTypes],
    maxBytes: BUSINESS_RULES.FILE_LIMITS.FINAL_PROJECT.maxBytes,
    submission: submission
      ? {
          fileName: submission.fileName,
          mimeType: submission.mimeType,
          sizeBytes: submission.sizeBytes,
          submittedAt: submission.submittedAt.toISOString(),
        }
      : null,
  };
}
