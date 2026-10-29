import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { paginate, type PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { nowUtc } from '../../common/utils/time';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { ProgressDto } from '../enrollments/dto/portal-shared.dto';
import { EnrollmentAccessService } from '../enrollments/enrollment-access.service';
import { computeProgress } from '../enrollments/policies/progress.policy';
import type {
  AttendanceResultDto,
  ListSessionsQueryDto,
  RegisterAttendanceRequestDto,
  SessionCardDto,
} from './dto/sessions.dto';
import {
  attendanceInfo,
  attendanceRegistrationError,
  effectiveAttendanceWindowHours,
} from './policies/session.policy';
import { sessionViewSelect, toSessionCard } from './session-view';

/**
 * Sesiones en vivo (HU-12) y registro de asistencia (HU-18).
 */
@Injectable()
export class LiveSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EnrollmentAccessService,
  ) {}

  /**
   * Próximas / historial de las ofertas con acceso. Sin `offerId` solo las ofertas EN LÍNEA
   * (Anexo A HU-12: los talleres presenciales se consultan en Calendario y Aula).
   */
  async list(
    userId: string,
    query: ListSessionsQueryDto,
  ): Promise<PaginatedResponseDto<SessionCardDto>> {
    const now = nowUtc();
    let offerIds: string[];
    if (query.offerId) {
      await this.access.requireClassroomAccess(userId, query.offerId);
      offerIds = [query.offerId];
    } else {
      offerIds = [...(await this.access.accessibleOfferIds(userId))];
    }
    return this.listForOffers(userId, offerIds, query, now, !query.offerId);
  }

  /** Igual que `list` para ofertas ya autorizadas (lo reutiliza el Aula). */
  async listForOffers(
    userId: string,
    offerIds: readonly string[],
    query: Pick<ListSessionsQueryDto, 'scope' | 'skip' | 'take' | 'page' | 'pageSize'>,
    now: Date,
    onlineOnly: boolean,
  ): Promise<PaginatedResponseDto<SessionCardDto>> {
    const upcoming = query.scope === 'UPCOMING';
    const where: Prisma.OfferSessionWhereInput = {
      offerId: { in: [...offerIds] },
      endsAt: upcoming ? { gt: now } : { lte: now },
      ...(onlineOnly ? { offer: { modality: 'ONLINE_LIVE' } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.offerSession.findMany({
        where,
        select: sessionViewSelect(userId),
        orderBy: [{ startsAt: upcoming ? 'asc' : 'desc' }, { id: 'asc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.offerSession.count({ where }),
    ]);
    return paginate(
      rows.map((row) => toSessionCard(row, now)),
      total,
      query,
    );
  }

  /** Detalle de una sesión (registro de asistencia `/asistencia/[sesión]`, HU-18). */
  async detail(userId: string, sessionId: string): Promise<SessionCardDto> {
    const { row } = await this.findAuthorized(userId, sessionId);
    return toSessionCard(row, nowUtc());
  }

  /** HU-18: "Asistí a la sesión" + comentario opcional, dentro de la ventana, sin duplicar. */
  async registerAttendance(
    userId: string,
    sessionId: string,
    dto: RegisterAttendanceRequestDto,
  ): Promise<AttendanceResultDto> {
    const { row, enrollment } = await this.findAuthorized(userId, sessionId);
    const now = nowUtc();
    const info = attendanceInfo(
      {
        status: row.status,
        endsAt: row.endsAt,
        windowHours: effectiveAttendanceWindowHours(
          row.attendanceWindowHours,
          row.offer.attendanceWindowHours,
        ),
        record: row.attendances[0] ?? null,
      },
      now,
    );
    const error = attendanceRegistrationError(info);
    if (error) {
      throw new AppException(error, {
        meta: {
          opensAt: info.opensAt.toISOString(),
          closesAt: info.closesAt.toISOString(),
          registeredAt: info.registeredAt?.toISOString() ?? null,
        },
      });
    }

    try {
      await this.prisma.sessionAttendance.create({
        data: {
          sessionId,
          userId,
          enrollmentId: enrollment.id,
          source: 'PARTICIPANT',
          comment: dto.comment ?? null,
          registeredAt: now,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppException('ATTENDANCE_ALREADY_REGISTERED');
      }
      throw e;
    }

    const [session, progress] = await Promise.all([
      this.detail(userId, sessionId),
      this.progressFor(userId, row.offerId),
    ]);
    return { session, progress };
  }

  /** Progreso del Aula (asistidas ÷ programadas sin canceladas). */
  async progressFor(userId: string, offerId: string): Promise<ProgressDto> {
    const [sessions, attended] = await Promise.all([
      this.prisma.offerSession.findMany({
        where: { offerId },
        select: { id: true, status: true },
      }),
      this.prisma.sessionAttendance.findMany({
        where: { userId, session: { offerId } },
        select: { sessionId: true },
      }),
    ]);
    return computeProgress(sessions, new Set(attended.map((a) => a.sessionId)));
  }

  private async findAuthorized(userId: string, sessionId: string) {
    const row = await this.prisma.offerSession.findUnique({
      where: { id: sessionId },
      select: sessionViewSelect(userId),
    });
    if (!row) throw AppException.notFound('La sesión no existe.');
    const enrollment = await this.access.requireClassroomAccess(userId, row.offerId);
    return { row, enrollment };
  }
}
