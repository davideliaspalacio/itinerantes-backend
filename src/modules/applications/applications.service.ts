import { Injectable, Logger } from '@nestjs/common';
import { type ErrorDetail } from '../../common/errors/app.exception';
import { AppException } from '../../common/errors/app.exception';
import { FIELD_ERROR_CODES } from '../../common/errors/error-codes';
import { paginate, type PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { currencyForCountry, type Currency, isCurrency } from '../../common/utils/money';
import { nowUtc, OFFICIAL_TIMEZONE } from '../../common/utils/time';
import { BUSINESS_RULES } from '../../config/business-rules';
import type {
  ApplicationKind,
  ApplicationStatus,
  Prisma,
  ScholarshipLevel,
  User,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { EnrollmentLookupService } from '../enrollments/enrollment-lookup.service';
import type { AccessUrlDto } from '../enrollments/dto/portal-shared.dto';
import { joinInfo } from '../live-sessions/policies/session.policy';
import { LocationsService } from '../locations/locations.service';
import { estimateScholarshipLevels } from '../offers/policies/scholarship.policy';
import { ApplicationWorkflowService } from './application-workflow.service';
import type {
  ApplicationFormFieldsDto,
  ConfirmDocumentRequestDto,
  CreateApplicationRequestDto,
  EvidenceUploadRequestDto,
  ListApplicationsQueryDto,
  UpdateApplicationRequestDto,
} from './dto/applications.request.dto';
import type {
  ApplicationCardDto,
  ApplicationDetailDto,
  ApplicationDocumentDto,
  ApplicationEligibilityDto,
  ApplicationOfferDto,
  ApplicationOpportunityDto,
  ApplicationsWidgetDto,
  ApplicationUploadUrlDto,
  ApplicationWindowDto,
} from './dto/applications.response.dto';
import {
  type ApplicationWindow,
  applicationKindFor,
  applicationWindow,
  eligibilityIssues,
  evidenceKeyPrefix,
  evidenceMediaType,
  formatFolio,
  interviewRequired,
  isValidEvidenceFile,
  levelMaxPercent,
  submissionIssues,
} from './policies/application-rules.policy';
import {
  buildTimeline,
  contextualAction,
  isAwaitingResponse,
  isEditable,
  requiresAction,
} from './policies/application-status.policy';

const OFFER_SELECT = {
  id: true,
  slug: true,
  name: true,
  type: true,
  modality: true,
  origin: true,
  publicationStatus: true,
  publishedAt: true,
  cohortLabel: true,
  coverImageKey: true,
  enrollmentOpensAt: true,
  enrollmentClosesAt: true,
  startsAt: true,
  endsAt: true,
  venueName: true,
  venueCity: true,
  isFree: true,
  priceMxnCents: true,
  priceUsdCents: true,
  scholarshipEnabled: true,
  scholarshipLevels: true,
  scholarshipOpensAt: true,
  scholarshipClosesAt: true,
  eligibilityText: true,
  eligibleCountryCodes: true,
  requiresTravel: true,
} as const satisfies Prisma.OfferSelect;

type OfferRow = Prisma.OfferGetPayload<{ select: typeof OFFER_SELECT }>;

const APPLICATION_INCLUDE = {
  offer: { select: OFFER_SELECT },
  statusEvents: {
    orderBy: { createdAt: 'asc' },
    select: { toStatus: true, createdAt: true },
  },
  interviews: {
    where: { status: { not: 'CANCELLED' } },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
} as const satisfies Prisma.ApplicationInclude;

type ApplicationRow = Prisma.ApplicationGetPayload<{ include: typeof APPLICATION_INCLUDE }>;

/** Campos del formulario normalizados (lo que se guarda en el borrador). */
interface ApplicationFormData {
  phoneCountryCode?: string;
  phoneNumber?: string;
  age?: number | null;
  partnerCode?: string | null;
  organization?: string | null;
  organizationRole?: string | null;
  requestedLevel?: ScholarshipLevel | null;
  intentLetter?: string | null;
  eligibilityConfirmed?: boolean;
  experience?: string | null;
  motivation?: string | null;
  canTravel?: boolean | null;
  evidenceLinks?: string[];
  termsAcceptedAt?: Date | null;
}

/** Campos del formulario por tipo (los del otro tipo se rechazan con NOT_APPLICABLE). */
const SCHOLARSHIP_ONLY = ['age', 'requestedLevel', 'intentLetter'] as const;
const OPEN_CALL_ONLY = [
  'eligibilityConfirmed',
  'organization',
  'organizationRole',
  'experience',
  'motivation',
  'canTravel',
] as const;

/**
 * Postulaciones del participante (HU-19, 20, 21): oportunidades abiertas, borrador con autoguardado,
 * evidencias (URL firmada + confirmación), envío, seguimiento y confirmación de participación.
 * Las transiciones viven en `ApplicationWorkflowService`.
 */
@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly locations: LocationsService,
    private readonly enrollmentLookup: EnrollmentLookupService,
    private readonly workflow: ApplicationWorkflowService,
  ) {}

  // --- "Becas disponibles" / "Convocatorias abiertas" -------------------------------------------

  async opportunities(userId: string, kind: ApplicationKind): Promise<ApplicationOpportunityDto[]> {
    const now = nowUtc();
    const user = await this.requireUser(userId);
    const currency = currencyForCountry(user.countryCode);
    const offers = await this.openOffers(kind, now, true);
    const ids = offers.map(({ offer }) => offer.id);
    const [mine, enrolled, countryNames] = await Promise.all([
      this.prisma.application.findMany({
        where: { userId, offerId: { in: ids } },
        select: { id: true, offerId: true, status: true, kind: true, number: true },
      }),
      this.enrollmentLookup.activeOfferIdsForUser(userId, ids),
      this.locations.getCountryNames([
        ...new Set(offers.flatMap((o) => o.offer.eligibleCountryCodes)),
      ]),
    ]);
    const mineByOffer = new Map(mine.map((a) => [a.offerId, a]));

    if (kind === 'OPEN_CALL') {
      // Widget "Convocatorias: nuevas desde tu última visita" (HU-06).
      await this.prisma.user.update({ where: { id: userId }, data: { openCallsSeenAt: now } });
    }

    return Promise.all(
      offers.map(async ({ offer, window }) => {
        const app = mineByOffer.get(offer.id) ?? null;
        const isEnrolled = enrolled.has(offer.id);
        return {
          kind,
          offer: await this.offerDto(offer),
          window: windowDto(window),
          price: priceOf(offer, currency),
          levels:
            kind === 'SCHOLARSHIP'
              ? estimateScholarshipLevels(
                  offer.scholarshipLevels,
                  priceOf(offer, currency)?.amountCents ?? null,
                  currency,
                )
              : [],
          eligibility: eligibilityDto(offer, kind, user.countryCode, null, countryNames),
          myApplication: app
            ? { id: app.id, status: app.status, folio: formatFolio(app.kind, app.number) }
            : null,
          canApply: window.state === 'OPEN' && !app && !isEnrolled,
          enrolled: isEnrolled,
        };
      }),
    );
  }

  // --- "Mis postulaciones" (HU-21) ---------------------------------------------------------------

  async listMine(
    userId: string,
    query: ListApplicationsQueryDto,
  ): Promise<PaginatedResponseDto<ApplicationCardDto>> {
    const now = nowUtc();
    const rows = await this.prisma.application.findMany({
      where: {
        userId,
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.status?.length ? { status: { in: query.status } } : {}),
      },
      include: APPLICATION_INCLUDE,
    });
    const cards = await Promise.all(rows.map((row) => this.toCard(row, now)));
    cards.sort(compareCards);
    return paginate(cards.slice(query.skip, query.skip + query.take), cards.length, query);
  }

  async getMine(userId: string, applicationId: string): Promise<ApplicationDetailDto> {
    const row = await this.requireOwn(userId, applicationId);
    return this.toDetail(row, nowUtc());
  }

  // --- Borrador (HU-19/20: autoguardado, "borrador editable") ------------------------------------

  async create(userId: string, dto: CreateApplicationRequestDto): Promise<ApplicationDetailDto> {
    const now = nowUtc();
    const user = await this.requireUser(userId);
    const offer = await this.prisma.offer.findUnique({
      where: { id: dto.offerId },
      select: OFFER_SELECT,
    });
    if (!offer || offer.publicationStatus !== 'PUBLISHED') {
      throw new AppException('OFFER_NOT_AVAILABLE');
    }
    const kind = applicationKindFor(offer);
    if (!kind) {
      throw new AppException('APPLICATION_NOT_ALLOWED', {
        meta: { offerType: offer.type, origin: offer.origin },
      });
    }
    const existing = await this.prisma.application.findUnique({
      where: { userId_offerId: { userId, offerId: offer.id } },
      select: { id: true, status: true, kind: true, number: true },
    });
    if (existing) throw alreadyExists(existing);
    const enrolled = await this.enrollmentLookup.activeOfferIdsForUser(userId, [offer.id]);
    if (enrolled.size > 0) {
      throw new AppException('ENROLLMENT_ALREADY_EXISTS', {
        meta: { enrollmentStatus: 'ACTIVE' },
      });
    }
    assertWindowOpen(applicationWindow(offer, kind, now));
    const fields = await this.formData(dto, kind, offer.scholarshipLevels);

    try {
      const created = await this.prisma.application.create({
        data: {
          userId,
          offerId: offer.id,
          kind,
          ...profileSnapshot(user),
          phoneCountryCode: user.phoneCountryCode,
          phoneNumber: user.phoneNumber,
          evidenceLinks: [],
          ...fields,
          statusEvents: {
            create: {
              toStatus: 'DRAFT',
              actorType: 'PARTICIPANT',
              actorId: userId,
              createdAt: now,
            },
          },
        },
      });
      return this.getMine(userId, created.id);
    } catch (error) {
      // Carrera con otra pestaña (única por persona y oferta).
      if ((error as { code?: string }).code === 'P2002') {
        const again = await this.prisma.application.findUnique({
          where: { userId_offerId: { userId, offerId: offer.id } },
          select: { id: true, status: true, kind: true, number: true },
        });
        if (again) throw alreadyExists(again);
      }
      throw error;
    }
  }

  async update(
    userId: string,
    applicationId: string,
    dto: UpdateApplicationRequestDto,
  ): Promise<ApplicationDetailDto> {
    const row = await this.requireEditable(userId, applicationId);
    const user = await this.requireUser(userId);
    const fields = await this.formData(dto, row.kind, row.offer.scholarshipLevels);
    const updated = await this.prisma.application.updateMany({
      where: { id: row.id, status: 'DRAFT' },
      data: { ...profileSnapshot(user), ...fields },
    });
    if (updated.count === 0) throw notEditable(row.status);
    return this.getMine(userId, applicationId);
  }

  /** Descartar el borrador (y sus archivos). Enviadas no se borran. */
  async remove(userId: string, applicationId: string): Promise<void> {
    const row = await this.requireOwn(userId, applicationId);
    if (!isEditable(row.status)) throw notEditable(row.status);
    const documents = await this.prisma.applicationDocument.findMany({
      where: { applicationId },
      select: { fileKey: true },
    });
    const deleted = await this.prisma.application.deleteMany({
      where: { id: applicationId, status: 'DRAFT' },
    });
    if (deleted.count === 0) throw notEditable(row.status);
    await Promise.all(documents.map((d) => this.deleteFile(d.fileKey)));
  }

  /**
   * "Enviar postulación": ventana abierta, elegibilidad (HU-20), obligatorios completos (HU-19/20),
   * foto del perfil y monto en la moneda del país. Folio + notificación/correo "Enviada".
   */
  async submit(userId: string, applicationId: string): Promise<ApplicationDetailDto> {
    const row = await this.requireEditable(userId, applicationId);
    const user = await this.requireUser(userId);
    const { offer } = row;

    const ineligible = eligibilityIssues(offer, {
      countryCode: user.countryCode,
      canTravel: row.kind === 'OPEN_CALL' ? row.canTravel : null,
    });
    if (ineligible.length > 0) {
      throw new AppException('APPLICATION_NOT_ELIGIBLE', {
        meta: { reasons: ineligible, eligibilityText: offer.eligibilityText },
      });
    }
    const documentCount = await this.prisma.applicationDocument.count({ where: { applicationId } });
    const issues = submissionIssues(submissionInput(row, documentCount));
    if (issues.length > 0) {
      throw new AppException('APPLICATION_INCOMPLETE', { details: issues });
    }

    const currency = currencyForCountry(user.countryCode);
    const price = priceOf(offer, currency);
    await this.workflow.transition(
      applicationId,
      'SUBMITTED',
      { type: 'PARTICIPANT', id: userId },
      {
        data: {
          ...profileSnapshot(user),
          submittedAt: nowUtc(),
          currency,
          originalAmountCents: price?.amountCents ?? null,
        },
      },
    );
    return this.getMine(userId, applicationId);
  }

  // --- Evidencias (HU-19/20) ----------------------------------------------------------------------

  async evidenceUploadUrl(
    userId: string,
    applicationId: string,
    dto: EvidenceUploadRequestDto,
  ): Promise<ApplicationUploadUrlDto> {
    await this.requireEditable(userId, applicationId);
    if (!isValidEvidenceFile({ mimeType: dto.contentType, sizeBytes: dto.sizeBytes })) {
      throw new AppException('APPLICATION_INVALID_FILE');
    }
    await this.assertBelowFileLimit(applicationId);
    const key = StorageService.buildKey(evidenceKeyPrefix(applicationId), dto.fileName);
    const signed = await this.storage.getUploadUrl(key, {
      contentType: dto.contentType,
      expiresInSeconds: BUSINESS_RULES.EVIDENCE_UPLOAD_URL_TTL_SECONDS,
    });
    return {
      uploadUrl: signed.url,
      method: 'PUT',
      headers: { 'Content-Type': dto.contentType },
      key,
      expiresAt: signed.expiresAt,
    };
  }

  /** Confirma el archivo subido: verifica que exista y su tipo/tamaño REALES (`head`). */
  async confirmDocument(
    userId: string,
    applicationId: string,
    dto: ConfirmDocumentRequestDto,
  ): Promise<ApplicationDocumentDto> {
    await this.requireEditable(userId, applicationId);
    if (!dto.key.startsWith(evidenceKeyPrefix(applicationId)) || dto.key.includes('..')) {
      throw new AppException('APPLICATION_UPLOAD_NOT_FOUND');
    }
    const existing = await this.prisma.applicationDocument.findUnique({
      where: { fileKey: dto.key },
    });
    if (existing) return toDocumentDto(existing);
    await this.assertBelowFileLimit(applicationId);
    const head = await this.storage.head(dto.key);
    if (!head) throw new AppException('APPLICATION_UPLOAD_NOT_FOUND');
    const mimeType = head.contentType ?? '';
    const sizeBytes = head.contentLength ?? 0;
    if (!isValidEvidenceFile({ mimeType, sizeBytes })) {
      await this.deleteFile(dto.key);
      throw new AppException('APPLICATION_INVALID_FILE');
    }
    const document = await this.prisma.applicationDocument.create({
      data: {
        applicationId,
        userId,
        fileKey: dto.key,
        fileName: dto.fileName ?? dto.key.split('/').pop() ?? 'evidencia',
        mimeType,
        sizeBytes,
      },
    });
    return toDocumentDto(document);
  }

  async deleteDocument(userId: string, applicationId: string, documentId: string): Promise<void> {
    await this.requireEditable(userId, applicationId);
    const document = await this.prisma.applicationDocument.findFirst({
      where: { id: documentId, applicationId },
    });
    if (!document) throw AppException.notFound('El archivo no existe.');
    await this.prisma.applicationDocument.delete({ where: { id: document.id } });
    await this.deleteFile(document.fileKey);
  }

  async documentDownload(
    userId: string,
    applicationId: string,
    documentId: string,
  ): Promise<AccessUrlDto> {
    await this.requireOwn(userId, applicationId);
    const document = await this.prisma.applicationDocument.findFirst({
      where: { id: documentId, applicationId },
    });
    if (!document) throw AppException.notFound('El archivo no existe.');
    const signed = await this.storage.getDownloadUrl(document.fileKey, {
      expiresInSeconds: BUSINESS_RULES.PRIVATE_FILE_URL_TTL_SECONDS,
      downloadFileName: document.fileName,
    });
    return {
      kind: 'FILE',
      url: signed.url,
      expiresAt: signed.expiresAt,
      fileName: document.fileName,
    };
  }

  // --- Respuesta a la aprobación (HU-21) ----------------------------------------------------------

  /** "Confirmar mi participación" (convocatoria sin costo): Inscrita + acceso al Aula. */
  async confirm(userId: string, applicationId: string): Promise<ApplicationDetailDto> {
    const row = await this.requireOwn(userId, applicationId);
    if (row.status !== 'APPROVED_PENDING_CONFIRMATION') {
      throw new AppException('APPLICATION_INVALID_TRANSITION', {
        meta: { status: row.status, to: 'ENROLLED' },
      });
    }
    if (row.responseDueAt && row.responseDueAt.getTime() <= nowUtc().getTime()) {
      throw new AppException('APPLICATION_DEADLINE_PASSED', {
        meta: { dueAt: row.responseDueAt.toISOString() },
      });
    }
    await this.workflow.confirmParticipation(applicationId, userId);
    return this.getMine(userId, applicationId);
  }

  // --- Dashboard (HU-06) y calendario (HU-10) -----------------------------------------------------

  /** Widget Becas / Convocatorias: postulación más relevante, acciones pendientes y abiertas. */
  async widget(userId: string, kind: ApplicationKind): Promise<ApplicationsWidgetDto> {
    const now = nowUtc();
    const [rows, open, user] = await Promise.all([
      this.prisma.application.findMany({
        where: { userId, kind },
        include: APPLICATION_INCLUDE,
      }),
      this.openOffers(kind, now, false),
      this.requireUser(userId),
    ]);
    const cards = await Promise.all(rows.map((row) => this.toCard(row, now)));
    cards.sort(compareCards);
    const seenAt = user.openCallsSeenAt;
    return {
      latest: cards[0] ?? null,
      actionRequired: cards.filter((c) => c.requiresAction).length,
      openCount: open.length,
      newCount:
        kind === 'OPEN_CALL'
          ? open.filter(
              ({ offer }) => !seenAt || (offer.publishedAt !== null && offer.publishedAt > seenAt),
            ).length
          : 0,
    };
  }

  /** Entrevistas (no canceladas) de mis postulaciones en [from, to): "Fecha importante" (HU-10). */
  async interviewsInRange(userId: string, from: Date, to: Date) {
    const interviews = await this.prisma.applicationInterview.findMany({
      where: {
        status: { not: 'CANCELLED' },
        startsAt: { lt: to },
        endsAt: { gte: from },
        application: { userId },
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        joinUrl: true,
        status: true,
        application: {
          select: {
            id: true,
            kind: true,
            number: true,
            offer: { select: { id: true, slug: true, name: true, type: true, modality: true } },
          },
        },
      },
    });
    const now = nowUtc();
    return interviews.map((interview) => ({
      id: interview.id,
      applicationId: interview.application.id,
      folio: formatFolio(interview.application.kind, interview.application.number),
      offer: interview.application.offer,
      startsAt: interview.startsAt,
      endsAt: interview.endsAt,
      status: interview.status,
      join: joinInfo(
        {
          status: interview.status === 'SCHEDULED' ? 'SCHEDULED' : 'CANCELLED',
          modality: 'ONLINE_LIVE',
          startsAt: interview.startsAt,
          endsAt: interview.endsAt,
          joinUrl: interview.joinUrl,
        },
        now,
        BUSINESS_RULES.INTERVIEW_JOIN_WINDOW_MINUTES_BEFORE,
      ),
    }));
  }

  // ------------------------------------------------------------------------------------------------

  private async requireUser(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppException('UNAUTHORIZED');
    return user;
  }

  /** Ajena o inexistente → 404 (HU-21: "me niega el acceso" sin revelar que existe). */
  private async requireOwn(userId: string, applicationId: string): Promise<ApplicationRow> {
    const row = await this.prisma.application.findFirst({
      where: { id: applicationId, userId },
      include: APPLICATION_INCLUDE,
    });
    if (!row) throw AppException.notFound('La postulación no existe.');
    return row;
  }

  /** Borrador propio con la ventana abierta ("solo lectura si la convocatoria cerró"). */
  private async requireEditable(userId: string, applicationId: string): Promise<ApplicationRow> {
    const row = await this.requireOwn(userId, applicationId);
    if (!isEditable(row.status)) throw notEditable(row.status);
    assertWindowOpen(applicationWindow(row.offer, row.kind, nowUtc()));
    return row;
  }

  private async assertBelowFileLimit(applicationId: string): Promise<void> {
    const count = await this.prisma.applicationDocument.count({ where: { applicationId } });
    if (count >= BUSINESS_RULES.FILE_LIMITS.EVIDENCE_MAX_FILES) {
      throw new AppException('APPLICATION_TOO_MANY_FILES', {
        meta: { max: BUSINESS_RULES.FILE_LIMITS.EVIDENCE_MAX_FILES },
      });
    }
  }

  private async deleteFile(key: string): Promise<void> {
    await this.storage.delete(key).catch((error: unknown) => {
      this.logger.warn({ err: error, key }, 'No se pudo borrar la evidencia del storage');
    });
  }

  /** Normaliza los campos del formulario y rechaza los que no aplican al tipo. */
  private async formData(
    dto: ApplicationFormFieldsDto,
    kind: ApplicationKind,
    enabledLevels: readonly ScholarshipLevel[],
  ): Promise<ApplicationFormData> {
    const notApplicable = (kind === 'SCHOLARSHIP' ? OPEN_CALL_ONLY : SCHOLARSHIP_ONLY).filter(
      (field) => dto[field] !== undefined && dto[field] !== null && dto[field] !== false,
    );
    const details: ErrorDetail[] = notApplicable.map((field) => ({
      field,
      code: FIELD_ERROR_CODES.NOT_APPLICABLE,
      message:
        kind === 'SCHOLARSHIP'
          ? 'Este campo es solo para convocatorias.'
          : 'Este campo es solo para becas.',
    }));
    if (dto.requestedLevel && !enabledLevels.includes(dto.requestedLevel)) {
      details.push({
        field: 'requestedLevel',
        code: FIELD_ERROR_CODES.LEVEL_NOT_ENABLED,
        message: 'Ese nivel de beca no está disponible para este diplomado.',
      });
    }
    if (details.length > 0) throw AppException.validation(details);
    if (dto.phone) await this.locations.validatePhone(dto.phone);

    const data: ApplicationFormData = {};
    const blankToNull = (v: string | null | undefined) =>
      v === undefined ? undefined : v?.trim() ? v : null;
    if (dto.phone) {
      data.phoneCountryCode = dto.phone.countryCode;
      data.phoneNumber = dto.phone.number;
    }
    if (dto.age !== undefined) data.age = dto.age;
    if (dto.partnerCode !== undefined) data.partnerCode = blankToNull(dto.partnerCode);
    if (dto.organization !== undefined) data.organization = blankToNull(dto.organization);
    if (dto.organizationRole !== undefined)
      data.organizationRole = blankToNull(dto.organizationRole);
    if (dto.requestedLevel !== undefined) data.requestedLevel = dto.requestedLevel;
    if (dto.intentLetter !== undefined) data.intentLetter = blankToNull(dto.intentLetter);
    if (dto.eligibilityConfirmed !== undefined)
      data.eligibilityConfirmed = dto.eligibilityConfirmed;
    if (dto.experience !== undefined) data.experience = blankToNull(dto.experience);
    if (dto.motivation !== undefined) data.motivation = blankToNull(dto.motivation);
    if (dto.canTravel !== undefined) data.canTravel = dto.canTravel;
    if (dto.evidenceLinks !== undefined) data.evidenceLinks = [...new Set(dto.evidenceLinks)];
    if (dto.termsAccepted !== undefined) {
      data.termsAcceptedAt = dto.termsAccepted ? nowUtc() : null;
    }
    return data;
  }

  private async offerDto(offer: OfferRow): Promise<ApplicationOfferDto> {
    return {
      id: offer.id,
      slug: offer.slug,
      name: offer.name,
      type: offer.type,
      modality: offer.modality,
      cohortLabel: offer.cohortLabel,
      coverImageUrl: offer.coverImageKey
        ? await this.storage.getPublicUrl(
            offer.coverImageKey,
            BUSINESS_RULES.PUBLIC_IMAGE_SIGNED_URL_TTL_SECONDS,
          )
        : null,
      startsAt: offer.startsAt?.toISOString() ?? null,
      endsAt: offer.endsAt?.toISOString() ?? null,
      venue:
        offer.modality === 'IN_PERSON' && offer.venueName
          ? { name: offer.venueName, city: offer.venueCity }
          : null,
    };
  }

  /** Ofertas publicadas de ese tipo con la ventana abierta (o próxima si `includeUpcoming`). */
  private async openOffers(
    kind: ApplicationKind,
    now: Date,
    includeUpcoming: boolean,
  ): Promise<Array<{ offer: OfferRow; window: ApplicationWindow }>> {
    const offers = await this.prisma.offer.findMany({
      where: {
        publicationStatus: 'PUBLISHED',
        origin: 'NAS',
        ...(kind === 'OPEN_CALL'
          ? { type: 'OPEN_CALL' }
          : { type: 'DIPLOMA', scholarshipEnabled: true }),
      },
      select: OFFER_SELECT,
    });
    return offers
      .filter((offer) => applicationKindFor(offer) === kind)
      .map((offer) => ({ offer, window: applicationWindow(offer, kind, now) }))
      .filter(
        ({ window }) => window.state === 'OPEN' || (includeUpcoming && window.state === 'UPCOMING'),
      )
      .sort(
        (a, b) =>
          compareWindows(a.window, b.window) || a.offer.name.localeCompare(b.offer.name, 'es'),
      );
  }

  private async toCard(row: ApplicationRow, now: Date): Promise<ApplicationCardDto> {
    const window = applicationWindow(row.offer, row.kind, now);
    const current = row.interviews[0] ?? null;
    const interview =
      row.status === 'INTERVIEW_SCHEDULED' && current
        ? {
            row: current,
            join: joinInfo(
              {
                status: current.status === 'SCHEDULED' ? 'SCHEDULED' : 'CANCELLED',
                modality: 'ONLINE_LIVE',
                startsAt: current.startsAt,
                endsAt: current.endsAt,
                joinUrl: current.joinUrl,
              },
              now,
              BUSINESS_RULES.INTERVIEW_JOIN_WINDOW_MINUTES_BEFORE,
            ),
          }
        : null;
    const responseKind = responseKindOf(row);
    const action = contextualAction({
      status: row.status,
      windowOpen: window.state === 'OPEN',
      responseDueAt: row.responseDueAt,
      interview: interview
        ? { startsAt: interview.row.startsAt, joinState: interview.join.state }
        : null,
    });
    const currency = row.currency && isCurrency(row.currency) ? row.currency : null;
    const money = (cents: number | null) =>
      cents !== null && currency ? { amountCents: cents, currency } : null;

    return {
      id: row.id,
      folio: formatFolio(row.kind, row.number),
      kind: row.kind,
      status: row.status,
      statusChangedAt: row.statusChangedAt.toISOString(),
      offer: await this.offerDto(row.offer),
      submittedAt: row.submittedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      requiresAction: requiresAction(row.status),
      action: { ...action, dueAt: action.dueAt?.toISOString() ?? null },
      timeline: buildTimeline({
        kind: row.kind,
        status: row.status,
        history: row.statusEvents.map((e) => ({ toStatus: e.toStatus, at: e.createdAt })),
        interviewRequired: interviewRequired(
          row.kind,
          row.assignedPercent ?? levelMaxPercent(row.requestedLevel),
        ),
        responseKind,
      }).map((step) => ({ ...step, at: step.at?.toISOString() ?? null })),
      interview: interview
        ? {
            id: interview.row.id,
            startsAt: interview.row.startsAt.toISOString(),
            endsAt: interview.row.endsAt.toISOString(),
            timezone: OFFICIAL_TIMEZONE,
            status: interview.row.status,
            join: {
              state: interview.join.state,
              opensAt: interview.join.opensAt.toISOString(),
              url: interview.join.url,
            },
          }
        : null,
      scholarshipResult:
        row.kind === 'SCHOLARSHIP' &&
        row.assignedLevel &&
        row.assignedPercent !== null &&
        row.balanceCents !== null &&
        currency &&
        RESULT_STATUSES.includes(row.status)
          ? {
              requestedLevel: row.requestedLevel,
              assignedLevel: row.assignedLevel,
              assignedPercent: row.assignedPercent,
              originalAmount: money(row.originalAmountCents),
              balance: { amountCents: row.balanceCents, currency },
              dueAt: row.responseDueAt?.toISOString() ?? null,
            }
          : null,
      response: isAwaitingResponse(row.status)
        ? {
            kind: responseKind,
            dueAt: row.responseDueAt?.toISOString() ?? null,
            amount: responseKind === 'PAYMENT' ? money(row.balanceCents) : null,
            transferPendingValidation: row.pendingTransferSince !== null,
          }
        : null,
    };
  }

  private async toDetail(row: ApplicationRow, now: Date): Promise<ApplicationDetailDto> {
    const [card, documents, countryNames] = await Promise.all([
      this.toCard(row, now),
      this.prisma.applicationDocument.findMany({
        where: { applicationId: row.id },
        orderBy: { createdAt: 'asc' },
      }),
      this.locations.getCountryNames([
        ...new Set([row.countryCode, ...row.offer.eligibleCountryCodes]),
      ]),
    ]);
    const window = applicationWindow(row.offer, row.kind, now);
    const currency: Currency =
      row.currency && isCurrency(row.currency) ? row.currency : currencyForCountry(row.countryCode);
    const price = priceOf(row.offer, currency);
    const { EVIDENCE_IMAGE, EVIDENCE_VIDEO, EVIDENCE_MIN_FILES, EVIDENCE_MAX_FILES } =
      BUSINESS_RULES.FILE_LIMITS;

    return {
      ...card,
      editable: isEditable(row.status) && window.state === 'OPEN',
      applicant: {
        fullName: row.applicantName,
        email: row.applicantEmail,
        phone: { countryCode: row.phoneCountryCode, number: row.phoneNumber },
        countryCode: row.countryCode,
        countryName: countryNames.get(row.countryCode) ?? row.countryCode,
        divisionName: row.divisionName,
        municipalityName: row.municipalityName,
        currency,
      },
      answers: {
        age: row.age,
        partnerCode: row.partnerCode,
        organization: row.organization,
        organizationRole: row.organizationRole,
        requestedLevel: row.requestedLevel,
        intentLetter: row.intentLetter,
        eligibilityConfirmed: row.eligibilityConfirmed,
        experience: row.experience,
        motivation: row.motivation,
        canTravel: row.canTravel,
        evidenceLinks: row.evidenceLinks,
        termsAccepted: row.termsAcceptedAt !== null,
        termsAcceptedAt: row.termsAcceptedAt?.toISOString() ?? null,
      },
      documents: documents.map(toDocumentDto),
      missingRequirements: isEditable(row.status)
        ? submissionIssues(submissionInput(row, documents.length))
        : [],
      history: row.statusEvents.map((e) => ({ status: e.toStatus, at: e.createdAt.toISOString() })),
      form: {
        window: windowDto(window),
        levels:
          row.kind === 'SCHOLARSHIP'
            ? estimateScholarshipLevels(
                row.offer.scholarshipLevels,
                price?.amountCents ?? null,
                currency,
              )
            : [],
        price,
        eligibility: eligibilityDto(
          row.offer,
          row.kind,
          row.countryCode,
          row.canTravel,
          countryNames,
        ),
        interviewNotice:
          row.kind === 'OPEN_CALL' ||
          interviewRequired(row.kind, levelMaxPercent(row.requestedLevel)),
        limits: {
          letterMinLength: BUSINESS_RULES.SCHOLARSHIP_LETTER_MIN_LENGTH,
          letterMaxLength: BUSINESS_RULES.SCHOLARSHIP_LETTER_MAX_LENGTH,
          answerMinLength: BUSINESS_RULES.OPEN_CALL_ANSWER_MIN_LENGTH,
          answerMaxLength: BUSINESS_RULES.OPEN_CALL_ANSWER_MAX_LENGTH,
          minFiles: row.kind === 'SCHOLARSHIP' ? EVIDENCE_MIN_FILES : 0,
          maxFiles: EVIDENCE_MAX_FILES,
          maxLinks: BUSINESS_RULES.EVIDENCE_MAX_LINKS,
          image: { mimeTypes: [...EVIDENCE_IMAGE.mimeTypes], maxBytes: EVIDENCE_IMAGE.maxBytes },
          video: { mimeTypes: [...EVIDENCE_VIDEO.mimeTypes], maxBytes: EVIDENCE_VIDEO.maxBytes },
        },
      },
    };
  }
}

// -------------------------------------------------------------------------------------------------

const RESULT_STATUSES: readonly ApplicationStatus[] = [
  'APPROVED_PENDING_PAYMENT',
  'APPROVED_PENDING_CONFIRMATION',
  'ENROLLED',
  'EXPIRED',
];

function profileSnapshot(user: User) {
  return {
    applicantName: user.fullName,
    applicantEmail: user.email,
    countryCode: user.countryCode,
    divisionName: user.divisionName,
    municipalityName: user.municipalityName,
  };
}

function submissionInput(row: ApplicationRow, documentCount: number) {
  return {
    kind: row.kind,
    enabledLevels: row.offer.scholarshipLevels,
    requiresTravel: row.offer.requiresTravel,
    age: row.age,
    requestedLevel: row.requestedLevel,
    intentLetter: row.intentLetter,
    eligibilityConfirmed: row.eligibilityConfirmed,
    organization: row.organization,
    organizationRole: row.organizationRole,
    experience: row.experience,
    motivation: row.motivation,
    canTravel: row.canTravel,
    termsAccepted: row.termsAcceptedAt !== null,
    documentCount,
  };
}

function responseKindOf(row: ApplicationRow): 'PAYMENT' | 'CONFIRMATION' {
  if (row.balanceCents !== null) return row.balanceCents > 0 ? 'PAYMENT' : 'CONFIRMATION';
  if (row.kind === 'SCHOLARSHIP') return 'PAYMENT';
  return row.offer.isFree ? 'CONFIRMATION' : 'PAYMENT';
}

function priceOf(
  offer: Pick<OfferRow, 'isFree' | 'priceMxnCents' | 'priceUsdCents'>,
  currency: Currency,
): { amountCents: number; currency: Currency } | null {
  if (offer.isFree) return null;
  const cents = currency === 'MXN' ? offer.priceMxnCents : offer.priceUsdCents;
  return cents !== null && cents > 0 ? { amountCents: cents, currency } : null;
}

function windowDto(window: ApplicationWindow): ApplicationWindowDto {
  return {
    state: window.state,
    opensAt: window.opensAt?.toISOString() ?? null,
    closesAt: window.closesAt?.toISOString() ?? null,
    reason: window.reason,
  };
}

function eligibilityDto(
  offer: OfferRow,
  kind: ApplicationKind,
  countryCode: string,
  canTravel: boolean | null,
  countryNames: Map<string, string>,
): ApplicationEligibilityDto | null {
  const hasRules =
    kind === 'OPEN_CALL' ||
    !!offer.eligibilityText ||
    offer.eligibleCountryCodes.length > 0 ||
    offer.requiresTravel;
  if (!hasRules) return null;
  const reasons = eligibilityIssues(offer, { countryCode, canTravel });
  return {
    text: offer.eligibilityText,
    countries: offer.eligibleCountryCodes.map((code) => ({
      code,
      name: countryNames.get(code) ?? code,
    })),
    requiresTravel: offer.requiresTravel,
    eligible: reasons.length === 0,
    reasons,
  };
}

function assertWindowOpen(window: ApplicationWindow): void {
  if (window.state === 'OPEN') return;
  throw new AppException('APPLICATION_WINDOW_CLOSED', {
    meta: {
      reason: window.reason,
      availableFrom: window.state === 'UPCOMING' ? (window.opensAt?.toISOString() ?? null) : null,
      closesAt: window.closesAt?.toISOString() ?? null,
    },
  });
}

function alreadyExists(existing: {
  id: string;
  status: ApplicationStatus;
  kind: ApplicationKind;
  number: number;
}): AppException {
  return new AppException('APPLICATION_ALREADY_EXISTS', {
    meta: {
      applicationId: existing.id,
      status: existing.status,
      folio: formatFolio(existing.kind, existing.number),
    },
  });
}

function notEditable(status: ApplicationStatus): AppException {
  return new AppException('APPLICATION_NOT_EDITABLE', { meta: { status } });
}

function toDocumentDto(document: {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}): ApplicationDocumentDto {
  return {
    id: document.id,
    fileName: document.fileName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    mediaType: evidenceMediaType(document.mimeType) ?? 'IMAGE',
    createdAt: document.createdAt.toISOString(),
  };
}

/** Abiertas primero por cierre más próximo; luego las próximas por apertura. */
function compareWindows(a: ApplicationWindow, b: ApplicationWindow): number {
  const rank = (w: ApplicationWindow) => (w.state === 'OPEN' ? 0 : 1);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  const key = (w: ApplicationWindow) =>
    (w.state === 'OPEN' ? w.closesAt : w.opensAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return key(a) - key(b);
}

/**
 * HU-21: las que requieren acción arriba (por fecha límite más próxima); luego el resto por último
 * cambio (más reciente primero).
 */
function compareCards(a: ApplicationCardDto, b: ApplicationCardDto): number {
  if (a.requiresAction !== b.requiresAction) return a.requiresAction ? -1 : 1;
  if (a.requiresAction) {
    const ad = a.action.dueAt ?? '9999';
    const bd = b.action.dueAt ?? '9999';
    if (ad !== bd) return ad < bd ? -1 : 1;
  }
  return a.statusChangedAt > b.statusChangedAt ? -1 : a.statusChangedAt < b.statusChangedAt ? 1 : 0;
}
