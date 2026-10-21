import { OFFICIAL_TIMEZONE } from '../../common/utils/time';
import type { Prisma } from '../../generated/prisma/client';
import { isPublishedNow } from '../classroom/policies/classroom.policy';
import type { SessionCardDto } from './dto/sessions.dto';
import {
  attendanceInfo,
  effectiveAttendanceWindowHours,
  joinInfo,
  recordingInfo,
  sessionPlatform,
} from './policies/session.policy';

/**
 * Selección y mapeo compartidos de una sesión para el participante (sesiones, Aula, calendario,
 * Dashboard). `hostUrl` NUNCA se selecciona (HU-12: el participante solo recibe el join_url).
 */
export function sessionViewSelect(userId: string) {
  return {
    id: true,
    offerId: true,
    startsAt: true,
    endsAt: true,
    status: true,
    category: true,
    joinUrl: true,
    recordingUrl: true,
    attendanceWindowHours: true,
    originalStartsAt: true,
    changeReason: true,
    offer: {
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        modality: true,
        attendanceWindowHours: true,
        venueName: true,
        venueAddress: true,
        venueCity: true,
        venueMapsUrl: true,
        teachers: {
          orderBy: { position: 'asc' },
          select: { teacher: { select: { fullName: true } } },
        },
      },
    },
    module: {
      select: {
        id: true,
        position: true,
        title: true,
        visibility: true,
        publishAt: true,
        teacher: { select: { fullName: true } },
      },
    },
    attendances: {
      where: { userId },
      select: { registeredAt: true, source: true, comment: true },
    },
  } as const satisfies Prisma.OfferSessionSelect;
}

export type SessionViewRow = Prisma.OfferSessionGetPayload<{
  select: ReturnType<typeof sessionViewSelect>;
}>;

export function toSessionCard(row: SessionViewRow, now: Date): SessionCardDto {
  const { offer } = row;
  const join = joinInfo(
    {
      status: row.status,
      modality: offer.modality,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      joinUrl: row.joinUrl,
    },
    now,
  );
  const recording = recordingInfo(
    {
      status: row.status,
      modality: offer.modality,
      endsAt: row.endsAt,
      recordingUrl: row.recordingUrl,
    },
    now,
  );
  const windowHours = effectiveAttendanceWindowHours(
    row.attendanceWindowHours,
    offer.attendanceWindowHours,
  );
  const record = row.attendances[0] ?? null;
  const attendance = attendanceInfo(
    { status: row.status, endsAt: row.endsAt, windowHours, record },
    now,
  );
  const module = row.module && isPublishedNow(row.module, now) ? row.module : null;
  const teacherNames = module?.teacher
    ? [module.teacher.fullName]
    : offer.teachers.map(({ teacher }) => teacher.fullName);

  return {
    id: row.id,
    offer: {
      id: offer.id,
      slug: offer.slug,
      name: offer.name,
      type: offer.type,
      modality: offer.modality,
    },
    module: module ? { id: module.id, number: module.position, title: module.title } : null,
    teacherNames,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    timezone: OFFICIAL_TIMEZONE,
    status: row.status,
    category: row.category,
    originalStartsAt: row.originalStartsAt?.toISOString() ?? null,
    changeReason: row.changeReason,
    platform: offer.modality === 'ONLINE_LIVE' ? sessionPlatform(row.joinUrl) : null,
    venue:
      offer.modality === 'IN_PERSON' && offer.venueName
        ? {
            name: offer.venueName,
            address: offer.venueAddress,
            city: offer.venueCity,
            mapsUrl: offer.venueMapsUrl,
          }
        : null,
    join: { state: join.state, opensAt: join.opensAt.toISOString(), url: join.url },
    recording,
    attendance: {
      status: attendance.status,
      windowState: attendance.windowState,
      opensAt: attendance.opensAt.toISOString(),
      closesAt: attendance.closesAt.toISOString(),
      windowHours,
      canRegister: attendance.canRegister,
      registeredAt: attendance.registeredAt?.toISOString() ?? null,
      source: attendance.source,
      comment: attendance.comment,
    },
  };
}
