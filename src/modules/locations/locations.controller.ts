import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiErrorResponses } from '../../common/swagger/api-error-responses.decorator';
import { AppException } from '../../common/errors/app.exception';
import {
  CountryListResponseDto,
  DivisionListResponseDto,
  MunicipalityListResponseDto,
} from './dto/locations.response.dto';
import { TimezonesQueryDto, TimezonesResponseDto } from './dto/timezones.dto';
import { LocationsService } from './locations.service';

@ApiTags('Catálogos')
@Public()
@Controller()
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get('locations/countries')
  @ApiOperation({
    summary: 'Países',
    description:
      'HU-02 / HU-14: selector de país con México y Centroamérica primero. Incluye el indicativo ' +
      'sugerido (`phoneCode`), la longitud válida del teléfono y si el país tiene lista de ' +
      'estados (`hasDivisions`); si no, estado y municipio se capturan como texto libre.',
  })
  @ApiOkResponse({ type: CountryListResponseDto })
  @ApiErrorResponses('RATE_LIMITED')
  async countries(): Promise<CountryListResponseDto> {
    return { data: await this.locations.listCountries() };
  }

  @Get('locations/countries/:code/divisions')
  @ApiOperation({
    summary: 'Estados / departamentos de un país',
    description:
      'HU-02 / HU-14: segundo nivel de la cascada. Lista vacía si el país no tiene catálogo ' +
      '(usa texto libre). `hasMunicipalities` indica si el municipio se elige de lista.',
  })
  @ApiParam({ name: 'code', example: 'MX', description: 'ISO-3166 alpha-2.' })
  @ApiOkResponse({ type: DivisionListResponseDto })
  @ApiErrorResponses('NOT_FOUND', 'RATE_LIMITED')
  async divisions(@Param('code') code: string): Promise<DivisionListResponseDto> {
    if (!/^[A-Za-z]{2}$/.test(code))
      throw AppException.notFound('El país no existe en el catálogo.');
    return { data: await this.locations.listDivisions(code) };
  }

  @Get('locations/divisions/:id/municipalities')
  @ApiOperation({
    summary: 'Municipios de un estado',
    description:
      'HU-02 / HU-14: tercer nivel de la cascada. México: catálogo INEGI (2,478 municipios). ' +
      'Lista vacía si el estado no tiene catálogo (usa texto libre).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: MunicipalityListResponseDto })
  @ApiErrorResponses('NOT_FOUND', 'RATE_LIMITED')
  async municipalities(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () => AppException.notFound('El estado no existe en el catálogo.'),
      }),
    )
    id: string,
  ): Promise<MunicipalityListResponseDto> {
    return { data: await this.locations.listMunicipalities(id) };
  }

  @Get('timezones')
  @ApiOperation({
    summary: 'Zonas horarias',
    description:
      'HU-02 / HU-11 / HU-14: zonas IANA sugeridas (con etiqueta, país y offset actual) y la tabla ' +
      '"Ver en otros países" (CDMX, Centroamérica, Bogotá/Lima, Santiago, Buenos Aires, Madrid). ' +
      'El backend no convierte horarios: todas las fechas viajan en UTC y la hora oficial de las ' +
      'actividades es `America/Mexico_City`; el frontend convierte con `Intl`. Se acepta cualquier ' +
      'zona IANA válida aunque no esté en la lista.',
  })
  @ApiOkResponse({ type: TimezonesResponseDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'RATE_LIMITED')
  timezones(@Query() query: TimezonesQueryDto): TimezonesResponseDto {
    return this.locations.listTimezones(query.at ? new Date(query.at) : new Date());
  }
}
