import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, Length, MaxLength, ValidateIf } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination.dto';

const HTTPS = { protocols: ['https'], require_protocol: true };

export class ListTeachersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'torres', description: 'Busca en el nombre.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class CreateTeacherRequestDto {
  @ApiProperty({ example: 'Dra. Ana Torres', minLength: 3, maxLength: 160 })
  @IsString()
  @Length(3, 160)
  fullName!: string;

  @ApiPropertyOptional({
    example: 'Ingeniera ambiental con 15 años…',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  bio?: string | null;

  @ApiPropertyOptional({
    example: 'https://drive.google.com/file/d/cv',
    nullable: true,
    type: String,
    description: 'CV (enlace https).',
  })
  @IsOptional()
  @IsUrl(HTTPS)
  @MaxLength(500)
  cvUrl?: string | null;

  @ApiPropertyOptional({
    example: 'public/teachers/2f1c…-foto.jpg',
    nullable: true,
    type: String,
    description: 'Key de `POST /admin/uploads/images` (TEACHER_PHOTO) o URL https.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoKey?: string | null;
}

export class UpdateTeacherRequestDto extends CreateTeacherRequestDto {
  @ApiPropertyOptional({ example: 'Dra. Ana Torres', minLength: 3, maxLength: 160 })
  @ValidateIf((_o: unknown, v: unknown) => v !== undefined)
  @IsString()
  @Length(3, 160)
  declare fullName: string;
}

export class AdminTeacherDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ana-torres' })
  slug!: string;

  @ApiProperty({ example: 'Dra. Ana Torres' })
  fullName!: string;

  @ApiProperty({ nullable: true, type: String })
  bio!: string | null;

  @ApiProperty({ nullable: true, type: String })
  cvUrl!: string | null;

  @ApiProperty({ nullable: true, type: String })
  photoKey!: string | null;

  @ApiProperty({ nullable: true, type: String })
  photoUrl!: string | null;

  @ApiProperty({ example: 2, description: 'Ofertas donde participa.' })
  offerCount!: number;

  @ApiProperty({ example: 3, description: 'Módulos asignados.' })
  moduleCount!: number;

  @ApiProperty({ example: '2026-10-21T18:00:00.000Z' })
  updatedAt!: string;
}
