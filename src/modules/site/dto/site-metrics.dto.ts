import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class SiteMetricDto {
  @ApiProperty({
    example: 'PEOPLE_TRAINED',
    description:
      'Clave estable. Iniciales: WATER_LITERS_REVITALIZED, PEOPLE_TRAINED, TERRITORIES_ACCOMPANIED, YOUTH_TRAINED.',
  })
  key!: string;

  @ApiProperty({ example: 'Personas formadas' })
  label!: string;

  @ApiProperty({ example: 1800, description: 'Número crudo (el frontend lo formatea/anima).' })
  value!: number;

  @ApiProperty({ example: '', description: 'Texto antes del número (p. ej. "+").' })
  prefix!: string;

  @ApiProperty({ example: '+', description: 'Texto después del número (p. ej. "+" o " L").' })
  suffix!: string;

  @ApiProperty({
    example: '1,800+',
    description: 'Listo para mostrar: prefijo + número con separador de miles + sufijo.',
  })
  display!: string;

  @ApiProperty({ example: 1 })
  sortOrder!: number;
}

export class SiteMetricsResponseDto {
  @ApiProperty({
    type: [SiteMetricDto],
    description: 'Solo las visibles, ordenadas por sortOrder.',
  })
  data!: SiteMetricDto[];

  @ApiProperty({ example: '2026-10-21T20:00:00.000Z', nullable: true, type: String })
  updatedAt!: string | null;
}

export class AdminSiteMetricDto extends SiteMetricDto {
  @ApiProperty({ example: true })
  visible!: boolean;

  @ApiProperty({ example: '2026-10-21T20:00:00.000Z' })
  updatedAt!: string;
}

export class UpdateSiteMetricRequestDto {
  @ApiPropertyOptional({ example: 'Personas formadas' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional({ example: 1950, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  value?: number;

  @ApiPropertyOptional({ example: '' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  prefix?: string;

  @ApiPropertyOptional({ example: '+' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  suffix?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ example: true, description: 'false = no se muestra en la landing.' })
  @IsOptional()
  @IsBoolean()
  visible?: boolean;
}
