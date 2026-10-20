import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { BUSINESS_RULES } from '../../config/business-rules';

/**
 * Query de paginación: `?page=1&pageSize=20`. Extiéndela en los DTOs de listados:
 * `export class ListOffersQueryDto extends PaginationQueryDto { ... filtros ... }`.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, example: 1, description: 'Página (desde 1).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: BUSINESS_RULES.PAGINATION_MAX_PAGE_SIZE,
    default: BUSINESS_RULES.PAGINATION_DEFAULT_PAGE_SIZE,
    example: 20,
    description: 'Elementos por página.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(BUSINESS_RULES.PAGINATION_MAX_PAGE_SIZE)
  pageSize: number = BUSINESS_RULES.PAGINATION_DEFAULT_PAGE_SIZE;

  /** Para Prisma: `findMany({ skip: query.skip, take: query.take })`. */
  get skip(): number {
    return (this.page - 1) * this.pageSize;
  }

  get take(): number {
    return this.pageSize;
  }
}

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 57, description: 'Total de elementos que cumplen el filtro.' })
  total!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

/** Respuesta paginada: `{ data: T[], meta }`. Documéntala con `@ApiPaginatedResponse(ItemDto)`. */
export class PaginatedResponseDto<T> {
  data!: T[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

/** Construye la respuesta paginada estándar. */
export function paginate<T>(
  data: T[],
  total: number,
  query: Pick<PaginationQueryDto, 'page' | 'pageSize'>,
): PaginatedResponseDto<T> {
  return {
    data,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: query.pageSize > 0 ? Math.ceil(total / query.pageSize) : 0,
    },
  };
}
