import { ApiProperty } from '@nestjs/swagger';
import { OfferModality, OfferType } from '../../../generated/prisma/client';

/** Referencia corta a la oferta de una inscripción/sesión/evento (portal). */
export class PortalOfferRefDto {
  @ApiProperty({ format: 'uuid', example: '9d3c6a1e-2b4f-4c8d-9e0a-1b2c3d4e5f60' })
  id!: string;

  @ApiProperty({
    example: 'diplomado-en-ecotecnologias-del-agua',
    description: 'Para "Ver ficha".',
  })
  slug!: string;

  @ApiProperty({ example: 'Diplomado en Ecotecnologías del Agua' })
  name!: string;

  @ApiProperty({ enum: OfferType, example: 'DIPLOMA' })
  type!: OfferType;

  @ApiProperty({ enum: OfferModality, example: 'ONLINE_LIVE' })
  modality!: OfferModality;
}

/** Sede de una actividad presencial (hora local del lugar, sin conversión: HU-11). */
export class PortalVenueDto {
  @ApiProperty({ example: 'Centro Comunitario Tepoztlán' })
  name!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Av. del Tepozteco 12' })
  address!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Tepoztlán, Morelos' })
  city!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'https://maps.google.com/?q=Tepoztlan',
    description: '"Cómo llegar".',
  })
  mapsUrl!: string | null;
}

export class ProgressDto {
  @ApiProperty({ example: 4, description: 'Sesiones con asistencia registrada.' })
  attendedSessions!: number;

  @ApiProperty({ example: 20, description: 'Sesiones programadas (sin canceladas).' })
  scheduledSessions!: number;

  @ApiProperty({ example: 20, description: 'Entero 0–100: asistidas ÷ programadas.' })
  percent!: number;
}

/** URL firmada temporal o enlace externo (abrir en pestaña nueva). */
export class AccessUrlDto {
  @ApiProperty({ enum: ['FILE', 'EXTERNAL_LINK'], example: 'FILE' })
  kind!: 'FILE' | 'EXTERNAL_LINK';

  @ApiProperty({ example: 'https://storage.example.com/eia-prod/offers/…?X-Amz-Signature=…' })
  url!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-11-07T16:10:00.000Z',
    description:
      'Vencimiento de la URL firmada (null para enlaces externos). Al vencer, pide otra.',
  })
  expiresAt!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Presentacion-modulo-1.pdf' })
  fileName!: string | null;
}
