import { AppException } from '../../common/errors/app.exception';
import {
  type CreatedMeeting,
  type CreateMeetingInput,
  MEETING_PROVIDERS,
  type MeetingGateway,
  type MeetingProvider,
  type MeetingProviderClient,
} from './meeting-gateway';

/**
 * Implementación real del puerto `MeetingGateway`: enruta cada llamada al proveedor pedido y responde
 * 503 `MEETING_PROVIDER_NOT_CONFIGURED` si ese proveedor no tiene credenciales.
 */
export class ProviderMeetingGateway implements MeetingGateway {
  private readonly clients = new Map<MeetingProvider, MeetingProviderClient>();

  constructor(clients: readonly MeetingProviderClient[]) {
    for (const client of clients) this.clients.set(client.provider, client);
  }

  enabledProviders(): MeetingProvider[] {
    return MEETING_PROVIDERS.filter((provider) => this.clients.get(provider)?.configured);
  }

  create(provider: MeetingProvider, input: CreateMeetingInput): Promise<CreatedMeeting> {
    return this.client(provider).create(input);
  }

  getHostUrl(provider: MeetingProvider, externalId: string): Promise<string> {
    return this.client(provider).getHostUrl(externalId);
  }

  cancel(provider: MeetingProvider, externalId: string): Promise<void> {
    return this.client(provider).cancel(externalId);
  }

  private client(provider: MeetingProvider): MeetingProviderClient {
    const client = this.clients.get(provider);
    if (!client?.configured) {
      throw new AppException('MEETING_PROVIDER_NOT_CONFIGURED', { meta: { provider } });
    }
    return client;
  }
}
