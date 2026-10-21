import type {
  DownloadUrlOptions,
  SignedUrl,
  UploadUrlOptions,
} from '../../src/infra/storage/storage.service';

/**
 * StorageService en memoria para e2e (no depende de MinIO). Simula las URLs firmadas y permite
 * "subir" un objeto con `put(key, contentType, size)` como si el navegador hubiera hecho el PUT.
 * Uso: `createTestApp({ customize: (b) => b.overrideProvider(StorageService).useValue(storage) })`.
 */
export class FakeStorage {
  readonly objects = new Map<string, { contentType: string; contentLength: number }>();
  readonly deleted: string[] = [];

  put(key: string, contentType: string, contentLength: number): void {
    this.objects.set(key, { contentType, contentLength });
  }

  head(key: string): Promise<{ contentLength?: number; contentType?: string } | null> {
    return Promise.resolve(this.objects.get(key) ?? null);
  }

  delete(key: string): Promise<void> {
    this.objects.delete(key);
    this.deleted.push(key);
    return Promise.resolve();
  }

  getDownloadUrl(key: string, options: DownloadUrlOptions = {}): Promise<SignedUrl> {
    const ttl = options.expiresInSeconds ?? 900;
    return Promise.resolve({
      url: `https://storage.test/${key}?X-Amz-Signature=fake&X-Amz-Expires=${ttl}`,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    });
  }

  getUploadUrl(key: string, options: UploadUrlOptions): Promise<SignedUrl> {
    const ttl = options.expiresInSeconds ?? 900;
    return Promise.resolve({
      url: `https://storage.test/${key}?X-Amz-Signature=fake-put&content-type=${encodeURIComponent(options.contentType)}`,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    });
  }

  getPublicUrl(keyOrUrl: string): Promise<string> {
    return Promise.resolve(
      /^https?:\/\//i.test(keyOrUrl) ? keyOrUrl : `https://public.test/${keyOrUrl}`,
    );
  }
}
