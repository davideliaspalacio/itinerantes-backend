import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { GoogleMeetProvider } from './google-meet-provider';
import { normalizePrivateKey } from './google-jwt';
import { MEETING_GATEWAY } from './meeting-gateway';
import { ProviderMeetingGateway } from './provider-meeting-gateway';
import { ZoomMeetingProvider } from './zoom-meeting-provider';

/** Construye el gateway a partir de las variables de entorno (proveedor sin variables = deshabilitado). */
export function buildMeetingGateway(config: ConfigService<Env, true>): ProviderMeetingGateway {
  const get = <K extends keyof Env>(key: K): Env[K] => config.get(key, { infer: true });

  const zoomAccountId = get('ZOOM_ACCOUNT_ID');
  const zoomClientId = get('ZOOM_CLIENT_ID');
  const zoomClientSecret = get('ZOOM_CLIENT_SECRET');
  const zoom = new ZoomMeetingProvider(
    zoomAccountId && zoomClientId && zoomClientSecret
      ? {
          accountId: zoomAccountId,
          clientId: zoomClientId,
          clientSecret: zoomClientSecret,
          hostUser: get('ZOOM_HOST_USER') ?? 'me',
        }
      : null,
  );

  const googleEmail = get('GOOGLE_MEET_SERVICE_ACCOUNT_EMAIL');
  const googleKey = get('GOOGLE_MEET_PRIVATE_KEY');
  const googleUser = get('GOOGLE_MEET_IMPERSONATE_USER');
  const google = new GoogleMeetProvider(
    googleEmail && googleKey && googleUser
      ? {
          serviceAccountEmail: googleEmail,
          privateKey: normalizePrivateKey(googleKey),
          impersonateUser: googleUser,
          calendarId: get('GOOGLE_MEET_CALENDAR_ID') ?? 'primary',
        }
      : null,
  );

  const gateway = new ProviderMeetingGateway([zoom, google]);
  new Logger('MeetingsInfraModule').log(
    `Proveedores de reuniones habilitados: ${gateway.enabledProviders().join(', ') || 'ninguno'}`,
  );
  return gateway;
}

/**
 * Proveedores de videollamadas (Zoom / Google Meet). Expone el puerto `MEETING_GATEWAY`. En pruebas:
 * `overrideProvider(MEETING_GATEWAY).useValue(new FakeMeetingGateway())`.
 */
@Global()
@Module({
  providers: [
    {
      provide: MEETING_GATEWAY,
      inject: [ConfigService],
      useFactory: buildMeetingGateway,
    },
  ],
  exports: [MEETING_GATEWAY],
})
export class MeetingsInfraModule {}
