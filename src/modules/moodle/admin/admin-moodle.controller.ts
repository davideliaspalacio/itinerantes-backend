import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import type { PaginatedResponseDto } from '../../../common/dto/pagination.dto';
import type { AdminUser } from '../../../common/guards/permissions.guard';
import { uuidOr404 } from '../../../common/pipes/uuid-or-404.pipe';
import { ApiErrorResponses } from '../../../common/swagger/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../../../common/swagger/api-paginated-response.decorator';
import { BEARER_AUTH_NAME } from '../../../config/openapi';
import { Permission } from '../../../config/permissions';
import { AdminMoodleService } from './admin-moodle.service';
import {
  AccessCodeDto,
  GeneratedCodesDto,
  GenerateCodesRequestDto,
  ImportRosterRequestDto,
  ListCodesQueryDto,
  ListRosterQueryDto,
  RosterEntryDto,
  RosterImportResultDto,
} from './dto/admin-moodle.dto';

const OFFER_ID = uuidOr404('La oferta no existe.');
const ENTRY_ID = uuidOr404('El correo no está en la lista.');
const MOODLE_ONLY = 'Solo ofertas de origen Moodle (si no → 422 `OFFER_NOT_MOODLE`).';

@ApiTags('Admin – Moodle')
@ApiBearerAuth(BEARER_AUTH_NAME)
@Controller('admin/offers/:id/moodle')
export class AdminMoodleController {
  constructor(private readonly moodle: AdminMoodleService) {}

  @Get('roster')
  @RequirePermissions(Permission.OFFERS_READ)
  @ApiOperation({
    summary: 'Lista de correos inscritos (Moodle)',
    description: `HU-25/HU-27: correos cargados y si ya quedaron vinculados a una cuenta. ${MOODLE_ONLY} Permiso \`offers.read\`.`,
  })
  @ApiPaginatedResponse(RosterEntryDto)
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'OFFER_NOT_MOODLE',
  )
  roster(
    @Param('id', OFFER_ID) id: string,
    @Query() query: ListRosterQueryDto,
  ): Promise<PaginatedResponseDto<RosterEntryDto>> {
    return this.moodle.roster(id, query);
  }

  @Post('roster')
  @HttpCode(200)
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiOperation({
    summary: 'Importar lista de correos (CSV)',
    description:
      'HU-27 paso 4 / HU-25: envía el contenido del CSV (`csv`) o un arreglo (`emails`). Idempotente ' +
      '(sin duplicados); quienes ya tienen cuenta verificada quedan inscritos "Vía Moodle" al momento ' +
      `y reciben aviso. Devuelve agregados, duplicados, inválidos y vinculados. ${MOODLE_ONLY} Permiso \`offers.write\`.`,
  })
  @ApiOkResponse({ type: RosterImportResultDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'OFFER_NOT_MOODLE',
  )
  importRoster(
    @Param('id', OFFER_ID) id: string,
    @Body() dto: ImportRosterRequestDto,
    @CurrentUser() user: AdminUser,
  ): Promise<RosterImportResultDto> {
    return this.moodle.importRoster(id, dto, user);
  }

  @Delete('roster/:entryId')
  @HttpCode(204)
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiOperation({
    summary: 'Quitar un correo de la lista',
    description: 'Solo correos aún no vinculados (si no → 409 `CONFLICT`). Permiso `offers.write`.',
  })
  @ApiNoContentResponse()
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'OFFER_NOT_MOODLE', 'CONFLICT')
  async removeEntry(
    @Param('id', OFFER_ID) id: string,
    @Param('entryId', ENTRY_ID) entryId: string,
    @CurrentUser() user: AdminUser,
  ): Promise<void> {
    await this.moodle.removeRosterEntry(id, entryId, user);
  }

  @Get('codes')
  @RequirePermissions(Permission.OFFERS_READ)
  @ApiOperation({
    summary: 'Códigos de acceso generados',
    description: `HU-25: pista (últimos 4), vencimiento y quién lo canjeó. ${MOODLE_ONLY} Permiso \`offers.read\`.`,
  })
  @ApiPaginatedResponse(AccessCodeDto)
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'OFFER_NOT_MOODLE',
  )
  codes(
    @Param('id', OFFER_ID) id: string,
    @Query() query: ListCodesQueryDto,
  ): Promise<PaginatedResponseDto<AccessCodeDto>> {
    return this.moodle.codes(id, query);
  }

  @Post('codes')
  @RequirePermissions(Permission.OFFERS_WRITE)
  @ApiOperation({
    summary: 'Generar códigos de acceso',
    description:
      'HU-25/HU-27: 1–200 códigos XXXX-XXXX de un solo uso que vencen al fin de la cohorte. Se ' +
      `devuelven en claro UNA sola vez. ${MOODLE_ONLY} Permiso \`offers.write\`.`,
  })
  @ApiCreatedResponse({ type: GeneratedCodesDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'OFFER_NOT_MOODLE',
  )
  generate(
    @Param('id', OFFER_ID) id: string,
    @Body() dto: GenerateCodesRequestDto,
    @CurrentUser() user: AdminUser,
  ): Promise<GeneratedCodesDto> {
    return this.moodle.generateCodes(id, dto, user);
  }
}
