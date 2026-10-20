import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ERROR_CODES } from '../errors/error-codes';

export class ErrorDetailDto {
  @ApiProperty({ example: 'email', description: 'Campo afectado (ruta con puntos si es anidado).' })
  field!: string;

  @ApiProperty({ example: 'IS_EMAIL', description: 'Código estable del error de campo.' })
  code!: string;

  @ApiProperty({ example: 'Debe ser un correo electrónico válido.' })
  message!: string;
}

/** Formato de error único de toda la API. */
export class ErrorResponseDto {
  @ApiProperty({ example: 400, description: 'Status HTTP (repetido en el cuerpo).' })
  statusCode!: number;

  @ApiProperty({
    example: 'VALIDATION_ERROR',
    description:
      'Código estable para decidir qué mostrar en el frontend. Catálogo en docs/frontend/errores.md.',
    enum: Object.keys(ERROR_CODES),
  })
  code!: string;

  @ApiProperty({
    example: 'Los datos enviados no son válidos.',
    description: 'Mensaje en español.',
  })
  message!: string;

  @ApiPropertyOptional({
    type: [ErrorDetailDto],
    description: 'Errores por campo (validación, duplicados). Ausente si no aplica.',
  })
  details?: ErrorDetailDto[];

  @ApiProperty({
    example: '3f1c2a9e-5b7d-4c1e-9f0a-2d8b6e4c1a7f',
    description:
      'Identificador de la petición (header `X-Request-Id`). Inclúyelo al reportar errores.',
  })
  requestId!: string;
}
