/**
 * Puerto hacia los proveedores de videollamadas (Zoom y Google Meet). El dominio
 * (`src/modules/meetings`) solo conoce esta interfaz: la implementación real es
 * `ProviderMeetingGateway` (compone `ZoomMeetingProvider` y `GoogleMeetProvider`) y las e2e usan un
 * fake (`test/utils/fake-meeting-gateway.ts`).
 *
 * Inyección: `@Inject(MEETING_GATEWAY) private readonly gateway: MeetingGateway`.
 *
 * La reunión generada NO se guarda en la BD: el panel copia `joinUrl`/`hostUrl` al formulario de la
 * sesión (HU-29) o de la entrevista (HU-31) y los envía con los endpoints que ya existen.
 */

export const MEETING_GATEWAY = Symbol('MEETING_GATEWAY');

export const MEETING_PROVIDERS = ['ZOOM', 'GOOGLE_MEET'] as const;
export type MeetingProvider = (typeof MEETING_PROVIDERS)[number];

export interface CreateMeetingInput {
  /** Título visible de la reunión. */
  topic: string;
  /** Inicio (instante UTC). */
  startAt: Date;
  durationMinutes: number;
  /** Zona IANA con la que el proveedor muestra la hora (no cambia el instante). */
  timezone: string;
}

export interface CreatedMeeting {
  provider: MeetingProvider;
  /** Id en el proveedor (Zoom: id numérico de la reunión; Google: id del evento de Calendar). */
  externalId: string;
  /** Enlace de participantes (zoom.us / meet.google.com). */
  joinUrl: string;
  /**
   * Enlace de anfitrión. Zoom: `start_url`, que CADUCA (≈2 h, lleva un token): pide uno nuevo con
   * `getHostUrl`. Google Meet: el mismo enlace de participantes (el anfitrión es la cuenta dueña
   * del evento).
   */
  hostUrl: string;
  /** Contraseña de la reunión (Zoom) o `null`. */
  password: string | null;
  startAt: Date;
  durationMinutes: number;
}

/** Un proveedor concreto (Zoom o Google Meet). */
export interface MeetingProviderClient {
  readonly provider: MeetingProvider;
  /** `true` si sus variables de entorno están configuradas. */
  readonly configured: boolean;
  create(input: CreateMeetingInput): Promise<CreatedMeeting>;
  /** Enlace de anfitrión vigente. 404 `NOT_FOUND` si la reunión ya no existe. */
  getHostUrl(externalId: string): Promise<string>;
  /** Cancela / borra la reunión. Si ya no existe, no falla. */
  cancel(externalId: string): Promise<void>;
}

export interface MeetingGateway {
  /** Proveedores habilitados (con credenciales), en el orden de `MEETING_PROVIDERS`. */
  enabledProviders(): MeetingProvider[];
  /** Lanzan 503 `MEETING_PROVIDER_NOT_CONFIGURED` si el proveedor no está habilitado. */
  create(provider: MeetingProvider, input: CreateMeetingInput): Promise<CreatedMeeting>;
  getHostUrl(provider: MeetingProvider, externalId: string): Promise<string>;
  cancel(provider: MeetingProvider, externalId: string): Promise<void>;
}
