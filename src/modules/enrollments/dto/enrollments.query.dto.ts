import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { OfferType } from '../../../generated/prisma/client';

const csvArray = Transform(({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  const items = (Array.isArray(value) ? value : [value]).flatMap((v) => String(v).split(','));
  const clean = items.map((v) => v.trim()).filter(Boolean);
  return clean.length ? clean : undefined;
});

export const FORMATION_PHASE_FILTERS = ['ACTIVE', 'COMPLETED', 'ALL'] as const;
export type FormationPhaseFilter = (typeof FORMATION_PHASE_FILTERS)[number];

export class ListEnrollmentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: OfferType,
    isArray: true,
    example: ['DIPLOMA'],
    description:
      'Sub-ítem del menú "Formación": `DIPLOMA` (Diplomados), `COURSE` (Cursos), `WORKSHOP` ' +
      '(Talleres). Acepta varios (`?type=EVENT,OPEN_CALL`). Sin filtro: todas.',
  })
  @IsOptional()
  @csvArray
  @IsEnum(OfferType, { each: true })
  type?: OfferType[];

  @ApiPropertyOptional({
    enum: FORMATION_PHASE_FILTERS,
    default: 'ALL',
    example: 'ACTIVE',
    description: 'Pestaña: Activos / Completados / Todos.',
  })
  @IsOptional()
  @IsIn(FORMATION_PHASE_FILTERS)
  phase: FormationPhaseFilter = 'ALL';
}

export class CreateEnrollmentRequestDto {
  @ApiProperty({
    format: 'uuid',
    example: '9d3c6a1e-2b4f-4c8d-9e0a-1b2c3d4e5f60',
    description: 'Id de la oferta (`id` del catálogo/ficha).',
  })
  @IsUUID('4', { message: 'Debe ser un identificador (UUID) válido.' })
  offerId!: string;
}
