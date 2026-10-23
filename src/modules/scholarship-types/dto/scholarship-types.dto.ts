import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BUSINESS_RULES } from '../../../config/business-rules';
import { SCHOLARSHIP_TYPE_KEY_PATTERN } from '../policies/scholarship-type.policy';

const R = BUSINESS_RULES;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const PERCENT = {
  minimum: R.SCHOLARSHIP_TYPE_PERCENT_FLOOR,
  maximum: R.SCHOLARSHIP_TYPE_PERCENT_CEILING,
} as const;

/**
 * Resumen de un tipo de beca: acompaña a cualquier `scholarshipTypeId` en las respuestas
 * (postulación, evaluación, pago...). En ofertas, `minPercent`/`maxPercent` son el rango EFECTIVO
 * de esa oferta.
 */
export class ScholarshipTypeSummaryDto {
  @ApiProperty({ format: 'uuid', example: '0b9a3c52-5f3e-4c1b-9d8e-1c2f3a4b5c6d' })
  id!: string;

  @ApiProperty({ example: 'AGUAS_LIBRES', description: 'Clave estable (no cambia).' })
  key!: string;

  @ApiProperty({ example: 'Aguas Libres', description: 'Texto a mostrar (editable en el panel).' })
  name!: string;

  @ApiProperty({ example: 50 })
  minPercent!: number;

  @ApiProperty({ example: 50, description: 'Igual a minPercent si el porcentaje es fijo.' })
  maxPercent!: number;

  @ApiProperty({ example: false, description: 'La postulación requiere entrevista por Zoom.' })
  requiresInterview!: boolean;
}

/** Tipo de beca activo del catálogo público (`GET /scholarship-types`). */
export class ScholarshipTypeDto extends ScholarshipTypeSummaryDto {
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Para personas que ya acompañan procesos comunitarios del agua.',
  })
  description!: string | null;

  @ApiProperty({ example: 3, description: 'Orden de presentación (menor primero).' })
  sortOrder!: number;
}

export class ScholarshipTypesResponseDto {
  @ApiProperty({ type: [ScholarshipTypeDto], description: 'Solo los activos, ordenados.' })
  data!: ScholarshipTypeDto[];
}

export class ScholarshipTypeUsageDto {
  @ApiProperty({ example: 2, description: 'Ofertas que lo habilitan.' })
  offers!: number;

  @ApiProperty({
    example: 14,
    description: 'Postulaciones que lo solicitaron o lo tienen asignado.',
  })
  applications!: number;

  @ApiProperty({ example: 3, description: 'Evaluaciones del comité que lo sugieren.' })
  evaluations!: number;
}

export class AdminScholarshipTypeDto extends ScholarshipTypeDto {
  @ApiProperty({
    example: true,
    description: 'Desactivado = no se ofrece en ofertas ni postulaciones nuevas.',
  })
  active!: boolean;

  @ApiProperty({
    type: ScholarshipTypeUsageDto,
    description: 'Uso actual. Solo se puede borrar si todo es 0 (si no, desactívalo).',
  })
  usage!: ScholarshipTypeUsageDto;

  @ApiProperty({ example: '2026-10-23T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-10-23T12:00:00.000Z' })
  updatedAt!: string;
}

export class AdminScholarshipTypesResponseDto {
  @ApiProperty({
    type: [AdminScholarshipTypeDto],
    description: 'Todos (incluye inactivos), ordenados.',
  })
  data!: AdminScholarshipTypeDto[];
}

export class UpdateScholarshipTypeRequestDto {
  @ApiPropertyOptional({ example: 'Aguas Libres', maxLength: R.SCHOLARSHIP_TYPE_NAME_MAX_LENGTH })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(R.SCHOLARSHIP_TYPE_NAME_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Para personas que ya acompañan procesos comunitarios del agua.',
    maxLength: R.SCHOLARSHIP_TYPE_DESCRIPTION_MAX_LENGTH,
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(R.SCHOLARSHIP_TYPE_DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @ApiPropertyOptional({ example: 50, ...PERCENT })
  @IsOptional()
  @IsInt()
  @Min(R.SCHOLARSHIP_TYPE_PERCENT_FLOOR)
  @Max(R.SCHOLARSHIP_TYPE_PERCENT_CEILING)
  minPercent?: number;

  @ApiPropertyOptional({ example: 50, ...PERCENT, description: 'Igual a minPercent = % fijo.' })
  @IsOptional()
  @IsInt()
  @Min(R.SCHOLARSHIP_TYPE_PERCENT_FLOOR)
  @Max(R.SCHOLARSHIP_TYPE_PERCENT_CEILING)
  maxPercent?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  requiresInterview?: boolean;

  @ApiPropertyOptional({
    example: true,
    description:
      'false = deja de ofrecerse en ofertas y postulaciones nuevas (lo asignado se conserva).',
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateScholarshipTypeRequestDto {
  @ApiProperty({
    example: 'MANANTIALES',
    maxLength: R.SCHOLARSHIP_TYPE_KEY_MAX_LENGTH,
    description: 'MAYÚSCULAS_CON_GUION_BAJO, única. No se puede cambiar después.',
  })
  @Transform(trim)
  @IsString()
  @MaxLength(R.SCHOLARSHIP_TYPE_KEY_MAX_LENGTH)
  @Matches(SCHOLARSHIP_TYPE_KEY_PATTERN, {
    message: 'Usa MAYÚSCULAS, dígitos y guiones bajos (p. ej. AGUAS_LIBRES).',
  })
  key!: string;

  @ApiProperty({ example: 'Manantiales', maxLength: R.SCHOLARSHIP_TYPE_NAME_MAX_LENGTH })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(R.SCHOLARSHIP_TYPE_NAME_MAX_LENGTH)
  name!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: R.SCHOLARSHIP_TYPE_DESCRIPTION_MAX_LENGTH,
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(R.SCHOLARSHIP_TYPE_DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @ApiProperty({ example: 30, ...PERCENT })
  @IsInt()
  @Min(R.SCHOLARSHIP_TYPE_PERCENT_FLOOR)
  @Max(R.SCHOLARSHIP_TYPE_PERCENT_CEILING)
  minPercent!: number;

  @ApiProperty({ example: 40, ...PERCENT, description: 'Igual a minPercent = % fijo.' })
  @IsInt()
  @Min(R.SCHOLARSHIP_TYPE_PERCENT_FLOOR)
  @Max(R.SCHOLARSHIP_TYPE_PERCENT_CEILING)
  maxPercent!: number;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  requiresInterview?: boolean;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ example: 6, description: 'Por defecto, al final.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
