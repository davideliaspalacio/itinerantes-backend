import { ApiProperty } from '@nestjs/swagger';
import {
  NotificationCategory,
  NotificationPriority,
  NotificationType,
} from '../../../generated/prisma/client';

export class NotificationActionDto {
  @ApiProperty({ example: 'Registrar asistencia' })
  label!: string;

  @ApiProperty({
    example: '/portal/asistencia/0b6f2c1e-8d1a-4f7e-9a51-3c2d1e0f9a8b',
    description: 'Ruta RELATIVA del frontend (los correos usan FRONTEND_URL + path).',
  })
  path!: string;
}

export class NotificationDto {
  @ApiProperty({ format: 'uuid', example: '5a1f0c2e-3b4d-4e5f-8a9b-0c1d2e3f4a5b' })
  id!: string;

  @ApiProperty({ enum: NotificationType, example: 'ATTENDANCE_OPEN' })
  type!: NotificationType;

  @ApiProperty({ enum: NotificationCategory, example: 'TRAINING', description: 'Ícono / grupo.' })
  category!: NotificationCategory;

  @ApiProperty({ enum: NotificationPriority, example: 'NORMAL' })
  priority!: NotificationPriority;

  @ApiProperty({
    example: false,
    description:
      'Fijada al inicio del panel (prioridad alta sin regularizar: cobro fallido, mora).',
  })
  pinned!: boolean;

  @ApiProperty({ example: 'Registra tu asistencia' })
  title!: string;

  @ApiProperty({
    example:
      'Terminó la sesión del 7 nov de Diplomado en Ecotecnologías del Agua. El registro cierra el 8 nov, 13:00 hora CDMX.',
  })
  body!: string;

  @ApiProperty({ type: NotificationActionDto, nullable: true })
  action!: NotificationActionDto | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: { offerId: '9d3c…', sessionId: '0b6f…' },
    description: 'Ids relacionados para armar rutas propias.',
  })
  data!: Record<string, unknown> | null;

  @ApiProperty({ example: false })
  read!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: null })
  readAt!: string | null;

  @ApiProperty({ example: '2026-11-07T19:05:00.000Z' })
  createdAt!: string;
}

export class UnreadCountDto {
  @ApiProperty({ example: 3, description: 'No leídas (contador de la campana).' })
  unread!: number;

  @ApiProperty({ example: 0, description: 'Fijadas (prioridad alta sin regularizar).' })
  pinned!: number;
}

export class MarkAllReadResponseDto {
  @ApiProperty({ example: 3, description: 'Notificaciones marcadas como leídas.' })
  updated!: number;
}
