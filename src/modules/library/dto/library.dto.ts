import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { BUSINESS_RULES } from '../../../config/business-rules';
import { LibraryAudience, LibraryResourceType } from '../../../generated/prisma/client';

const csvArray = Transform(({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  const items = (Array.isArray(value) ? value : [value]).flatMap((v) => String(v).split(','));
  const clean = items.map((v) => v.trim()).filter(Boolean);
  return clean.length ? clean : undefined;
});

export class ListLibraryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: LibraryResourceType,
    isArray: true,
    example: ['VIDEO'],
    description: 'Chips de tipo (uno o varios).',
  })
  @IsOptional()
  @csvArray
  @IsEnum(LibraryResourceType, { each: true })
  type?: LibraryResourceType[];

  @ApiPropertyOptional({
    example: 'humedales',
    maxLength: BUSINESS_RULES.LIBRARY_SEARCH_MAX_LENGTH,
    description: 'Busca en título, autor y palabras clave (sin acentos ni mayúsculas).',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(BUSINESS_RULES.LIBRARY_SEARCH_MAX_LENGTH)
  q?: string;
}

export class LibraryOfferRefDto {
  @ApiProperty({ format: 'uuid', example: '9d3c6a1e-2b4f-4c8d-9e0a-1b2c3d4e5f60' })
  id!: string;

  @ApiProperty({ example: 'curso-humedales-construidos' })
  slug!: string;

  @ApiProperty({ example: 'Curso: Humedales construidos' })
  name!: string;
}

export class LibraryItemDto {
  @ApiProperty({ format: 'uuid', example: '6b7c8d9e-0f1a-4b2c-8d3e-4f5a6b7c8d9e' })
  id!: string;

  @ApiProperty({ example: 'Guía práctica de humedales construidos' })
  title!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Manual paso a paso para viviendas rurales.',
  })
  description!: string | null;

  @ApiProperty({ enum: LibraryResourceType, example: 'PDF' })
  type!: LibraryResourceType;

  @ApiProperty({ type: String, nullable: true, example: 'Ana Solís Ríos' })
  author!: string | null;

  @ApiProperty({ type: [String], example: ['humedales', 'saneamiento'] })
  keywords!: string[];

  @ApiProperty({ type: String, nullable: true, example: 'https://placehold.co/600x400/png' })
  thumbnailUrl!: string | null;

  @ApiProperty({
    enum: LibraryAudience,
    example: 'ALL_REGISTERED',
    description: '`OFFER_ENROLLED` = exclusivo de un curso (solo lo ves si estás inscrito).',
  })
  audience!: LibraryAudience;

  @ApiProperty({ type: LibraryOfferRefDto, nullable: true })
  offer!: LibraryOfferRefDto | null;

  @ApiProperty({
    enum: ['FILE', 'EXTERNAL_LINK'],
    nullable: true,
    example: 'FILE',
    description:
      'Ábrelo con `GET /library/{id}/access` (archivo: URL temporal; externo: pestaña nueva).',
  })
  kind!: 'FILE' | 'EXTERNAL_LINK' | null;

  @ApiProperty({ type: String, nullable: true, example: 'guia-humedales.pdf' })
  fileName!: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 2_097_152 })
  sizeBytes!: number | null;

  @ApiProperty({ example: true, description: 'Material recomendado (Dashboard).' })
  featured!: boolean;
}
