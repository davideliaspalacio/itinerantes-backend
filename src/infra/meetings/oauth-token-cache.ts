import { BUSINESS_RULES } from '../../config/business-rules';

export interface FetchedToken {
  accessToken: string;
  /** Vida del token en segundos (`expires_in`). */
  expiresInSeconds: number;
}

/**
 * Caché de un token OAuth de servidor a servidor: lo reutiliza hasta poco antes de que venza
 * (`MEETING_TOKEN_REFRESH_MARGIN_SECONDS`) y comparte la petición en curso entre llamadas
 * concurrentes. El token solo vive en memoria del proceso.
 */
export class OAuthTokenCache {
  private token: { value: string; expiresAtMs: number } | null = null;
  private pending: Promise<string> | null = null;

  constructor(
    private readonly fetchToken: () => Promise<FetchedToken>,
    private readonly now: () => number = Date.now,
  ) {}

  async get(): Promise<string> {
    const marginMs = BUSINESS_RULES.MEETING_TOKEN_REFRESH_MARGIN_SECONDS * 1000;
    if (this.token && this.token.expiresAtMs - marginMs > this.now()) return this.token.value;
    if (!this.pending) {
      this.pending = this.fetchToken()
        .then(({ accessToken, expiresInSeconds }) => {
          this.token = { value: accessToken, expiresAtMs: this.now() + expiresInSeconds * 1000 };
          return accessToken;
        })
        .finally(() => {
          this.pending = null;
        });
    }
    return this.pending;
  }

  /** Olvida el token (p. ej. tras un 401: revocado o credenciales rotadas). */
  invalidate(): void {
    this.token = null;
  }
}
