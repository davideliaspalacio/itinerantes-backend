import { AppException } from '../../common/errors/app.exception';
import type { MeetingProviderClient } from './meeting-gateway';
import { ProviderMeetingGateway } from './provider-meeting-gateway';

const client = (provider: 'ZOOM' | 'GOOGLE_MEET', configured: boolean): MeetingProviderClient => ({
  provider,
  configured,
  create: jest.fn(),
  getHostUrl: jest.fn(() => Promise.resolve(`https://${provider}.zoom.us/s/1`)),
  cancel: jest.fn(() => Promise.resolve()),
});

describe('ProviderMeetingGateway', () => {
  it('lista solo los proveedores configurados, en orden estable', () => {
    expect(
      new ProviderMeetingGateway([
        client('GOOGLE_MEET', true),
        client('ZOOM', true),
      ]).enabledProviders(),
    ).toEqual(['ZOOM', 'GOOGLE_MEET']);
    expect(
      new ProviderMeetingGateway([
        client('ZOOM', false),
        client('GOOGLE_MEET', true),
      ]).enabledProviders(),
    ).toEqual(['GOOGLE_MEET']);
    expect(new ProviderMeetingGateway([]).enabledProviders()).toEqual([]);
  });

  it('enruta al proveedor pedido y responde 503 si no está habilitado', async () => {
    const zoom = client('ZOOM', true);
    const gateway = new ProviderMeetingGateway([zoom, client('GOOGLE_MEET', false)]);
    await gateway.cancel('ZOOM', '123');
    expect(zoom.cancel).toHaveBeenCalledWith('123');

    let error: unknown;
    try {
      await gateway.cancel('GOOGLE_MEET', 'x');
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).code).toBe('MEETING_PROVIDER_NOT_CONFIGURED');
    expect((error as AppException).getStatus()).toBe(503);
    expect((error as AppException).meta).toEqual({ provider: 'GOOGLE_MEET' });
  });
});
