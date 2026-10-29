import type { ErrorDetail } from '../../common/errors/app.exception';
import { MEETING_PROVIDERS, type MeetingProvider } from '../../infra/meetings/meeting-gateway';

/** Reglas puras del módulo de reuniones generadas. */

export const MEETING_PROVIDER_LABELS: Record<MeetingProvider, string> = {
  ZOOM: 'Zoom',
  GOOGLE_MEET: 'Google Meet',
};

/** HU-31: la entrevista exige un enlace de zoom.us (`isZoomUrl`): Meet solo sirve para sesiones. */
export const MEETING_PROVIDER_USABLE_FOR_INTERVIEWS: Record<MeetingProvider, boolean> = {
  ZOOM: true,
  GOOGLE_MEET: false,
};

/** Ids de Zoom (numéricos) y de eventos de Google (base32hex) caben en este patrón. */
const EXTERNAL_ID_PATTERN = /^[A-Za-z0-9_-]{1,255}$/;

export function isMeetingProvider(value: string): value is MeetingProvider {
  return (MEETING_PROVIDERS as readonly string[]).includes(value);
}

export function isValidExternalId(value: string): boolean {
  return EXTERNAL_ID_PATTERN.test(value);
}

/** Errores de reglas del alta que no cubre class-validator (inicio en el futuro). */
export function validateMeetingSchedule(startAt: Date, now: Date): ErrorDetail[] {
  if (startAt.getTime() <= now.getTime()) {
    return [
      {
        field: 'startAt',
        code: 'MUST_BE_FUTURE',
        message: 'La reunión debe empezar en el futuro.',
      },
    ];
  }
  return [];
}

/** `entityId` de la auditoría (`VarChar(64)`): `ZOOM:85746065432`. */
export function meetingAuditEntityId(provider: MeetingProvider, externalId: string): string {
  return `${provider}:${externalId}`.slice(0, 64);
}
