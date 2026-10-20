import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class TimezonesQueryDto {
  @ApiPropertyOptional({
    example: '2026-11-07T16:00:00.000Z',
    description:
      'Instante (ISO 8601) para calcular los offsets (horario de verano). Por defecto, ahora.',
  })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Debe ser una fecha ISO 8601 válida.' })
  at?: string;
}

export class TimezoneDto {
  @ApiProperty({ example: 'America/Bogota', description: 'Zona IANA (valor a guardar).' })
  id!: string;

  @ApiProperty({ example: 'Bogotá (Colombia)', description: 'Etiqueta para el selector.' })
  label!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'CO',
    description: 'País (ISO alpha-2) para buscar por país.',
  })
  countryCode!: string | null;

  @ApiProperty({ example: '-05:00', description: 'Offset UTC en el instante consultado.' })
  utcOffset!: string;

  @ApiProperty({ example: -300, description: 'Offset en minutos (para ordenar/calcular).' })
  offsetMinutes!: number;
}

export class ReferenceTimezoneDto {
  @ApiProperty({ example: 'America/Bogota' })
  id!: string;

  @ApiProperty({ example: 'Bogotá / Lima' })
  label!: string;

  @ApiProperty({ example: '-05:00' })
  utcOffset!: string;

  @ApiProperty({ example: -300 })
  offsetMinutes!: number;

  @ApiProperty({ example: false, description: 'true en la fila de referencia (CDMX).' })
  isOfficial!: boolean;
}

export class TimezonesResponseDto {
  @ApiProperty({
    example: 'America/Mexico_City',
    description:
      'Hora oficial de las actividades (CDMX). Todas las fechas de la API viajan en UTC.',
  })
  officialTimezone!: string;

  @ApiProperty({
    example: 'America/Mexico_City',
    description: 'Zona a usar si el navegador no permite detectarla (HU-02, HU-11).',
  })
  defaultTimezone!: string;

  @ApiProperty({ example: '2026-11-07T16:00:00.000Z', description: 'Instante usado para offsets.' })
  at!: string;

  @ApiProperty({ type: [TimezoneDto], description: 'Zonas sugeridas para el selector.' })
  zones!: TimezoneDto[];

  @ApiProperty({
    type: [ReferenceTimezoneDto],
    description: 'Tabla "Ver en otros países" (HU-11): CDMX de referencia y ciudades del público.',
  })
  referenceZones!: ReferenceTimezoneDto[];
}
