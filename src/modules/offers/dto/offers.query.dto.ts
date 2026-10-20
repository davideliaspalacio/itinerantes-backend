import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { BUSINESS_RULES } from '../../../config/business-rules';
import { OfferModality, OfferType, PublicTopic } from '../../../generated/prisma/client';
import {
  DEFAULT_CATALOG_AVAILABILITY,
  OFFER_AVAILABILITY_VALUES,
  type OfferAvailability,
} from '../policies/offer-status.policy';

/** Acepta `?x=A,B` y `?x=A&x=B` → ['A', 'B'] (sin vacíos). */
const csvArray = Transform(({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  const items = (Array.isArray(value) ? value : [value]).flatMap((v) => String(v).split(','));
  const clean = items.map((v) => v.trim()).filter(Boolean);
  return clean.length ? clean : undefined;
});

const TZ_DESCRIPTION =
  'Zona IANA del navegador (`Intl.DateTimeFormat().resolvedOptions().timeZone`). Sin sesión define ' +
  'la moneda (zona de México → MXN; resto → USD). También se acepta el header `X-Timezone`. Con ' +
  'sesión manda el país del perfil.';

export class ViewerTimezoneQueryDto {
  @ApiPropertyOptional({ example: 'America/Mexico_City', description: TZ_DESCRIPTION })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  tz?: string;
}

export class ListOffersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: OfferType,
    isArray: true,
    example: ['DIPLOMA', 'COURSE'],
    description: 'Tipo(s): `?type=DIPLOMA,COURSE` o `?type=DIPLOMA&type=COURSE`.',
  })
  @IsOptional()
  @csvArray
  @IsEnum(OfferType, { each: true })
  type?: OfferType[];

  @ApiPropertyOptional({ enum: OfferModality, example: 'ONLINE_LIVE' })
  @IsOptional()
  @IsEnum(OfferModality)
  modality?: OfferModality;

  @ApiPropertyOptional({
    enum: OFFER_AVAILABILITY_VALUES,
    isArray: true,
    example: ['ENROLLMENT_OPEN', 'UPCOMING'],
    description:
      'Estado(s) derivado(s). Por defecto `ENROLLMENT_OPEN,UPCOMING` (Inscripciones abiertas y ' +
      'Próximamente).',
  })
  @IsOptional()
  @csvArray
  @IsIn(OFFER_AVAILABILITY_VALUES, { each: true })
  status?: OfferAvailability[];

  @ApiPropertyOptional({
    type: Boolean,
    example: true,
    description: '"Con beca disponible": solo diplomados NAS con beca habilitada.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' || value === true
      ? true
      : value === 'false' || value === false
        ? false
        : value,
  )
  @IsBoolean()
  scholarship?: boolean;

  @ApiPropertyOptional({
    enum: PublicTopic,
    example: 'CONSTRUCTED_WETLANDS',
    description:
      'Temática pública (HU-34): catálogo filtrado desde la página Itinerantes del Agua.',
  })
  @IsOptional()
  @IsEnum(PublicTopic)
  topic?: PublicTopic;

  @ApiPropertyOptional({
    minLength: BUSINESS_RULES.OFFER_SEARCH_MIN_LENGTH,
    maxLength: 100,
    example: 'humedales',
    description:
      'Búsqueda por nombre de la oferta o de la persona docente (sin distinguir acentos ni ' +
      'mayúsculas). Mínimo 3 caracteres.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(BUSINESS_RULES.OFFER_SEARCH_MIN_LENGTH, {
    message: `Escribe al menos ${BUSINESS_RULES.OFFER_SEARCH_MIN_LENGTH} caracteres.`,
  })
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ example: 'America/Mexico_City', description: TZ_DESCRIPTION })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  tz?: string;

  get statuses(): readonly OfferAvailability[] {
    return this.status?.length ? this.status : DEFAULT_CATALOG_AVAILABILITY;
  }
}

export class TopicAvailabilityQueryDto {
  @ApiPropertyOptional({
    enum: PublicTopic,
    isArray: true,
    example: ['ECOTECH_WATER_DIPLOMA', 'CONSTRUCTED_WETLANDS'],
    description: 'Temáticas a consultar (`?topics=A,B`). Por defecto, las 10 de HU-34 en su orden.',
  })
  @IsOptional()
  @csvArray
  @IsEnum(PublicTopic, { each: true })
  topics?: PublicTopic[];
}
