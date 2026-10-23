import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { BUSINESS_RULES } from '../../config/business-rules';
import { ScholarshipTypesResponseDto } from './dto/scholarship-types.dto';
import { ScholarshipTypesService } from './scholarship-types.service';

@ApiTags('Becas')
@Public()
@Controller('scholarship-types')
export class ScholarshipTypesController {
  constructor(private readonly types: ScholarshipTypesService) {}

  @Get()
  @Header('Cache-Control', `public, max-age=${BUSINESS_RULES.SCHOLARSHIP_TYPES_CACHE_SECONDS}`)
  @ApiOperation({
    summary: 'Tipos de beca vigentes',
    description:
      'HU-15/16/19. Público, sin token. Tipos de beca ACTIVOS (nombre, rango de %, si requiere ' +
      'entrevista) ordenados. Los administra un SUPER_ADMIN en `/admin/scholarship-types`. Cada ' +
      'oferta habilita un subconjunto y puede ajustar el rango: para mostrar lo de una oferta usa ' +
      '`scholarshipDetails.scholarshipTypes` de la ficha. Caché de 5 minutos.',
  })
  @ApiOkResponse({ type: ScholarshipTypesResponseDto })
  list(): Promise<ScholarshipTypesResponseDto> {
    return this.types.listPublic();
  }
}
