import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination.dto';
import { ALL_PERMISSIONS, Permission } from '../../../../config/permissions';
import { Role, UserStatus } from '../../../../generated/prisma/client';

const ROLES = Object.values(Role);

/** Textos de los roles en el panel (tabla enum → texto de la guía de la Fase 06). */
export const ROLE_LABELS: Record<Role, string> = {
  PARTICIPANT: 'Participante',
  SUPER_ADMIN: 'Superadministración',
  ACADEMIC_COORDINATOR: 'Coordinación académica',
  REVIEW_COMMITTEE: 'Comité de revisión',
  REVIEW_DECIDER: 'Comité de revisión (con decisión)',
  FOLLOW_UP: 'Seguimiento de inscripciones',
  FINANCE: 'Administración y finanzas',
};

export class AdminMeUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'coordinacion@escuelaitinerante.org' })
  email!: string;

  @ApiProperty({ example: 'Laura Coordinación' })
  fullName!: string;
}

export class AdminMeDto {
  @ApiProperty({ type: AdminMeUserDto })
  user!: AdminMeUserDto;

  @ApiProperty({ enum: Role, isArray: true, example: ['PARTICIPANT', 'ACADEMIC_COORDINATOR'] })
  roles!: Role[];

  @ApiProperty({
    enum: ALL_PERMISSIONS,
    isArray: true,
    example: ['admin.access', 'offers.read', 'offers.write', 'offers.publish'],
    description:
      'Permisos efectivos (unión de los roles). El frontend muestra u oculta secciones y botones con ' +
      'esto; la API valida igual en cada endpoint (403 `FORBIDDEN`).',
  })
  permissions!: Permission[];
}

export class RoleDefinitionDto {
  @ApiProperty({ enum: Role, example: 'FINANCE' })
  role!: Role;

  @ApiProperty({ example: 'Administración y finanzas' })
  label!: string;

  @ApiProperty({ enum: ALL_PERMISSIONS, isArray: true, example: ['admin.access', 'payments.read'] })
  permissions!: Permission[];
}

export class RolesCatalogDto {
  @ApiProperty({ type: RoleDefinitionDto, isArray: true })
  data!: RoleDefinitionDto[];
}

export const ADMIN_USER_SORTS = ['NAME_ASC', 'CREATED_DESC', 'LAST_LOGIN_DESC'] as const;
export type AdminUserSort = (typeof ADMIN_USER_SORTS)[number];

export class ListAdminUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'laura', description: 'Busca en nombre, correo o username.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: Role, description: 'Cuentas que tienen este rol.' })
  @IsOptional()
  @IsIn(ROLES)
  role?: Role;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsIn(Object.values(UserStatus))
  status?: UserStatus;

  @ApiPropertyOptional({
    example: true,
    description: 'Solo cuentas con algún rol del equipo (todo menos PARTICIPANT).',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  staffOnly?: boolean;

  @ApiPropertyOptional({ enum: ADMIN_USER_SORTS, default: 'NAME_ASC' })
  @IsOptional()
  @IsIn(ADMIN_USER_SORTS)
  sort?: AdminUserSort;
}

export class AdminUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Laura Coordinación' })
  fullName!: string;

  @ApiProperty({ example: 'laura@escuelaitinerante.org' })
  email!: string;

  @ApiProperty({ example: 'laura.coord' })
  username!: string;

  @ApiProperty({ enum: Role, isArray: true, example: ['PARTICIPANT', 'ACADEMIC_COORDINATOR'] })
  roles!: Role[];

  @ApiProperty({ enum: ALL_PERMISSIONS, isArray: true, example: ['admin.access', 'offers.read'] })
  permissions!: Permission[];

  @ApiProperty({ enum: UserStatus, example: 'ACTIVE' })
  status!: UserStatus;

  @ApiProperty({ example: 'MX' })
  countryCode!: string;

  @ApiProperty({
    example: '2026-10-01T12:05:00.000Z',
    nullable: true,
    type: String,
    description: 'null = nunca verificó su correo (no puede iniciar sesión).',
  })
  emailVerifiedAt!: string | null;

  @ApiProperty({ example: '2026-11-07T16:00:00.000Z', nullable: true, type: String })
  lastLoginAt!: string | null;

  @ApiProperty({ example: '2026-10-01T12:00:00.000Z' })
  createdAt!: string;
}

export class UpdateUserRolesRequestDto {
  @ApiProperty({
    enum: Role,
    isArray: true,
    example: ['ACADEMIC_COORDINATOR'],
    description:
      'Roles del equipo que tendrá la cuenta (reemplaza los actuales). `PARTICIPANT` se conserva ' +
      'siempre. Lista vacía = quitar todos los roles del equipo.',
  })
  @IsArray()
  @ArrayMaxSize(ROLES.length)
  @IsIn(ROLES, { each: true })
  roles!: Role[];
}

export class UserStatusChangeRequestDto {
  @ApiPropertyOptional({ example: 'Dejó de colaborar con la Escuela.', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
