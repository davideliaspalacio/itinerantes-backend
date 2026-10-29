import { Logger } from '@nestjs/common';
import {
  type FakeResponse,
  mockFetch,
  type RecordedCall,
  timeoutError,
} from '../../../test/utils/fetch-mock';
import { AppException } from '../../common/errors/app.exception';
import { ZoomMeetingProvider } from './zoom-meeting-provider';

const CONFIG = {
  accountId: 'acc-123',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  hostUser: 'me',
};

const INPUT = {
  topic: 'Diplomado — Sesión 3',
  startAt: new Date('2030-11-12T17:00:00.000Z'),
  durationMinutes: 90,
  timezone: 'America/Mexico_City',
};

const CREATED = {
  id: 85746065432,
  join_url: 'https://us02web.zoom.us/j/85746065432?pwd=abc',
  start_url: 'https://us02web.zoom.us/s/85746065432?zak=old',
  password: 'abc',
};

const tokenOk = (token = 'tok-1', expiresIn = 3600): FakeResponse => ({
  status: 200,
  body: { access_token: token, token_type: 'bearer', expires_in: expiresIn },
});

const isToken = (call: RecordedCall) => call.url.startsWith('https://zoom.us/oauth/token');

async function expectAppError(promise: Promise<unknown>, code: string, status: number) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AppException);
  expect((error as AppException).code).toBe(code);
  expect((error as AppException).getStatus()).toBe(status);
}

describe('ZoomMeetingProvider', () => {
  let restore: (() => void) | undefined;
  beforeAll(() => Logger.overrideLogger(false));
  afterEach(() => restore?.());

  it('sin configuración: configured=false y 503 MEETING_PROVIDER_NOT_CONFIGURED', async () => {
    const zoom = new ZoomMeetingProvider(null);
    expect(zoom.configured).toBe(false);
    await expectAppError(zoom.create(INPUT), 'MEETING_PROVIDER_NOT_CONFIGURED', 503);
  });

  it('obtiene el token (Basic auth, account_credentials) y crea la reunión con el cuerpo esperado', async () => {
    const mock = mockFetch((call) => (isToken(call) ? tokenOk() : { status: 201, body: CREATED }));
    restore = mock.restore;
    const zoom = new ZoomMeetingProvider(CONFIG);

    const meeting = await zoom.create(INPUT);

    expect(mock.calls).toHaveLength(2);
    const [token, create] = mock.calls;
    expect(token.method).toBe('POST');
    const tokenUrl = new URL(token.url);
    expect(tokenUrl.origin + tokenUrl.pathname).toBe('https://zoom.us/oauth/token');
    expect(tokenUrl.searchParams.get('grant_type')).toBe('account_credentials');
    expect(tokenUrl.searchParams.get('account_id')).toBe('acc-123');
    expect(token.headers.authorization).toBe(
      `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`,
    );

    expect(create.method).toBe('POST');
    expect(create.url).toBe('https://api.zoom.us/v2/users/me/meetings');
    expect(create.headers.authorization).toBe('Bearer tok-1');
    expect(JSON.parse(create.body!)).toEqual({
      topic: 'Diplomado — Sesión 3',
      type: 2,
      start_time: '2030-11-12T17:00:00Z',
      duration: 90,
      timezone: 'America/Mexico_City',
      settings: { waiting_room: true, join_before_host: false },
    });

    expect(meeting).toEqual({
      provider: 'ZOOM',
      externalId: '85746065432',
      joinUrl: CREATED.join_url,
      hostUrl: CREATED.start_url,
      password: 'abc',
      startAt: INPUT.startAt,
      durationMinutes: 90,
    });
  });

  it('reutiliza el token en caché y lo renueva poco antes de vencer', async () => {
    let tokenCalls = 0;
    const mock = mockFetch((call) => {
      if (isToken(call)) return tokenOk(`tok-${++tokenCalls}`, 3600);
      return { status: 201, body: CREATED };
    });
    restore = mock.restore;
    let now = 1_000_000;
    const zoom = new ZoomMeetingProvider(CONFIG, { now: () => now });

    await zoom.create(INPUT);
    await zoom.create(INPUT);
    expect(tokenCalls).toBe(1);

    // A 30 s de vencer (margen de 60 s) → token nuevo.
    now += (3600 - 30) * 1000;
    await zoom.create(INPUT);
    expect(tokenCalls).toBe(2);
    expect(mock.calls.at(-1)!.headers.authorization).toBe('Bearer tok-2');
  });

  it('ante 401 renueva el token y reintenta una vez', async () => {
    let tokenCalls = 0;
    let apiCalls = 0;
    const mock = mockFetch((call) => {
      if (isToken(call)) return tokenOk(`tok-${++tokenCalls}`);
      return ++apiCalls === 1
        ? { status: 401, body: { code: 124 } }
        : { status: 201, body: CREATED };
    });
    restore = mock.restore;
    const meeting = await new ZoomMeetingProvider(CONFIG).create(INPUT);
    expect(meeting.externalId).toBe('85746065432');
    expect(tokenCalls).toBe(2);
  });

  it('usa ZOOM_HOST_USER (codificado) como anfitrión', async () => {
    const mock = mockFetch((call) => (isToken(call) ? tokenOk() : { status: 201, body: CREATED }));
    restore = mock.restore;
    await new ZoomMeetingProvider({ ...CONFIG, hostUser: 'agenda@escuela.org' }).create(INPUT);
    expect(mock.calls[1].url).toBe('https://api.zoom.us/v2/users/agenda%40escuela.org/meetings');
  });

  it('errores del proveedor → 502 MEETING_PROVIDER_ERROR (token rechazado, 4xx/5xx, timeout, respuesta incompleta)', async () => {
    let mock = mockFetch(() => ({
      status: 400,
      body: { reason: 'Invalid client_id or client_secret' },
    }));
    restore = mock.restore;
    await expectAppError(
      new ZoomMeetingProvider(CONFIG).create(INPUT),
      'MEETING_PROVIDER_ERROR',
      502,
    );
    mock.restore();

    mock = mockFetch((call) =>
      isToken(call) ? tokenOk() : { status: 500, body: { message: 'Internal' } },
    );
    restore = mock.restore;
    await expectAppError(
      new ZoomMeetingProvider(CONFIG).create(INPUT),
      'MEETING_PROVIDER_ERROR',
      502,
    );
    mock.restore();

    mock = mockFetch((call) => (isToken(call) ? tokenOk() : timeoutError()));
    restore = mock.restore;
    const error = await new ZoomMeetingProvider(CONFIG).create(INPUT).catch((e: unknown) => e);
    expect((error as AppException).code).toBe('MEETING_PROVIDER_ERROR');
    expect((error as AppException).meta).toEqual({ provider: 'ZOOM' });
    mock.restore();

    mock = mockFetch((call) =>
      isToken(call)
        ? tokenOk()
        : { status: 201, body: { ...CREATED, join_url: 'https://evil.example.com/j/1' } },
    );
    restore = mock.restore;
    await expectAppError(
      new ZoomMeetingProvider(CONFIG).create(INPUT),
      'MEETING_PROVIDER_ERROR',
      502,
    );
  });

  it('getHostUrl: GET /meetings/{id} devuelve un start_url nuevo; 404 → NOT_FOUND', async () => {
    const mock = mockFetch((call) => {
      if (isToken(call)) return tokenOk();
      if (call.url.endsWith('/meetings/85746065432')) {
        return {
          status: 200,
          body: { ...CREATED, start_url: 'https://us02web.zoom.us/s/857?zak=new' },
        };
      }
      return { status: 404, body: { code: 3001, message: 'Meeting does not exist' } };
    });
    restore = mock.restore;
    const zoom = new ZoomMeetingProvider(CONFIG);
    await expect(zoom.getHostUrl('85746065432')).resolves.toBe(
      'https://us02web.zoom.us/s/857?zak=new',
    );
    expect(mock.calls[1].method).toBe('GET');
    await expectAppError(zoom.getHostUrl('111'), 'NOT_FOUND', 404);
  });

  it('cancel: DELETE /meetings/{id}; 204 y 404 son éxito; otros errores → 502', async () => {
    const statuses: Record<string, number> = { '1': 204, '2': 404, '3': 500 };
    const mock = mockFetch((call) => {
      if (isToken(call)) return tokenOk();
      return { status: statuses[call.url.split('/').pop()!] };
    });
    restore = mock.restore;
    const zoom = new ZoomMeetingProvider(CONFIG);
    await expect(zoom.cancel('1')).resolves.toBeUndefined();
    expect(mock.calls[1]).toMatchObject({
      method: 'DELETE',
      url: 'https://api.zoom.us/v2/meetings/1',
    });
    await expect(zoom.cancel('2')).resolves.toBeUndefined();
    await expectAppError(zoom.cancel('3'), 'MEETING_PROVIDER_ERROR', 502);
  });
});
