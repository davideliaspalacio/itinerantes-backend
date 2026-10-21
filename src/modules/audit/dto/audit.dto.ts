import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ListAuditLogsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'Offer',
    description: 'Tipo de entidad (`Offer`, `Application`, `Payment`, `InstallmentPlan`, `User`…).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  entityType?: string;

  @ApiPropertyOptional({
    example: '0f8b6a52-3c1d-4b9e-9a51-6c2f4f0e7d11',
    description: 'Id de la entidad.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Integrante del equipo que hizo la acción.' })
  @IsOptional()
  @IsUUID('all')
  actorId?: string;

  @ApiPropertyOptional({
    example: 'offer.',
    description: 'Acción exacta (`offer.publish`) o prefijo (`offer.` = todas las de ofertas).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  action?: string;

  @ApiPropertyOptional({ example: '2026-11-01T00:00:00.000Z', description: 'Desde (ISO 8601).' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-11-30T23:59:59.999Z', description: 'Hasta (ISO 8601).' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class AuditActorDto {
  @ApiProperty({
    format: 'uuid',
    nullable: true,
    type: String,
    description: 'null si la cuenta se borró.',
  })
  id!: string | null;

  @ApiProperty({ example: 'coordinacion@escuelaitinerante.org' })
  email!: string;

  @ApiProperty({ example: 'Laura Coordinación', nullable: true, type: String })
  fullName!: string | null;
}

export class AuditLogDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: AuditActorDto })
  actor!: AuditActorDto;

  @ApiProperty({ example: 'offer.publish', description: 'Acción estable `dominio.verbo`.' })
  action!: string;

  @ApiProperty({ example: 'Offer' })
  entityType!: string;

  @ApiProperty({ example: '0f8b6a52-3c1d-4b9e-9a51-6c2f4f0e7d11', nullable: true, type: String })
  entityId!: string | null;

  @ApiProperty({ example: 'Publicó la oferta «Diplomado en Ecotecnologías del Agua».' })
  summary!: string;

  @ApiProperty({
    nullable: true,
    type: 'object',
    additionalProperties: true,
    example: { before: { publicationStatus: 'DRAFT' }, after: { publicationStatus: 'PUBLISHED' } },
    description:
      '`{ before, after }` solo con los campos que cambiaron (textos largos recortados).',
  })
  changes!: { before?: Record<string, unknown>; after?: Record<string, unknown> } | null;

  @ApiProperty({ example: '2026-11-07T16:00:00.000Z' })
  createdAt!: string;
}
