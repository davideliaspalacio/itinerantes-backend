import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginatedResponseDto, PaginationMetaDto } from '../dto/pagination.dto';

/**
 * Documenta una respuesta paginada `{ data: Item[], meta }` con el tipo concreto del item.
 *
 * @example
 * @ApiPaginatedResponse(OfferSummaryDto)
 * list(@Query() query: ListOffersQueryDto): Promise<PaginatedResponseDto<OfferSummaryDto>> {}
 */
export function ApiPaginatedResponse<T extends Type<unknown>>(
  item: T,
  description = 'Lista paginada.',
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiExtraModels(PaginatedResponseDto, PaginationMetaDto, item),
    ApiOkResponse({
      description,
      schema: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(item) } },
          meta: { $ref: getSchemaPath(PaginationMetaDto) },
        },
      },
    }),
  );
}
