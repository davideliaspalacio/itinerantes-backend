import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { BUSINESS_RULES } from '../../../../config/business-rules';
import {
  ContentVisibility,
  ModuleResourceType,
  SessionStatus,
} from '../../../../generated/prisma/client';
import { RecordingState } from '../../../live-sessions/policies/session.policy';

const HTTPS = { protocols: ['https'], require_protocol: true };
const Defined = () => ValidateIf((_o: unknown, v: unknown) => v !== undefined);

const PUBLISH_AT =
  'Publicación programada (solo a futuro). Con `visibility: PUBLISHED` el contenido aparece al llegar ' +
  'la fecha (y se notifica entonces). null = inmediata.';
const NOTIFY =
  '"Notificar a inscritos" (marcada por defecto): al quedar visible se avisa a los inscritos activos ' +
  'por portal y correo (una sola vez).';

// =================================================================================================
// Módulos
// =================================================================================================

export class CreateModuleRequestDto {
  @ApiProperty({
    example: 'Humedales construidos',
    minLength: 3,
    maxLength: 120,
    description: 'La numeración "Módulo N" es automática.',
  })
  @IsString()
  @Length(3, 120)
  title!: string;

  @ApiPropertyOptional({
    example: 'Diseño y operación de humedales…',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    type: String,
    description: 'Docente del módulo (null = docentes de la oferta).',
  })
  @IsOptional()
  @IsUUID('all')
  teacherId?: string | null;
}

export class UpdateModuleRequestDto {
  @ApiPropertyOptional({ example: 'Humedales construidos', minLength: 3, maxLength: 120 })
  @Defined()
  @IsString()
  @Length(3, 120)
  title?: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  @IsOptional()
  @IsUUID('all')
  teacherId?: string | null;

  @ApiPropertyOptional({
    enum: ContentVisibility,
    example: 'PUBLISHED',
    description: 'Oculto por defecto.',
  })
  @Defined()
  @IsEnum(ContentVisibility)
  visibility?: ContentVisibility;

  @ApiPropertyOptional({
    example: '2026-11-14T16:00:00.000Z',
    nullable: true,
    type: String,
    description: PUBLISH_AT,
  })
  @IsOptional()
  @IsDateString()
  publishAt?: string | null;

  @ApiPropertyOptional({ example: true, description: NOTIFY })
  @Defined()
  @IsBoolean()
  notifyEnrollees?: boolean;
}

export class ReorderModulesRequestDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'TODOS los módulos de la oferta en el nuevo orden.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  moduleIds!: string[];
}

export class ReorderResourcesRequestDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'TODOS los recursos del módulo en el nuevo orden.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  resourceIds!: string[];
}

// =================================================================================================
// Recursos
// =================================================================================================

export class ResourceUploadUrlRequestDto {
  @ApiProperty({ enum: ModuleResourceType, example: 'PRESENTATION' })
  @IsEnum(ModuleResourceType)
  type!: ModuleResourceType;

  @ApiProperty({ example: 'modulo-3-humedales.pdf' })
  @IsString()
  @Length(1, 255)
  fileName!: string;

  @ApiProperty({
    example: 'application/pdf',
    description:
      'Presentación: PDF/PPTX · Lecturas: PDF/DOCX/EPUB · Actividades: cualquiera de esos. Máx. 50 MB.',
  })
  @IsString()
  @MaxLength(120)
  contentType!: string;

  @ApiProperty({ example: 2_345_678 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

export class ResourceUploadUrlDto {
  @ApiProperty({ example: 'https://storage…?X-Amz-Signature=…' })
  uploadUrl!: string;

  @ApiProperty({ example: 'PUT' })
  method!: 'PUT';

  @ApiProperty({ example: { 'Content-Type': 'application/pdf' } })
  headers!: Record<string, string>;

  @ApiProperty({ example: 'offers/0f8b…/modules/7c1d…/2f1c…-modulo-3.pdf' })
  key!: string;

  @ApiProperty({ example: '2026-11-07T16:15:00.000Z' })
  expiresAt!: string;

  @ApiProperty({ example: BUSINESS_RULES.FILE_LIMITS.MODULE_RESOURCE.maxBytes })
  maxBytes!: number;
}

export class ResourceFieldsDto {
  @ApiPropertyOptional({ example: 'Presentación del módulo 3', maxLength: 200 })
  @Defined()
  @IsString()
  @Length(1, 200)
  title?: string;

  @ApiPropertyOptional({ example: 'Instrucciones: lee y responde…', nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({
    example: 'offers/0f8b…/modules/7c1d…/2f1c…-modulo-3.pdf',
    nullable: true,
    type: String,
    description:
      'Archivo subido con `…/resources/upload-url` (se verifica tipo y tamaño reales). Una sola fuente: `fileKey`, `url` o `libraryResourceId`.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fileKey?: string | null;

  @ApiPropertyOptional({
    example: 'modulo-3.pdf',
    description: 'Nombre visible del archivo (por defecto el de la key).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @ApiPropertyOptional({
    example: 'https://youtu.be/abc',
    nullable: true,
    type: String,
    description: 'Enlace externo https.',
  })
  @IsOptional()
  @IsUrl(HTTPS)
  @MaxLength(1000)
  url?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    type: String,
    description: 'Solo lecturas previas: enlaza un recurso de la Biblioteca (HU-09).',
  })
  @IsOptional()
  @IsUUID('all')
  libraryResourceId?: string | null;

  @ApiPropertyOptional({
    example: '2026-11-21T23:59:00.000Z',
    nullable: true,
    type: String,
    description: 'Solo actividades; dentro del periodo de la oferta.',
  })
  @IsOptional()
  @IsDateString()
  activityDueAt?: string | null;

  @ApiPropertyOptional({
    enum: ContentVisibility,
    example: 'HIDDEN',
    description: 'Oculto por defecto.',
  })
  @Defined()
  @IsEnum(ContentVisibility)
  visibility?: ContentVisibility;

  @ApiPropertyOptional({ nullable: true, type: String, description: PUBLISH_AT })
  @IsOptional()
  @IsDateString()
  publishAt?: string | null;

  @ApiPropertyOptional({ example: true, description: NOTIFY })
  @Defined()
  @IsBoolean()
  notifyEnrollees?: boolean;
}

export class CreateResourceRequestDto extends ResourceFieldsDto {
  @ApiProperty({
    enum: ModuleResourceType,
    example: 'PRE_READING',
    description: 'PRESENTATION: una por módulo (una nueva reemplaza a la anterior).',
  })
  @IsEnum(ModuleResourceType)
  type!: ModuleResourceType;

  @ApiProperty({ example: 'Lectura: humedales en México', maxLength: 200 })
  @IsString()
  @Length(1, 200)
  declare title: string;
}

export class UpdateResourceRequestDto extends ResourceFieldsDto {}

// =================================================================================================
// Respuestas
// =================================================================================================

export class AdminResourceFileDto {
  @ApiProperty() key!: string;
  @ApiProperty({ nullable: true, type: String }) fileName!: string | null;
  @ApiProperty({ nullable: true, type: String }) mimeType!: string | null;
  @ApiProperty({ nullable: true, type: Number }) sizeBytes!: number | null;
  @ApiProperty({ description: 'URL firmada de descarga (~10 min).' }) downloadUrl!: string;
}

export class AdminLibraryRefDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
}

export class AdminResourceDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ModuleResourceType }) type!: ModuleResourceType;
  @ApiProperty() title!: string;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty({ enum: ['FILE', 'URL', 'LIBRARY', 'NONE'] }) source!:
    'FILE' | 'URL' | 'LIBRARY' | 'NONE';
  @ApiProperty({ type: AdminResourceFileDto, nullable: true }) file!: AdminResourceFileDto | null;
  @ApiProperty({ nullable: true, type: String }) url!: string | null;
  @ApiProperty({ type: AdminLibraryRefDto, nullable: true }) library!: AdminLibraryRefDto | null;
  @ApiProperty({ nullable: true, type: String }) activityDueAt!: string | null;
  @ApiProperty() position!: number;
  @ApiProperty({ enum: ContentVisibility }) visibility!: ContentVisibility;
  @ApiProperty({ nullable: true, type: String }) publishAt!: string | null;
  @ApiProperty({
    description: 'Lo ven los inscritos ahora (publicado, fecha cumplida y módulo visible).',
  })
  visibleNow!: boolean;
  @ApiProperty() notifyEnrollees!: boolean;
  @ApiProperty({ nullable: true, type: String, description: 'Cuándo se notificó a los inscritos.' })
  notifiedAt!: string | null;
  @ApiProperty() updatedAt!: string;
}

export class AdminRecordingRowDto {
  @ApiProperty({ format: 'uuid' }) sessionId!: string;
  @ApiProperty() startsAt!: string;
  @ApiProperty() endsAt!: string;
  @ApiProperty({ enum: SessionStatus }) status!: SessionStatus;
  @ApiProperty({ nullable: true, type: String }) recordingUrl!: string | null;
  @ApiProperty({ nullable: true, type: String }) recordingPublishedAt!: string | null;
  @ApiProperty({
    enum: RecordingState,
    description: 'AVAILABLE / AFTER_SESSION / PENDING ("Grabación pendiente") / NOT_APPLICABLE.',
  })
  state!: RecordingState;
  @ApiProperty({ description: 'Sesión ya realizada sin enlace: resaltar.' }) pending!: boolean;
}

export class AdminModuleTeacherDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() fullName!: string;
}

export class AdminModuleSectionsDto {
  @ApiProperty({
    type: AdminResourceDto,
    nullable: true,
    description: 'Presentación (la más reciente).',
  })
  presentation!: AdminResourceDto | null;
  @ApiProperty({ type: [AdminResourceDto] }) preReadings!: AdminResourceDto[];
  @ApiProperty({ type: [AdminResourceDto] }) activities!: AdminResourceDto[];
  @ApiProperty({
    type: [AdminRecordingRowDto],
    description: 'Una fila por sesión del módulo (se edita en `PATCH /admin/sessions/{id}`).',
  })
  recordings!: AdminRecordingRowDto[];
}

export class AdminModuleDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 3, description: 'Número visible ("Módulo 3").' }) number!: number;
  @ApiProperty() title!: string;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty({ type: AdminModuleTeacherDto, nullable: true })
  teacher!: AdminModuleTeacherDto | null;
  @ApiProperty({ enum: ContentVisibility }) visibility!: ContentVisibility;
  @ApiProperty({ nullable: true, type: String }) publishAt!: string | null;
  @ApiProperty() visibleNow!: boolean;
  @ApiProperty() notifyEnrollees!: boolean;
  @ApiProperty({ nullable: true, type: String }) notifiedAt!: string | null;
  @ApiProperty({ type: AdminModuleSectionsDto }) sections!: AdminModuleSectionsDto;
}

export class AdminModulesDto {
  @ApiProperty({ format: 'uuid' }) offerId!: string;
  @ApiProperty() offerName!: string;
  @ApiProperty({ type: [AdminModuleDto] }) modules!: AdminModuleDto[];
  @ApiProperty({ type: [AdminRecordingRowDto], description: 'Sesiones sin módulo asignado.' })
  unassignedRecordings!: AdminRecordingRowDto[];
  @ApiProperty({ example: 18, description: 'Inscritos activos que recibirían avisos.' })
  activeEnrollees!: number;
}

export class ModuleMutationDto {
  @ApiProperty({ type: AdminModuleDto }) module!: AdminModuleDto;
  @ApiProperty({ example: 18, description: '"Se notificó a [n] inscritos" (0 si no se avisó).' })
  notifiedCount!: number;
}

export class ResourceMutationDto {
  @ApiProperty({ type: AdminResourceDto }) resource!: AdminResourceDto;
  @ApiProperty({ example: 18 }) notifiedCount!: number;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Presentación anterior reemplazada (borrada).',
  })
  replacedResourceId!: string | null;
}
