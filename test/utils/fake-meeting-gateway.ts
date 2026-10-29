import { randomInt } from 'node:crypto';
import { AppException } from '../../src/common/errors/app.exception';
import type {
  CreatedMeeting,
  CreateMeetingInput,
  MeetingGateway,
  MeetingProvider,
} from '../../src/infra/meetings/meeting-gateway';

/**
 * Proveedor de reuniones en memoria para e2e (sin credenciales ni red). Genera enlaces con la forma
 * real (zoom.us / meet.google.com) para que pasen `isZoomUrl` / `isMeetingUrl`.
 *
 * Uso: `createTestApp({ customize: (b) => b.overrideProvider(MEETING_GATEWAY).useValue(gateway) })`.
 */
export class FakeMeetingGateway implements MeetingGateway {
  enabled: MeetingProvider[] = ['ZOOM', 'GOOGLE_MEET'];
  readonly meetings = new Map<string, CreatedMeeting & { topic: string; timezone: string }>();
  readonly cancelled: string[] = [];
  /** Si se asigna, la próxima llamada falla con este código (y se limpia). */
  nextError: 'MEETING_PROVIDER_ERROR' | null = null;
  /** Base aleatoria: los ids no se repiten entre corridas (la auditoría de la BD de pruebas persiste). */
  private seq = randomInt(1, 2 ** 40);

  enabledProviders(): MeetingProvider[] {
    return [...this.enabled];
  }

  create(provider: MeetingProvider, input: CreateMeetingInput): Promise<CreatedMeeting> {
    this.ensure(provider);
    const n = ++this.seq;
    const externalId = provider === 'ZOOM' ? String(80_000_000_000_000 + n) : `fakeevent${n}`;
    const joinUrl =
      provider === 'ZOOM'
        ? `https://us02web.zoom.us/j/${externalId}?pwd=fake${n}`
        : `https://meet.google.com/fak-${String(n).padStart(4, '0')}-xyz`;
    const meeting: CreatedMeeting = {
      provider,
      externalId,
      joinUrl,
      hostUrl:
        provider === 'ZOOM' ? `https://us02web.zoom.us/s/${externalId}?zak=fake${n}` : joinUrl,
      password: provider === 'ZOOM' ? `fake${n}` : null,
      startAt: input.startAt,
      durationMinutes: input.durationMinutes,
    };
    this.meetings.set(this.key(provider, externalId), {
      ...meeting,
      topic: input.topic,
      timezone: input.timezone,
    });
    return Promise.resolve(meeting);
  }

  getHostUrl(provider: MeetingProvider, externalId: string): Promise<string> {
    this.ensure(provider);
    const meeting = this.meetings.get(this.key(provider, externalId));
    if (!meeting) throw AppException.notFound('La reunión ya no existe.');
    return Promise.resolve(
      provider === 'ZOOM'
        ? `${meeting.hostUrl.split('?')[0]}?zak=fresh${++this.seq}`
        : meeting.joinUrl,
    );
  }

  cancel(provider: MeetingProvider, externalId: string): Promise<void> {
    this.ensure(provider);
    this.meetings.delete(this.key(provider, externalId));
    this.cancelled.push(this.key(provider, externalId));
    return Promise.resolve();
  }

  private ensure(provider: MeetingProvider): void {
    if (!this.enabled.includes(provider)) {
      throw new AppException('MEETING_PROVIDER_NOT_CONFIGURED', { meta: { provider } });
    }
    if (this.nextError) {
      const code = this.nextError;
      this.nextError = null;
      throw new AppException(code, { meta: { provider } });
    }
  }

  private key(provider: MeetingProvider, externalId: string): string {
    return `${provider}:${externalId}`;
  }
}
