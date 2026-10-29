import { AppException } from '../../common/errors/app.exception';
import { isZoomUrl } from '../../common/utils/urls';
import type { CreatedMeeting, CreateMeetingInput, MeetingProviderClient } from './meeting-gateway';
import {
  asRecord,
  type HttpResult,
  meetingProviderError,
  type MeetingProviderDeps,
  requestJson,
  stringOrNull,
  toProviderIso,
  unexpectedResponse,
} from './meeting-http';
import { type FetchedToken, OAuthTokenCache } from './oauth-token-cache';

export const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';
export const ZOOM_API_BASE_URL = 'https://api.zoom.us/v2';

export interface ZoomConfig {
  accountId: string;
  clientId: string;
  clientSecret: string;
  /** Usuario anfitrión (correo o id). `me` = el dueño de la app Server-to-Server. */
  hostUser: string;
}

/**
 * Zoom con una app "Server-to-Server OAuth" (sin interacción del usuario):
 *
 * - Token: `POST https://zoom.us/oauth/token?grant_type=account_credentials&account_id=…` con Basic
 *   auth (`client_id:client_secret`). Vida ≈ 1 h; se cachea en memoria hasta poco antes de vencer.
 * - Crear: `POST /v2/users/{hostUser}/meetings` (tipo 2 = programada, sala de espera, sin entrar
 *   antes que el anfitrión). `join_url` → `joinUrl`, `start_url` → `hostUrl`.
 * - `start_url` CADUCA (≈2 h desde que se emite): `getHostUrl` hace `GET /v2/meetings/{id}`, que
 *   devuelve uno nuevo. El panel debe pedirlo justo antes de iniciar la reunión.
 * - Cancelar: `DELETE /v2/meetings/{id}` (404 = ya no existe → OK).
 *
 * Scopes de la app: `meeting:write:admin` y `meeting:read:admin` (o los granulares
 * `meeting:write:meeting:admin`, `meeting:read:meeting:admin`, `meeting:delete:meeting:admin`).
 */
export class ZoomMeetingProvider implements MeetingProviderClient {
  readonly provider = 'ZOOM' as const;
  private readonly tokens: OAuthTokenCache;

  constructor(
    private readonly config: ZoomConfig | null,
    private readonly deps: MeetingProviderDeps = {},
  ) {
    this.tokens = new OAuthTokenCache(() => this.fetchToken(), deps.now ?? Date.now);
  }

  get configured(): boolean {
    return this.config !== null;
  }

  async create(input: CreateMeetingInput): Promise<CreatedMeeting> {
    const config = this.requireConfig();
    const result = await this.api(
      'POST',
      `/users/${encodeURIComponent(config.hostUser)}/meetings`,
      {
        topic: input.topic,
        type: 2,
        start_time: toProviderIso(input.startAt),
        duration: input.durationMinutes,
        timezone: input.timezone,
        settings: { waiting_room: true, join_before_host: false },
      },
    );
    if (result.status !== 201 && result.status !== 200) {
      throw unexpectedResponse(this.provider, 'crear reunión', result);
    }
    const body = asRecord(result.body);
    const externalId = stringOrNull(body.id);
    const joinUrl = stringOrNull(body.join_url);
    const hostUrl = stringOrNull(body.start_url);
    if (!externalId || !joinUrl || !isZoomUrl(joinUrl) || !hostUrl || !isZoomUrl(hostUrl)) {
      throw meetingProviderError(this.provider, 'respuesta de creación sin id/join_url/start_url');
    }
    return {
      provider: this.provider,
      externalId,
      joinUrl,
      hostUrl,
      password: stringOrNull(body.password),
      startAt: input.startAt,
      durationMinutes: input.durationMinutes,
    };
  }

  async getHostUrl(externalId: string): Promise<string> {
    const result = await this.api('GET', `/meetings/${encodeURIComponent(externalId)}`);
    if (result.status === 404) {
      throw AppException.notFound('La reunión ya no existe en Zoom.');
    }
    if (!result.ok) throw unexpectedResponse(this.provider, 'consultar reunión', result);
    const hostUrl = stringOrNull(asRecord(result.body).start_url);
    if (!hostUrl || !isZoomUrl(hostUrl)) {
      throw meetingProviderError(this.provider, 'respuesta sin start_url');
    }
    return hostUrl;
  }

  async cancel(externalId: string): Promise<void> {
    const result = await this.api('DELETE', `/meetings/${encodeURIComponent(externalId)}`);
    if (result.ok || result.status === 404) return;
    throw unexpectedResponse(this.provider, 'cancelar reunión', result);
  }

  /** Llamada a la API con el token en caché; si responde 401 se renueva el token y se reintenta una vez. */
  private async api(method: string, path: string, body?: unknown): Promise<HttpResult> {
    this.requireConfig();
    const send = async (): Promise<HttpResult> => {
      const token = await this.tokens.get();
      return requestJson(
        this.provider,
        `${ZOOM_API_BASE_URL}${path}`,
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
    const query = new URLSearchParams({
      grant_type: 'account_credentials',
      account_id: config.accountId,
    });
    const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    const result = await requestJson(
      this.provider,
      `${ZOOM_TOKEN_URL}?${query.toString()}`,
      { method: 'POST', headers: { Authorization: `Basic ${basic}` } },
      this.deps,
    );
    const body = asRecord(result.body);
    const accessToken = typeof body.access_token === 'string' ? body.access_token : null;
    if (!result.ok || !accessToken)
      throw unexpectedResponse(this.provider, 'obtener token', result);
    const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : 3600;
    return { accessToken, expiresInSeconds: expiresIn };
  }

  private requireConfig(): ZoomConfig {
    if (!this.config) {
      throw new AppException('MEETING_PROVIDER_NOT_CONFIGURED', { meta: { provider: 'ZOOM' } });
    }
    return this.config;
  }
}
