import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { IsFullName, IsIanaTimezone, LocationInputDto, PhoneDto } from './user-fields';

/**
 * HU-14 "Datos personales". Todos los campos son opcionales (PATCH). Username y correo NO se
 * aceptan (no editables). Si envías `location`, envíala completa (país + estado + municipio).
 */
export class UpdateProfileRequestDto {
  @IsOptional()
  @IsFullName({ optional: true })
  fullName?: string;

  @ApiPropertyOptional({ type: PhoneDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PhoneDto)
  phone?: PhoneDto;

  @ApiPropertyOptional({ type: LocationInputDto, description: 'Ubicación completa.' })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationInputDto)
  location?: LocationInputDto;

  @IsOptional()
  @IsIanaTimezone({ optional: true })
  timezone?: string;
}

/** HU-11 "Usar siempre esta zona" / HU-14 pestaña "Zona horaria". */
export class UpdateTimezoneRequestDto {
  @IsIanaTimezone()
  timezone!: string;
}
