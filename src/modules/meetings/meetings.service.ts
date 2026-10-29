import { Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import type { AdminUser } from '../../common/guards/permissions.guard';
import { nowUtc, OFFICIAL_TIMEZONE } from '../../common/utils/time';
import {
  MEETING_GATEWAY,
  MEETING_PROVIDERS,
  type MeetingGateway,
  type MeetingProvider,
} from '../../infra/meetings/meeting-gateway';
import { AuditService } from '../audit/audit.service';
import type {
  CreateMeetingRequestDto,
  MeetingDto,
  MeetingHostUrlDto,
  MeetingProvidersResponseDto,
} from './dto/meetings.dto';
import {
  MEETING_PROVIDER_LABELS,
  MEETING_PROVIDER_USABLE_FOR_INTERVIEWS,
  meetingAuditEntityId,
  validateMeetingSchedule,
} from './meetings.policy';

/**
 * Reuniones de Zoom / Google Meet generadas desde el panel ("Generar enlace", apoyo a HU-29 y
 * HU-31). No guarda nada propio en la BD: devuelve los enlaces para que el panel los envíe con los
 * endpoints de sesiones / entrevistas que ya existen. Alta y cancelación quedan en la auditoría.
 */
@Injectable()
export class MeetingsService {
  constructor(
    @Inject(MEETING_GATEWAY) private readonly gateway: MeetingGateway,
    private readonly audit: AuditService,
  ) {}

  providers(): MeetingProvidersResponseDto {
    const enabled = new Set(this.gateway.enabledProviders());
    return {
      data: MEETING_PROVIDERS.map((provider) => ({
        provider,
        label: MEETING_PROVIDER_LABELS[provider],
        enabled: enabled.has(provider),
        usableForInterviews: MEETING_PROVIDER_USABLE_FOR_INTERVIEWS[provider],
      })),
    };
  }

  async create(dto: CreateMeetingRequestDto, actor: AdminUser): Promise<MeetingDto> {
    const startAt = new Date(dto.startAt);
    const issues = validateMeetingSchedule(startAt, nowUtc());
    if (issues.length > 0) throw AppException.validation(issues);
    const timezone = dto.timezone ?? OFFICIAL_TIMEZONE;

    const meeting = await this.gateway.create(dto.provider, {
      topic: dto.topic,
      startAt,
      durationMinutes: dto.durationMinutes,
      timezone,
    });

    await this.audit.record({
      actor,
      action: 'meeting.create',
      entityType: 'Meeting',
      entityId: meetingAuditEntityId(meeting.provider, meeting.externalId),
      summary: `Generó una reunión de ${MEETING_PROVIDER_LABELS[meeting.provider]} «${dto.topic}»`,
      after: {
        provider: meeting.provider,
        externalId: meeting.externalId,
        topic: dto.topic,
        startAt: meeting.startAt.toISOString(),
        durationMinutes: meeting.durationMinutes,
        timezone,
        joinUrl: meeting.joinUrl,
      },
    });

    return {
      provider: meeting.provider,
      externalId: meeting.externalId,
      joinUrl: meeting.joinUrl,
      hostUrl: meeting.hostUrl,
      password: meeting.password,
      startAt: meeting.startAt.toISOString(),
      durationMinutes: meeting.durationMinutes,
    };
  }

  async hostUrl(provider: MeetingProvider, externalId: string): Promise<MeetingHostUrlDto> {
    const hostUrl = await this.gateway.getHostUrl(provider, externalId);
    return { provider, externalId, hostUrl };
  }

  async cancel(provider: MeetingProvider, externalId: string, actor: AdminUser): Promise<void> {
    await this.gateway.cancel(provider, externalId);
    await this.audit.record({
      actor,
      action: 'meeting.cancel',
      entityType: 'Meeting',
      entityId: meetingAuditEntityId(provider, externalId),
      summary: `Canceló la reunión de ${MEETING_PROVIDER_LABELS[provider]} ${externalId}`,
      before: { provider, externalId },
    });
  }
}
