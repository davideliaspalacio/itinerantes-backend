import { Logger } from '@nestjs/common';
import { generateKeyPairSync, verify } from 'node:crypto';
import { type FakeResponse, mockFetch, type RecordedCall } from '../../../test/utils/fetch-mock';
import { AppException } from '../../common/errors/app.exception';
import { GoogleMeetProvider } from './google-meet-provider';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

const CONFIG = {
  serviceAccountEmail: 'eia@proyecto.iam.gserviceaccount.com',
  privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  impersonateUser: 'agenda@escuela.org',
  calendarId: 'primary',
};

const INPUT = {
  topic: 'Diplomado — Sesión 3',
  startAt: new Date('2030-11-12T17:00:00.000Z'),
  durationMinutes: 90,
  timezone: 'America/Mexico_City',
};

const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const LINK = 'https://meet.google.com/abc-defg-hij';

const tokenOk = (token = 'g-tok-1'): FakeResponse => ({
  status: 200,
  body: { access_token: token, expires_in: 3599, token_type: 'Bearer' },
});
const isToken = (call: RecordedCall) => call.url === 'https://oauth2.googleapis.com/token';

const event = (overrides: Record<string, unknown> = {}) => ({
  id: 'evt123abc',
  status: 'confirmed',
  hangoutLink: LINK,
  conferenceData: {
    createRequest: { status: { statusCode: 'success' } },
    entryPoints: [{ entryPointType: 'video', uri: LINK }],
  },
  ...overrides,
});

async function expectAppError(promise: Promise<unknown>, code: string, status: number) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AppException);
  expect((error as AppException).code).toBe(code);
  expect((error as AppException).getStatus()).toBe(status);
}

describe('GoogleMeetProvider', () => {
  let restore: (() => void) | undefined;
  beforeAll(() => Logger.overrideLogger(false));
  afterEach(() => restore?.());

  it('sin configuración → 503 MEETING_PROVIDER_NOT_CONFIGURED', async () => {
    const google = new GoogleMeetProvider(null);
    expect(google.configured).toBe(false);
    await expectAppError(google.cancel('x'), 'MEETING_PROVIDER_NOT_CONFIGURED', 503);
  });

  it('intercambia una aserción JWT firmada (verificable) y crea el evento con sala de Meet', async () => {
    const mock = mockFetch((call) => (isToken(call) ? tokenOk() : { status: 200, body: event() }));
    restore = mock.restore;
    const now = Date.UTC(2030, 0, 1);
    const google = new GoogleMeetProvider(CONFIG, { now: () => now });

    const meeting = await google.create(INPUT);

    const [token, create] = mock.calls;
    expect(token.method).toBe('POST');
    expect(token.headers['content-type']).toBe('application/x-www-form-urlencoded');
    const form = new URLSearchParams(token.body);
    expect(form.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    const [h, c, s] = form.get('assertion')!.split('.');
    expect(verify('sha256', Buffer.from(`${h}.${c}`), publicKey, Buffer.from(s, 'base64url'))).toBe(
      true,
    );
    expect(JSON.parse(Buffer.from(c, 'base64url').toString())).toEqual({
      iss: CONFIG.serviceAccountEmail,
      sub: 'agenda@escuela.org',
      scope: 'https://www.googleapis.com/auth/calendar.events',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now / 1000,
      exp: now / 1000 + 3600,
    });

    expect(create.method).toBe('POST');
    expect(create.url).toBe(`${EVENTS_URL}?conferenceDataVersion=1`);
    expect(create.headers.authorization).toBe('Bearer g-tok-1');
    const body = JSON.parse(create.body!) as Record<string, unknown>;
    expect(body).toMatchObject({
      summary: 'Diplomado — Sesión 3',
      start: { dateTime: '2030-11-12T17:00:00Z', timeZone: 'America/Mexico_City' },
      end: { dateTime: '2030-11-12T18:30:00Z', timeZone: 'America/Mexico_City' },
      conferenceData: { createRequest: { conferenceSolutionKey: { type: 'hangoutsMeet' } } },
    });
    const requestId = (body.conferenceData as { createRequest: { requestId: string } })
      .createRequest.requestId;
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);

    expect(meeting).toEqual({
      provider: 'GOOGLE_MEET',
      externalId: 'evt123abc',
      joinUrl: LINK,
      hostUrl: LINK,
      password: null,
      startAt: INPUT.startAt,
      durationMinutes: 90,
    });
  });

  it('reutiliza el token entre llamadas', async () => {
    let tokenCalls = 0;
    const mock = mockFetch((call) => {
      if (isToken(call)) {
        tokenCalls++;
        return tokenOk();
      }
      return { status: 200, body: event() };
    });
    restore = mock.restore;
    const google = new GoogleMeetProvider(CONFIG);
    await google.create(INPUT);
    await google.getHostUrl('evt123abc');
    expect(tokenCalls).toBe(1);
  });

  it('sala "pending": relee el evento hasta tener hangoutLink', async () => {
    let reads = 0;
    const mock = mockFetch((call) => {
      if (isToken(call)) return tokenOk();
      if (call.method === 'POST') {
        return {
          status: 200,
          body: event({
            hangoutLink: undefined,
            conferenceData: { createRequest: { status: { statusCode: 'pending' } } },
          }),
        };
      }
      reads++;
      return { status: 200, body: event() };
    });
    restore = mock.restore;
    const sleep = jest.fn(() => Promise.resolve());
    const meeting = await new GoogleMeetProvider(CONFIG, { sleep }).create(INPUT);
    expect(meeting.joinUrl).toBe(LINK);
    expect(reads).toBe(1);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('sin sala de Meet (failure): borra el evento y responde 502', async () => {
    const mock = mockFetch((call) => {
      if (isToken(call)) return tokenOk();
      if (call.method === 'POST') {
        return {
          status: 200,
          body: event({
            hangoutLink: undefined,
            conferenceData: { createRequest: { status: { statusCode: 'failure' } } },
          }),
        };
      }
      return { status: 204 };
    });
    restore = mock.restore;
    await expectAppError(
      new GoogleMeetProvider(CONFIG).create(INPUT),
      'MEETING_PROVIDER_ERROR',
      502,
    );
    expect(mock.calls.at(-1)).toMatchObject({
      method: 'DELETE',
      url: `${EVENTS_URL}/evt123abc?sendUpdates=none`,
    });
  });

  it('errores: token rechazado o 403 de Calendar → 502 MEETING_PROVIDER_ERROR', async () => {
    let mock = mockFetch(() => ({
      status: 401,
      body: { error: 'unauthorized_client', error_description: 'Client is unauthorized' },
    }));
    restore = mock.restore;
    await expectAppError(
      new GoogleMeetProvider(CONFIG).create(INPUT),
      'MEETING_PROVIDER_ERROR',
      502,
    );
    mock.restore();

    mock = mockFetch((call) =>
      isToken(call) ? tokenOk() : { status: 403, body: { error: { message: 'Forbidden' } } },
    );
    restore = mock.restore;
    await expectAppError(
      new GoogleMeetProvider(CONFIG).create(INPUT),
      'MEETING_PROVIDER_ERROR',
      502,
    );
  });

  it('llave privada inválida → 502 sin llamar a Google', async () => {
    const mock = mockFetch(() => tokenOk());
    restore = mock.restore;
    const google = new GoogleMeetProvider({
      ...CONFIG,
      privateKey: '-----BEGIN PRIVATE KEY-----\nxx\n-----END PRIVATE KEY-----\n',
    });
    await expectAppError(google.create(INPUT), 'MEETING_PROVIDER_ERROR', 502);
    expect(mock.calls).toHaveLength(0);
  });

  it('getHostUrl: devuelve el mismo enlace; evento borrado/cancelado → NOT_FOUND', async () => {
    const mock = mockFetch((call) => {
      if (isToken(call)) return tokenOk();
      if (call.url.endsWith('/ok')) return { status: 200, body: event() };
      if (call.url.endsWith('/cancelled'))
        return { status: 200, body: event({ status: 'cancelled' }) };
      return { status: 404, body: { error: { message: 'Not Found' } } };
    });
    restore = mock.restore;
    const google = new GoogleMeetProvider(CONFIG);
    await expect(google.getHostUrl('ok')).resolves.toBe(LINK);
    await expectAppError(google.getHostUrl('cancelled'), 'NOT_FOUND', 404);
    await expectAppError(google.getHostUrl('missing'), 'NOT_FOUND', 404);
  });

  it('cancel: 204, 404 y 410 son éxito; 500 → 502', async () => {
    const statuses: Record<string, number> = { a: 204, b: 404, c: 410, d: 500 };
    const mock = mockFetch((call) => {
      if (isToken(call)) return tokenOk();
      const id = new URL(call.url).pathname.split('/').pop()!;
      return { status: statuses[id] };
    });
    restore = mock.restore;
    const google = new GoogleMeetProvider({ ...CONFIG, calendarId: 'agenda@escuela.org' });
    await expect(google.cancel('a')).resolves.toBeUndefined();
    expect(mock.calls[1].url).toBe(
      'https://www.googleapis.com/calendar/v3/calendars/agenda%40escuela.org/events/a?sendUpdates=none',
    );
    await expect(google.cancel('b')).resolves.toBeUndefined();
    await expect(google.cancel('c')).resolves.toBeUndefined();
    await expectAppError(google.cancel('d'), 'MEETING_PROVIDER_ERROR', 502);
  });
});
