import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import type { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { uuidOr404 } from '../../common/pipes/uuid-or-404.pipe';
import { ApiErrorResponses } from '../../common/swagger/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../../common/swagger/api-paginated-response.decorator';
import { BEARER_AUTH_NAME } from '../../config/openapi';
import { AccessUrlDto } from '../enrollments/dto/portal-shared.dto';
import { LibraryItemDto, ListLibraryQueryDto } from './dto/library.dto';
import { LibraryService } from './library.service';

@ApiTags('Biblioteca')
@ApiBearerAuth(BEARER_AUTH_NAME)
@Controller('library')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get()
  @ApiOperation({
    summary: 'Biblioteca digital',
    description:
      'HU-09 (requiere sesión): recursos publicados (PDF, artículo, libro, video, audio, recurso ' +
      'externo, material de curso) filtrados por `type` y buscador `q` (título, autor o palabra ' +
      'clave). Los recursos públicos los ve cualquier persona autenticada; los exclusivos de un ' +
      'curso solo sus inscritos. Orden: destacados y más recientes primero. `data: []` → estado ' +
      'vacío con "Limpiar filtros".',
  })
  @ApiPaginatedResponse(LibraryItemDto, 'Recursos paginados.')
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'RATE_LIMITED')
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListLibraryQueryDto,
  ): Promise<PaginatedResponseDto<LibraryItemDto>> {
    return this.library.list(user.id, query);
  }

  @Get(':id/access')
  @ApiOperation({
    summary: 'Abrir un recurso de la biblioteca',
    description:
      'HU-09: archivo → URL firmada temporal (`expiresAt`); recurso externo → su URL (abrir en ' +
      'pestaña nueva, sin perder la sesión). Oculto o exclusivo de un curso en el que no estás ' +
      'inscrito → 404 `NOT_FOUND`.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AccessUrlDto })
  @ApiErrorResponses('UNAUTHORIZED', 'NOT_FOUND', 'RESOURCE_FILE_UNAVAILABLE', 'RATE_LIMITED')
  access(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidOr404('El recurso no existe.')) id: string,
  ): Promise<AccessUrlDto> {
    return this.library.accessUrl(user.id, id);
  }
}
