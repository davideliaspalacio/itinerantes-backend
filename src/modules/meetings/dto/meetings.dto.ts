import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { BUSINESS_RULES } from '../../../config/business-rules';
import { MEETING_PROVIDERS, type MeetingProvider } from '../../../infra/meetings/meeting-gateway';
import { IsIanaTimezone } from '../../users/dto/user-fields';

const R = BUSINESS_RULES;

export class CreateMeetingRequestDto {
  @ApiProperty({
    enum: MEETING_PROVIDERS,
    example: 'ZOOM',
    description:
      'Proveedor. Debe estar habilitado (`GET /admin/meetings/providers`). Las entrevistas (HU-31) ' +
      'solo aceptan Zoom.',
  })
  @IsIn(MEETING_PROVIDERS, { message: 'Elige Zoom o Google Meet.' })
  provider!: MeetingProvider;

  @ApiProperty({
    example: 'Diplomado Gestión del Agua — Sesión 3',
    minLength: R.MEETING_TOPIC_MIN_LENGTH,
    maxLength: R.MEETING_TOPIC_MAX_LENGTH,
    description: 'Título de la reunión (lo ven los participantes en Zoom / Google Calendar).',
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Escribe un título para la reunión.' })
  @MinLength(R.MEETING_TOPIC_MIN_LENGTH, {
    message: `El título debe tener al menos ${R.MEETING_TOPIC_MIN_LENGTH} caracteres.`,
  })
  @MaxLength(R.MEETING_TOPIC_MAX_LENGTH, {
    message: `El título no puede exceder ${R.MEETING_TOPIC_MAX_LENGTH} caracteres.`,
  })
  topic!: string;

  @ApiProperty({
    format: 'date-time',
    example: '2026-11-12T17:00:00.000Z',
    description: 'Inicio en ISO 8601 con zona (UTC `Z` u offset). Debe ser futuro.',
  })
  @IsDateString({ strict: true }, { message: 'Indica una fecha y hora válidas (ISO 8601).' })
  startAt!: string;

  @ApiProperty({
    example: 90,
    minimum: R.MEETING_DURATION_MIN_MINUTES,
    maximum: R.MEETING_DURATION_MAX_MINUTES,
    description: 'Duración en minutos.',
  })
  @IsInt({ message: 'La duración debe ser un número entero de minutos.' })
  @Min(R.MEETING_DURATION_MIN_MINUTES, {
    message: `La duración mínima es de ${R.MEETING_DURATION_MIN_MINUTES} minutos.`,
  })
  @Max(R.MEETING_DURATION_MAX_MINUTES, {
    message: `La duración máxima es de ${R.MEETING_DURATION_MAX_MINUTES} minutos.`,
  })
  durationMinutes!: number;

  @IsOptional()
  @IsIanaTimezone({ optional: true })
  timezone?: string;
}

export class MeetingDto {
  @ApiProperty({ enum: MEETING_PROVIDERS, example: 'ZOOM' })
  provider!: MeetingProvider;

  @ApiProperty({
    example: '85746065432',
    description:
      'Id de la reunión en el proveedor (Zoom: id numérico; Google: id del evento de Calendar). ' +
      'Guárdalo en el estado del formulario para pedir un enlace de anfitrión nuevo o cancelarla.',
  })
  externalId!: string;

  @ApiProperty({
    example: 'https://us02web.zoom.us/j/85746065432?pwd=abc123',
    description: 'Enlace de participantes → campo `joinUrl` de la sesión / entrevista.',
  })
  joinUrl!: string;

  @ApiProperty({
    example: 'https://us02web.zoom.us/s/85746065432?zak=eyJ0eXAiOi...',
    description:
      'Enlace de anfitrión → campo `hostUrl` de la sesión (HU-29). Zoom: `start_url`, CADUCA (≈2 h): ' +
      'para iniciar la reunión más tarde pide uno nuevo con `GET …/host-url`. Google Meet: igual a ' +
      '`joinUrl` (el anfitrión es la cuenta organizadora del evento).',
  })
  hostUrl!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'abc123',
    description: 'Contraseña de la reunión (Zoom; ya va incluida en `joinUrl`). `null` en Meet.',
  })
  password!: string | null;

  @ApiProperty({ format: 'date-time', example: '2026-11-12T17:00:00.000Z' })
  startAt!: string;

  @ApiProperty({ example: 90 })
  durationMinutes!: number;
}

export class MeetingProviderInfoDto {
  @ApiProperty({ enum: MEETING_PROVIDERS, example: 'ZOOM' })
  provider!: MeetingProvider;

  @ApiProperty({ example: 'Zoom', description: 'Texto para la UI.' })
  label!: string;

  @ApiProperty({
    example: true,
    description: '`true` si el servidor tiene credenciales: muestra el botón "Generar enlace".',
  })
  enabled!: boolean;

  @ApiProperty({
    example: true,
    description:
      'Si sirve para entrevistas de postulación (HU-31 exige un enlace de zoom.us: solo Zoom). ' +
      'Ambos sirven para sesiones en vivo (HU-29).',
  })
  usableForInterviews!: boolean;
}

export class MeetingProvidersResponseDto {
  @ApiProperty({ type: [MeetingProviderInfoDto], description: 'Todos los proveedores conocidos.' })
  data!: MeetingProviderInfoDto[];
}

export class MeetingHostUrlDto {
  @ApiProperty({ enum: MEETING_PROVIDERS, example: 'ZOOM' })
  provider!: MeetingProvider;

  @ApiProperty({ example: '85746065432' })
  externalId!: string;

  @ApiProperty({
    example: 'https://us02web.zoom.us/s/85746065432?zak=eyJ0eXAiOi...',
    description: 'Enlace de anfitrión vigente (Zoom: `start_url` recién emitido).',
  })
  hostUrl!: string;
}
