import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { slugify } from '../../common/utils/slug';

export interface UploadInput {
  /** Clave (ruta) del objeto dentro del bucket. Genérala con `StorageService.buildKey`. */
  key: string;
  body: Buffer | Uint8Array | string | Readable;
  contentType: string;
  /** Tamaño en bytes (obligatorio si `body` es un stream). */
  contentLength?: number;
  metadata?: Record<string, string>;
}

export interface StoredObject {
  bucket: string;
  key: string;
}

export interface SignedUrlOptions {
  /** Vigencia de la URL (por defecto STORAGE_SIGNED_URL_TTL_SECONDS). */
  expiresInSeconds?: number;
}

export interface DownloadUrlOptions extends SignedUrlOptions {
  /** Si se indica, el navegador descarga el archivo con este nombre (Content-Disposition: attachment). */
  downloadFileName?: string;
}

export interface UploadUrlOptions extends SignedUrlOptions {
  /** El cliente DEBE enviar exactamente este Content-Type en el PUT. */
  contentType: string;
}

export interface SignedUrl {
  url: string;
  /** Fecha de expiración en ISO 8601 UTC. */
  expiresAt: string;
}

/**
 * Almacenamiento de archivos sobre la API S3 (MinIO en dev; Supabase Storage S3 o Cloudflare R2
 * en prod). Los archivos son privados: se comparten con URLs firmadas temporales.
 *
 * Flujos típicos:
 * - Subida directa desde el navegador: el backend valida tipo/tamaño declarados (BUSINESS_RULES.FILE_LIMITS),
 *   genera `getUploadUrl(key, { contentType })`, el frontend hace PUT, y luego confirma; el backend
 *   verifica con `head(key)` (tamaño real) antes de registrar el archivo en BD.
 * - Subida vía backend (multipart pequeño): `upload({ key, body, contentType })`.
 * - Descarga: `getDownloadUrl(key, { downloadFileName })`.
 */
@Injectable()
export class StorageService implements OnModuleDestroy {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly defaultTtl: number;

  constructor(config: ConfigService<Env, true>) {
    this.bucket = config.get('STORAGE_BUCKET', { infer: true });
    this.defaultTtl = config.get('STORAGE_SIGNED_URL_TTL_SECONDS', { infer: true });
    this.client = new S3Client({
      endpoint: config.get('STORAGE_ENDPOINT', { infer: true }),
      region: config.get('STORAGE_REGION', { infer: true }),
      forcePathStyle: config.get('STORAGE_FORCE_PATH_STYLE', { infer: true }),
      credentials: {
        accessKeyId: config.get('STORAGE_ACCESS_KEY_ID', { infer: true }),
        secretAccessKey: config.get('STORAGE_SECRET_ACCESS_KEY', { infer: true }),
      },
      // Compatibilidad con proveedores S3 no-AWS (MinIO, Supabase, R2) y URLs firmadas de PUT.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }

  get bucketName(): string {
    return this.bucket;
  }

  /**
   * Construye una clave única y legible: `<prefix>/<uuid>-<nombre-saneado>.<ext>`.
   * @example buildKey('offers/123/covers', 'Portada Diplomado.PNG') → 'offers/123/covers/2f..-portada-diplomado.png'
   */
  static buildKey(prefix: string, fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    const base = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
    const ext = lastDot > 0 ? fileName.slice(lastDot + 1).toLowerCase() : '';
    const safeBase = slugify(base).slice(0, 80) || 'archivo';
    const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
    return `${cleanPrefix}/${randomUUID()}-${safeBase}${ext ? `.${ext.replace(/[^a-z0-9]/g, '')}` : ''}`;
  }

  async upload(input: UploadInput): Promise<StoredObject> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
        Metadata: input.metadata,
      }),
    );
    return { bucket: this.bucket, key: input.key };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /** Metadatos del objeto, o `null` si no existe. */
  async head(key: string): Promise<{ contentLength?: number; contentType?: string } | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return { contentLength: result.ContentLength, contentType: result.ContentType };
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      if (status === 404 || (error as { name?: string }).name === 'NotFound') return null;
      throw error;
    }
  }

  /** URL firmada de descarga (GET). */
  async getDownloadUrl(key: string, options: DownloadUrlOptions = {}): Promise<SignedUrl> {
    const expiresIn = options.expiresInSeconds ?? this.defaultTtl;
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: options.downloadFileName
        ? `attachment; filename*=UTF-8''${encodeURIComponent(options.downloadFileName)}`
        : undefined,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn });
    return { url, expiresAt: this.expiresAt(expiresIn) };
  }

  /** URL firmada de subida (PUT directo desde el navegador). */
  async getUploadUrl(key: string, options: UploadUrlOptions): Promise<SignedUrl> {
    const expiresIn = options.expiresInSeconds ?? this.defaultTtl;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: options.contentType,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn });
    return { url, expiresAt: this.expiresAt(expiresIn) };
  }

  private expiresAt(seconds: number): string {
    return new Date(Date.now() + seconds * 1000).toISOString();
  }
}
