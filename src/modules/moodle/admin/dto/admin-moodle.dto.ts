import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../../../common/dto/pagination.dto';

const toBool = Transform(({ value }: { value: unknown }) =>
  value === 'true' || value === true ? true : value === 'false' || value === false ? false : value,
);

export const MOODLE_ROSTER_MAX_EMAILS = 5000;
export const MOODLE_CODES_MAX_PER_REQUEST = 200;

export class ListRosterQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'gmail.com', description: 'Busca en el correo.' })
  @IsOptional()
  @IsString()
  @MaxLength(254)
  q?: string;

  @ApiPropertyOptional({ example: false, description: 'true = ya vinculados; false = pendientes.' })
  @IsOptional()
  @toBool
  @IsBoolean()
  linked?: boolean;
}

export class ImportRosterRequestDto {
  @ApiPropertyOptional({
    example: 'nombre,email\nAna López,ana@example.com\n',
    description:
      'Contenido de un CSV (columna `email`/`correo`, o la primera celda con @ de cada fila) o texto con un correo por línea. Envía `csv` O `emails`.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  csv?: string;

  @ApiPropertyOptional({ type: [String], example: ['ana@example.com', 'beto@example.com'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MOODLE_ROSTER_MAX_EMAILS)
  @IsString({ each: true })
  @MaxLength(254, { each: true })
  emails?: string[];
}

export class GenerateCodesRequestDto {
  @ApiProperty({ example: 10, minimum: 1, maximum: MOODLE_CODES_MAX_PER_REQUEST })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MOODLE_CODES_MAX_PER_REQUEST)
  count!: number;
}

export class ListCodesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: false, description: 'true = canjeados; false = disponibles.' })
  @IsOptional()
  @toBool
  @IsBoolean()
  used?: boolean;
}

export class MoodleUserRefDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Ana López' }) fullName!: string;
  @ApiProperty({ example: 'ana@example.com' }) email!: string;
}

export class RosterEntryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'ana@example.com' }) email!: string;
  @ApiProperty({ example: true, description: 'Ya tiene cuenta y quedó inscrita ("Vía Moodle").' })
  linked!: boolean;
  @ApiProperty({ type: MoodleUserRefDto, nullable: true }) linkedUser!: MoodleUserRefDto | null;
  @ApiProperty({ nullable: true, type: String }) linkedAt!: string | null;
  @ApiProperty() createdAt!: string;
}

export class RosterImportResultDto {
  @ApiProperty({ example: 24, description: 'Correos nuevos agregados.' }) added!: number;
  @ApiProperty({ example: 2, description: 'Repetidos (en el archivo o ya cargados).' })
  duplicates!: number;
  @ApiProperty({
    type: [String],
    example: ['correo-sin-arroba'],
    description: 'Valores que no son correos.',
  })
  invalid!: string[];
  @ApiProperty({
    example: 5,
    description: 'Personas ya registradas que quedaron vinculadas al cargar.',
  })
  linkedUsers!: number;
}

export class AccessCodeDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({
    example: '7KQ2',
    description: 'Últimos 4 caracteres (el código completo solo se ve al generarlo).',
  })
  hint!: string;
  @ApiProperty({ nullable: true, type: String }) expiresAt!: string | null;
  @ApiProperty() used!: boolean;
  @ApiProperty({ type: MoodleUserRefDto, nullable: true }) usedBy!: MoodleUserRefDto | null;
  @ApiProperty({ nullable: true, type: String }) usedAt!: string | null;
  @ApiProperty() createdAt!: string;
}

export class GeneratedCodesDto {
  @ApiProperty({
    type: [String],
    example: ['ABCD-7KQ2', 'MNPQ-23XY'],
    description:
      'Códigos en claro: se muestran UNA sola vez (solo se guarda el hash). Cópialos o descárgalos.',
  })
  codes!: string[];
  @ApiProperty({ nullable: true, type: String, description: 'Vencen al fin de la cohorte.' })
  expiresAt!: string | null;
}
