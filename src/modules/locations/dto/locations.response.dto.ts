import { ApiProperty } from '@nestjs/swagger';

export class CountryDto {
  @ApiProperty({ example: 'MX', description: 'ISO-3166 alpha-2.' })
  code!: string;

  @ApiProperty({ example: 'México' })
  name!: string;

  @ApiProperty({ example: '+52', description: 'Indicativo sugerido para el teléfono.' })
  phoneCode!: string;

  @ApiProperty({ example: 10, description: 'Longitud mínima del número (sin indicativo).' })
  phoneMinLength!: number;

  @ApiProperty({ example: 10, description: 'Longitud máxima del número (sin indicativo).' })
  phoneMaxLength!: number;

  @ApiProperty({
    example: true,
    description:
      'true → el estado se elige de GET /locations/countries/{code}/divisions; false → texto libre.',
  })
  hasDivisions!: boolean;

  @ApiProperty({ example: 'Estado', description: 'Etiqueta del primer nivel en la UI.' })
  divisionLabel!: string;

  @ApiProperty({ example: 'Municipio', description: 'Etiqueta del segundo nivel en la UI.' })
  municipalityLabel!: string;

  @ApiProperty({
    enum: ['MXN', 'USD'],
    example: 'MXN',
    description: 'Moneda de cobro para residentes del país (MX → MXN; resto → USD).',
  })
  currency!: 'MXN' | 'USD';
}

export class CountryListResponseDto {
  @ApiProperty({ type: [CountryDto], description: 'México y Centroamérica primero.' })
  data!: CountryDto[];
}

export class DivisionDto {
  @ApiProperty({ example: '3f6c1f0e-8a7b-4c1e-9f0a-2d8b6e4c1a7f' })
  id!: string;

  @ApiProperty({ example: '09', description: 'Clave oficial (INEGI para México).' })
  code!: string;

  @ApiProperty({ example: 'Ciudad de México' })
  name!: string;

  @ApiProperty({
    example: true,
    description:
      'true → el municipio se elige de GET /locations/divisions/{id}/municipalities; false → texto libre.',
  })
  hasMunicipalities!: boolean;
}

export class DivisionListResponseDto {
  @ApiProperty({ type: [DivisionDto] })
  data!: DivisionDto[];
}

export class MunicipalityDto {
  @ApiProperty({ example: '9b2d4c1e-5b7d-4c1e-9f0a-2d8b6e4c1a7f' })
  id!: string;

  @ApiProperty({ example: '003', description: 'Clave oficial (INEGI para México).' })
  code!: string;

  @ApiProperty({ example: 'Coyoacán' })
  name!: string;
}

export class MunicipalityListResponseDto {
  @ApiProperty({ type: [MunicipalityDto] })
  data!: MunicipalityDto[];
}
