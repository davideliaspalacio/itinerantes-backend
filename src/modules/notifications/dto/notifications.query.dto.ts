import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { NotificationCategory } from '../../../generated/prisma/client';

export class ListNotificationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    type: Boolean,
    example: true,
    description: 'Solo no leídas.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' || value === true
      ? true
      : value === 'false' || value === false
        ? false
        : value,
  )
  @IsBoolean()
  unread?: boolean;

  @ApiPropertyOptional({
    enum: NotificationCategory,
    example: 'TRAINING',
    description: 'Grupo: Formación, Postulaciones y becas, Pagos o General.',
  })
  @IsOptional()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;
}
