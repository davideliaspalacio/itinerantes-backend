import { ApiProperty } from '@nestjs/swagger';
import { CalendarItemDto } from '../calendar/dto/calendar.dto';
import { FormationCardDto } from '../enrollments/dto/enrollments.response.dto';
import { LibraryItemDto } from '../library/dto/library.dto';
import { UnreadCountDto } from '../notifications/dto/notifications.response.dto';

export const DASHBOARD_BLOCKS = [
  'nextActivity',
  'formations',
  'upcomingEvents',
  'recommendedResources',
  'notifications',
] as const;
export type DashboardBlock = (typeof DASHBOARD_BLOCKS)[number];

export class DashboardFormationsDto {
  @ApiProperty({ type: [FormationCardDto], description: 'Máximo 3 (configurable).' })
  items!: FormationCardDto[];

  @ApiProperty({
    example: 4,
    description: 'Total de formaciones activas ("Ver toda mi formación").',
  })
  total!: number;
}

/** Dashboard (HU-06). Cada bloque es independiente: si falla, llega null y su nombre en `failedBlocks`. */
export class DashboardDto {
  @ApiProperty({
    type: CalendarItemDto,
    nullable: true,
    description:
      '"Próxima actividad": la siguiente sesión o evento (en curso o futuro, no cancelado, sin ' +
      'fechas importantes) en los próximos 62 días, con `join` (HU-12). null → mensaje orientador.',
  })
  nextActivity!: CalendarItemDto | null;

  @ApiProperty({ type: DashboardFormationsDto, nullable: true })
  formations!: DashboardFormationsDto | null;

  @ApiProperty({
    type: [CalendarItemDto],
    nullable: true,
    description: 'Widget Calendario: próximos eventos (30 días, máx. 5) con color de categoría.',
  })
  upcomingEvents!: CalendarItemDto[] | null;

  @ApiProperty({
    type: [LibraryItemDto],
    nullable: true,
    description: 'Widget Biblioteca: material recomendado (máx. 4).',
  })
  recommendedResources!: LibraryItemDto[] | null;

  @ApiProperty({ type: UnreadCountDto, nullable: true })
  notifications!: UnreadCountDto | null;

  @ApiProperty({
    enum: DASHBOARD_BLOCKS,
    isArray: true,
    example: [],
    description:
      'Bloques que no se pudieron cargar: muestra "No se pudo cargar esta información" + reintento ' +
      '(el reintento puede usar el endpoint propio del bloque: /me/enrollments, /me/calendar, ' +
      '/library, /me/notifications/unread-count).',
  })
  failedBlocks!: DashboardBlock[];
}
