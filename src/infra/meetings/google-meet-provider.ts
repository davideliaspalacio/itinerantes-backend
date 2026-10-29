import { randomUUID } from 'node:crypto';
import { AppException } from '../../common/errors/app.exception';
import { isMeetingUrl } from '../../common/utils/urls';
import { BUSINESS_RULES } from '../../config/business-rules';
import {
  GOOGLE_CALENDAR_EVENTS_SCOPE,
  GOOGLE_TOKEN_URL,
  signServiceAccountJwt,
} from './google-jwt';
import type { CreatedMeeting, CreateMeetingInput, MeetingProviderClient } from './meeting-gateway';
import {
  asRecord,
  defaultSleep,
  type HttpResult,
  meetingProviderError,
  type MeetingProviderDeps,
  requestJson,
  stringOrNull,
  toProviderIso,
  unexpectedResponse,
} from './meeting-http';
import { type FetchedToken, OAuthTokenCache } from './oauth-token-cache';

export const GOOGLE_CALENDAR_API_BASE_URL = 'https://www.googleapis.com/calendar/v3';

export interface GoogleMeetConfig {
  serviceAccountEmail: string;
  /** PEM ya normalizado (`normalizePrivateKey`). */
  privateKey: string;
  /** Usuario de Workspace suplantado (organizador de los eventos). */
  impersonateUser: string;
  /** Calendario de destino (`primary` = el del usuario suplantado). */
  calendarId: string;
}

/**
 * Google Meet a través de Google Calendar API con una cuenta de servicio y delegación de todo el
 * dominio (Google Workspace):
 *
 * - Token: aserción JWT RS256 firmada con `node:crypto` (`iss` = cuenta de servicio, `sub` =
 *   usuario suplantado, scope `calendar.events`) → `POST https://oauth2.googleapis.com/token`.
 * - Crear: evento en el calendario con `conferenceDataVersion=1` y `conferenceData.createRequest`
 *   (`hangoutsMeet`, `requestId` aleatorio). `joinUrl` = `hostUrl` = `hangoutLink` (el anfitrión es
 *   el organizador del evento). Si Google deja la sala "pending", se relee el evento unas veces.
 * - Cancelar: borrar el evento (`sendUpdates=none`; 404/410 = ya no existe → OK).
 */
export class GoogleMeetProvider implements MeetingProviderClient {
  readonly provider = 'GOOGLE_MEET' as const;
  private readonly tokens: OAuthTokenCache;
  private readonly now: () => number;

  constructor(
    private readonly config: GoogleMeetConfig | null,
    private readonly deps: MeetingProviderDeps = {},
  ) {
    this.now = deps.now ?? Date.now;
    this.tokens = new OAuthTokenCache(() => this.fetchToken(), this.now);
  }

  get configured(): boolean {
    return this.config !== null;
  }

  async create(input: CreateMeetingInput): Promise<CreatedMeeting> {
    const endAt = new Date(input.startAt.getTime() + input.durationMinutes * 60_000);
    const result = await this.api('POST', `${this.eventsPath()}?conferenceDataVersion=1`, {
      summary: input.topic,
      start: { dateTime: toProviderIso(input.startAt), timeZone: input.timezone },
      end: { dateTime: toProviderIso(endAt), timeZone: input.timezone },
      conferenceData: {
        createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } },
      },
    });
    if (!result.ok) throw unexpectedResponse(this.provider, 'crear evento', result);
    let event = asRecord(result.body);
    const externalId = stringOrNull(event.id);
    if (!externalId) throw meetingProviderError(this.provider, 'respuesta de creación sin id');

    let link = meetLink(event);
    const attempts = BUSINESS_RULES.MEETING_GOOGLE_CONFERENCE_POLL_ATTEMPTS;
    for (let i = 0; !link && conferenceStatus(event) === 'pending' && i < attempts; i++) {
      await (this.deps.sleep ?? defaultSleep)(
        BUSINESS_RULES.MEETING_GOOGLE_CONFERENCE_POLL_INTERVAL_MS,
      );
      const reread = await this.api('GET', this.eventPath(externalId));
      if (!reread.ok) break;
      event = asRecord(reread.body);
      link = meetLink(event);
    }
    if (!link) {
      // Sin sala de Meet el evento no sirve: se borra para no dejar basura en el calendario.
      await this.cancel(externalId).catch(() => undefined);
      throw meetingProviderError(
        this.provider,
        `evento sin enlace de Meet (estado ${conferenceStatus(event) ?? 'desconocido'})`,
      );
    }
    return {
      provider: this.provider,
      externalId,
      joinUrl: link,
      hostUrl: link,
      password: null,
      startAt: input.startAt,
      durationMinutes: input.durationMinutes,
    };
  }

  async getHostUrl(externalId: string): Promise<string> {
    const result = await this.api('GET', this.eventPath(externalId));
    const event = asRecord(result.body);
    if (result.status === 404 || result.status === 410 || event.status === 'cancelled') {
      throw AppException.notFound('La reunión ya no existe en Google Calendar.');
    }
    if (!result.ok) throw unexpectedResponse(this.provider, 'consultar evento', result);
    const link = meetLink(event);
    if (!link) throw meetingProviderError(this.provider, 'evento sin enlace de Meet');
    return link;
  }

  async cancel(externalId: string): Promise<void> {
    const result = await this.api('DELETE', `${this.eventPath(externalId)}?sendUpdates=none`);
    if (result.ok || result.status === 404 || result.status === 410) return;
    throw unexpectedResponse(this.provider, 'borrar evento', result);
  }

  private eventsPath(): string {
    return `/calendars/${encodeURIComponent(this.requireConfig().calendarId)}/events`;
  }

  private eventPath(externalId: string): string {
    return `${this.eventsPath()}/${encodeURIComponent(externalId)}`;
  }

  /** Llamada a Calendar con el token en caché; con 401 renueva el token y reintenta una vez. */
  private async api(method: string, path: string, body?: unknown): Promise<HttpResult> {
    this.requireConfig();
    const send = async (): Promise<HttpResult> => {
      const token = await this.tokens.get();
      return requestJson(
        this.provider,
        `${GOOGLE_CALENDAR_API_BASE_URL}${path}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        },
        this.deps,
      );
    };
    const first = await send();
    if (first.status !== 401) return first;
    this.tokens.invalidate();
    return send();
  }

  private async fetchToken(): Promise<FetchedToken> {
    const config = this.requireConfig();
    let assertion: string;
    try {
      assertion = signServiceAccountJwt({
        clientEmail: config.serviceAccountEmail,
        privateKey: config.privateKey,
        subject: config.impersonateUser,
        scope: GOOGLE_CALENDAR_EVENTS_SCOPE,
        nowSeconds: Math.floor(this.now() / 1000),
      });
    } catch {
      // Llave PEM inválida: no se registra la llave ni el error (podría incluir fragmentos).
      throw meetingProviderError(this.provider, 'llave privada de la cuenta de servicio inválida');
    }
    const result = await requestJson(
      this.provider,
      GOOGLE_TOKEN_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }).toString(),
      },
      this.deps,
    );
    const body = asRecord(result.body);
    const accessToken = typeof body.access_token === 'string' ? body.access_token : null;
    if (!result.ok || !accessToken)
      throw unexpectedResponse(this.provider, 'obtener token', result);
    const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : 3600;
    return { accessToken, expiresInSeconds: expiresIn };
  }

  private requireConfig(): GoogleMeetConfig {
    if (!this.config) {
      throw new AppException('MEETING_PROVIDER_NOT_CONFIGURED', {
        meta: { provider: 'GOOGLE_MEET' },
      });
    }
    return this.config;
  }
}

/** Enlace de Meet del evento: `hangoutLink` o el punto de entrada de video de `conferenceData`. */
function meetLink(event: Record<string, unknown>): string | null {
  const direct = stringOrNull(event.hangoutLink);
  const entryPoints = asRecord(event.conferenceData).entryPoints;
  const video = Array.isArray(entryPoints)
    ? entryPoints.map(asRecord).find((entry) => entry.entryPointType === 'video')
    : undefined;
  const link = direct ?? stringOrNull(video?.uri);
  return link && isMeetingUrl(link) ? link : null;
}

function conferenceStatus(event: Record<string, unknown>): string | null {
  const status = asRecord(asRecord(asRecord(event.conferenceData).createRequest).status);
  return stringOrNull(status.statusCode);
}
