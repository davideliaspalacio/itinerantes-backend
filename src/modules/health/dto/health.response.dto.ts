import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok'] })
  status!: 'ok';

  @ApiProperty({ example: '0.1.0', description: 'Versión de la API.' })
  version!: string;

  @ApiProperty({ example: 1234, description: 'Segundos desde que arrancó el proceso.' })
  uptimeSeconds!: number;

  @ApiProperty({ example: '2026-11-07T16:00:00.000Z', description: 'Hora del servidor (UTC).' })
  timestamp!: string;
}

export class ReadinessChecksDto {
  @ApiProperty({ example: 'up', enum: ['up'] })
  database!: 'up';
}

export class ReadinessResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok'] })
  status!: 'ok';

  @ApiProperty({ type: ReadinessChecksDto })
  checks!: ReadinessChecksDto;

  @ApiProperty({ example: '2026-11-07T16:00:00.000Z' })
  timestamp!: string;
}
