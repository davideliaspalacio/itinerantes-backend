import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { BUSINESS_RULES } from '../../../config/business-rules';
import {
  EnrollmentOrigin,
  EnrollmentStatus,
  ModuleResourceType,
} from '../../../generated/prisma/client';
import {
  PortalOfferRefDto,
  PortalVenueDto,
  ProgressDto,
} from '../../enrollments/dto/portal-shared.dto';
import { SessionCardDto } from '../../live-sessions/dto/sessions.dto';
import { RecordingState } from '../../live-sessions/policies/session.policy';
import { FinalProjectSubmissionState, ModuleStatus } from '../policies/classroom.policy';

const DATE = { type: String, format: 'date-time' } as const;
const OPTIONAL_DATE = { ...DATE, nullable: true } as const;

export class ClassroomEnrollmentDto {
  @ApiProperty({ format: 'uuid', example: '1f2e3d4c-5b6a-4798-8a7b-6c5d4e3f2a1b' })
  id!: string;

  @ApiProperty({ enum: EnrollmentStatus, example: 'ACTIVE' })
  status!: EnrollmentStatus;

  @ApiProperty({ enum: ['ACTIVE', 'COMPLETED'], example: 'ACTIVE' })
  phase!: 'ACTIVE' | 'COMPLETED';

  @ApiProperty({ enum: EnrollmentOrigin, example: 'NAS', description: '`MOODLE` → "Vía Moodle".' })
  origin!: EnrollmentOrigin;

  @ApiProperty({ ...DATE, example: '2026-10-20T18:00:00.000Z' })
  enrolledAt!: string;
}

export class ClassroomTeacherDto {
  @ApiProperty({ example: 'Ana Solís Ríos' })
  fullName!: string;

  @ApiProperty({ type: String, nullable: true, example: 'https://placehold.co/400x400/png' })
  photoUrl!: string | null;
}

export class ClassroomOfferDto extends PortalOfferRefDto {
  @ApiProperty({ type: String, nullable: true, example: 'https://placehold.co/1200x630/png' })
  coverImageUrl!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Generación 2026–2027' })
  cohortLabel!: string | null;

  @ApiProperty({ ...OPTIONAL_DATE, example: '2026-11-07T16:00:00.000Z' })
  startsAt!: string | null;

  @ApiProperty({ ...OPTIONAL_DATE, example: '2027-01-31T19:00:00.000Z' })
  endsAt!: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 60 })
  totalHours!: number | null;

  @ApiProperty({ type: PortalVenueDto, nullable: true, description: 'Presencial: "Cómo llegar".' })
  venue!: PortalVenueDto | null;

  @ApiProperty({ type: [ClassroomTeacherDto] })
  teachers!: ClassroomTeacherDto[];
}

export class WhatsappGroupDto {
  @ApiProperty({ example: true, description: '[Unirme al grupo de WhatsApp] (pestaña nueva).' })
  available!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'https://chat.whatsapp.com/AbCdEf',
    description: 'Solo inscritos y desde la fecha que definió el equipo.',
  })
  url!: string | null;

  @ApiProperty({
    ...OPTIONAL_DATE,
    example: null,
    description: 'Configurado pero aún no visible: "Disponible a partir del …".',
  })
  availableFrom!: string | null;
}

export class ClassroomWelcomeDto {
  @ApiProperty({
    example: true,
    description:
      '`true` antes de la primera sesión → bloque "Antes de empezar" destacado; después, bloque ' +
      'secundario "Grupo de WhatsApp".',
  })
  preStart!: boolean;

  @ApiProperty({ type: String, nullable: true, example: '¡Bienvenida! Antes de la primera clase…' })
  message!: string | null;

  @ApiProperty({ ...OPTIONAL_DATE, example: '2026-11-07T16:00:00.000Z' })
  firstSessionStartsAt!: string | null;

  @ApiProperty({ type: WhatsappGroupDto })
  whatsapp!: WhatsappGroupDto;
}

export class ModuleResourceCountsDto {
  @ApiProperty({ example: 1 })
  presentation!: number;

  @ApiProperty({ example: 2 })
  preReadings!: number;

  @ApiProperty({ example: 1 })
  activities!: number;

  @ApiProperty({ example: 2, description: 'Grabaciones ya cargadas.' })
  recordings!: number;
}

export class ClassroomModuleDto {
  @ApiProperty({ format: 'uuid', example: '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f' })
  id!: string;

  @ApiProperty({ example: 1, description: '"Módulo N" (orden del temario).' })
  number!: number;

  @ApiProperty({ example: 'Introducción a las ecotecnologías del agua' })
  title!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Objetivos y contenidos del módulo.' })
  description!: string | null;

  @ApiProperty({
    enum: Object.values(ModuleStatus),
    example: 'UPCOMING',
    description: 'Próximo / En curso / Completado.',
  })
  status!: ModuleStatus;

  @ApiProperty({ type: [String], example: ['Ana Solís Ríos'] })
  teacherNames!: string[];

  @ApiProperty({ type: ModuleResourceCountsDto })
  resourceCounts!: ModuleResourceCountsDto;
}

export class FinalProjectSubmissionDto {
  @ApiProperty({ example: 'proyecto-final.pdf' })
  fileName!: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType!: string;

  @ApiProperty({ example: 2_400_000 })
  sizeBytes!: number;

  @ApiProperty({ ...DATE, example: '2027-02-20T18:00:00.000Z' })
  submittedAt!: string;
}

export class FinalProjectDto {
  @ApiProperty({
    ...OPTIONAL_DATE,
    example: '2027-02-27T16:00:00.000Z',
    description: 'Fecha de presentación/entrega.',
  })
  dueAt!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Presenta un diseño de ecotecnología para tu territorio…',
  })
  guidelines!: string | null;

  @ApiProperty({
    enum: Object.values(FinalProjectSubmissionState),
    example: 'OPEN',
    description:
      '`DISABLED`: solo presentación en vivo (sin carga); `OPEN`: se puede subir/reemplazar; ' +
      '`CLOSED`: pasó la fecha límite (solo lectura).',
  })
  submissionState!: FinalProjectSubmissionState;

  @ApiProperty({
    example: BUSINESS_RULES.FILE_LIMITS.FINAL_PROJECT.mimeTypes,
    description: 'PDF, DOCX, PPTX o ZIP.',
  })
  acceptedMimeTypes!: string[];

  @ApiProperty({
    example: BUSINESS_RULES.FILE_LIMITS.FINAL_PROJECT.maxBytes,
    description: '20 MB.',
  })
  maxBytes!: number;

  @ApiProperty({ type: FinalProjectSubmissionDto, nullable: true })
  submission!: FinalProjectSubmissionDto | null;
}

/** Aula (HU-17). */
export class ClassroomDto {
  @ApiProperty({ type: ClassroomEnrollmentDto })
  enrollment!: ClassroomEnrollmentDto;

  @ApiProperty({ type: ClassroomOfferDto })
  offer!: ClassroomOfferDto;

  @ApiProperty({ type: ProgressDto, description: 'Sesiones con asistencia ÷ programadas.' })
  progress!: ProgressDto;

  @ApiProperty({ type: ClassroomWelcomeDto })
  welcome!: ClassroomWelcomeDto;

  @ApiProperty({
    type: SessionCardDto,
    nullable: true,
    description: 'Próxima sesión (en curso o futura, no cancelada); null si no hay.',
  })
  nextSession!: SessionCardDto | null;

  @ApiProperty({ type: [ClassroomModuleDto], description: 'Módulos publicados, en orden.' })
  modules!: ClassroomModuleDto[];

  @ApiProperty({
    type: FinalProjectDto,
    nullable: true,
    description: 'Solo diplomados (en cursos y talleres es null y la sección no aparece).',
  })
  finalProject!: FinalProjectDto | null;
}

// --- Materiales (HU-08) ---------------------------------------------------------------------------

export class MaterialResourceDto {
  @ApiProperty({ format: 'uuid', example: '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a6b' })
  id!: string;

  @ApiProperty({ enum: ModuleResourceType, example: 'PRE_READING' })
  type!: ModuleResourceType;

  @ApiProperty({ example: 'Lectura: humedales construidos para viviendas' })
  title!: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  description!: string | null;

  @ApiProperty({
    enum: ['FILE', 'EXTERNAL_LINK'],
    nullable: true,
    example: 'FILE',
    description:
      '`FILE` → [Descargar]: pide la URL temporal a `…/resources/{id}/access`. `EXTERNAL_LINK` → ' +
      '[Ver] abre `url` en pestaña nueva.',
  })
  kind!: 'FILE' | 'EXTERNAL_LINK' | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'Solo enlaces externos.',
  })
  url!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'lectura-humedales.pdf' })
  fileName!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'application/pdf' })
  mimeType!: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 1_048_576 })
  sizeBytes!: number | null;

  @ApiProperty({
    ...OPTIONAL_DATE,
    example: null,
    description: 'Actividades: fecha (aparece en el calendario como "Fecha importante").',
  })
  activityDueAt!: string | null;
}

export class MaterialRecordingDto {
  @ApiProperty({ format: 'uuid', example: '0b6f2c1e-8d1a-4f7e-9a51-3c2d1e0f9a8b' })
  sessionId!: string;

  @ApiProperty({
    ...DATE,
    example: '2026-11-07T16:00:00.000Z',
    description: '"Ver grabación" con fecha.',
  })
  startsAt!: string;

  @ApiProperty({ ...DATE, example: '2026-11-07T19:00:00.000Z' })
  endsAt!: string;

  @ApiProperty({ enum: Object.values(RecordingState), example: 'AVAILABLE' })
  state!: RecordingState;

  @ApiProperty({ type: String, nullable: true, example: 'https://zoom.us/rec/share/abc' })
  url!: string | null;
}

export class MaterialModuleDto {
  @ApiProperty({ format: 'uuid', example: '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f' })
  id!: string;

  @ApiProperty({ example: 1 })
  number!: number;

  @ApiProperty({ example: 'Introducción a las ecotecnologías del agua' })
  title!: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  description!: string | null;

  @ApiProperty({ enum: Object.values(ModuleStatus), example: 'IN_PROGRESS' })
  status!: ModuleStatus;

  @ApiProperty({ type: [String], example: ['Ana Solís Ríos'] })
  teacherNames!: string[];

  @ApiProperty({
    type: MaterialResourceDto,
    nullable: true,
    description: '1. Presentación del módulo (la más reciente).',
  })
  presentation!: MaterialResourceDto | null;

  @ApiProperty({ type: [MaterialResourceDto], description: '2. Lecturas previas.' })
  preReadings!: MaterialResourceDto[];

  @ApiProperty({ type: [MaterialResourceDto], description: '3. Actividades.' })
  activities!: MaterialResourceDto[];

  @ApiProperty({
    type: [MaterialRecordingDto],
    description: '4. Grabación de la sesión: una por sesión del módulo (sin canceladas).',
  })
  recordings!: MaterialRecordingDto[];
}

export class MaterialsDto {
  @ApiProperty({ type: [MaterialModuleDto] })
  modules!: MaterialModuleDto[];
}

// --- Proyecto final: carga ------------------------------------------------------------------------

export class FinalProjectUploadRequestDto {
  @ApiProperty({ example: 'proyecto-final.pdf', maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({
    example: 'application/pdf',
    enum: BUSINESS_RULES.FILE_LIMITS.FINAL_PROJECT.mimeTypes,
    description: 'Content-Type exacto que enviarás en el PUT.',
  })
  @IsString()
  @Matches(/^[\w.+-]+\/[\w.+-]+$/, { message: 'Tipo de archivo no válido.' })
  contentType!: string;

  @ApiProperty({ example: 2_400_000, description: 'Tamaño en bytes (máx. 20 MB).' })
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

export class UploadUrlDto {
  @ApiProperty({
    example: 'https://storage.example.com/eia-prod/final-projects/…?X-Amz-Signature=…',
  })
  uploadUrl!: string;

  @ApiProperty({ example: 'PUT', enum: ['PUT'] })
  method!: 'PUT';

  @ApiProperty({
    example: { 'Content-Type': 'application/pdf' },
    description: 'Headers obligatorios del PUT.',
  })
  headers!: Record<string, string>;

  @ApiProperty({
    example: 'final-projects/9d3c…/5a1f…/2f0e…-proyecto-final.pdf',
    description: 'Envíala a `PUT …/final-project` para confirmar la entrega.',
  })
  key!: string;

  @ApiProperty({ ...DATE, example: '2027-02-20T18:15:00.000Z' })
  expiresAt!: string;
}

export class ConfirmFinalProjectRequestDto {
  @ApiProperty({ example: 'final-projects/9d3c…/5a1f…/2f0e…-proyecto-final.pdf' })
  @IsString()
  @MaxLength(500)
  key!: string;

  @ApiPropertyOptional({ example: 'proyecto-final.pdf', description: 'Nombre a mostrar.' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;
}
