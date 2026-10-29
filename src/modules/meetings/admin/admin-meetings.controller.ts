import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Param,
  type PipeTransform,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { AppException } from '../../../common/errors/app.exception';
import type { AdminUser } from '../../../common/guards/permissions.guard';
import { ApiErrorResponses } from '../../../common/swagger/api-error-responses.decorator';
import { BEARER_AUTH_NAME } from '../../../config/openapi';
import { Permission } from '../../../config/permissions';
import { MEETING_PROVIDERS, type MeetingProvider } from '../../../infra/meetings/meeting-gateway';
import {
  CreateMeetingRequestDto,
  MeetingDto,
  MeetingHostUrlDto,
  MeetingProvidersResponseDto,
} from '../dto/meetings.dto';
import { isMeetingProvider, isValidExternalId } from '../meetings.policy';
import { MeetingsService } from '../meetings.service';

const MEETING_NOT_FOUND = 'La reunión no existe.';

/** `:provider` de ruta: un proveedor desconocido es un recurso inexistente (404), como un id mal formado. */
@Injectable()
class MeetingProviderPipe implements PipeTransform<string, MeetingProvider> {
  transform(value: string): MeetingProvider {
    if (!isMeetingProvider(value)) throw AppException.notFound(MEETING_NOT_FOUND);
    return value;
  }
}

@Injectable()
class ExternalIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isValidExternalId(value)) throw AppException.notFound(MEETING_NOT_FOUND);
    return value;
  }
}

const providerParam = ApiParam({ name: 'provider', enum: MEETING_PROVIDERS, example: 'ZOOM' });
const externalIdParam = ApiParam({
  name: 'externalId',
  example: '85746065432',
  description: '`externalId` que devolvió `POST /admin/meetings`.',
});

@ApiTags('Admin – Reuniones (Zoom / Google Meet)')
@ApiBearerAuth(BEARER_AUTH_NAME)
@Controller('admin/meetings')
export class AdminMeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get('providers')
  @RequirePermissions(Permission.MEETINGS_CREATE)
  @ApiOperation({
    summary: 'Proveedores de reuniones disponibles',
    description:
      'HU-29 / HU-31: indica qué proveedores tienen credenciales en el servidor (`enabled`) para ' +
      'mostrar u ocultar el botón "Generar enlace" en los formularios de sesión y de entrevista. ' +
      '`usableForInterviews`: la entrevista de HU-31 solo acepta enlaces de zoom.us. Si ninguno está ' +
      'habilitado, el equipo sigue pegando el enlace a mano. Permiso `meetings.create`.',
  })
  @ApiOkResponse({ type: MeetingProvidersResponseDto })
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN')
  providers(): MeetingProvidersResponseDto {
    return this.meetings.providers();
  }

  @Post()
  @RequirePermissions(Permission.MEETINGS_CREATE)
  @ApiOperation({
    summary: 'Generar reunión (Zoom / Google Meet)',
    description:
      'Crea la reunión en el proveedor y devuelve `joinUrl` / `hostUrl` para copiarlos al formulario ' +
      'de la sesión en vivo (HU-29, `joinUrl` y `hostUrl`) o de la entrevista (HU-31, `joinUrl`; ' +
      'solo Zoom). NO guarda la sesión ni la entrevista: el panel las envía después con sus ' +
      'endpoints de siempre. Si el usuario descarta el formulario, llama a ' +
      '`DELETE /admin/meetings/{provider}/{externalId}`. Zoom: reunión programada con sala de espera ' +
      'y sin entrar antes que el anfitrión; `hostUrl` (start_url) caduca ≈2 h. Google Meet: evento ' +
      'en el calendario configurado con sala de Meet; `hostUrl` = `joinUrl`. `startAt` debe ser ' +
      'futuro (400 `details[].code = MUST_BE_FUTURE`); `timezone` por defecto America/Mexico_City. ' +
      'Auditoría `meeting.create`. Permiso `meetings.create`.',
  })
  @ApiCreatedResponse({ type: MeetingDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'MEETING_PROVIDER_ERROR',
    'MEETING_PROVIDER_NOT_CONFIGURED',
  )
  create(
    @Body() dto: CreateMeetingRequestDto,
    @CurrentUser() user: AdminUser,
  ): Promise<MeetingDto> {
    return this.meetings.create(dto, user);
  }

  @Get(':provider/:externalId/host-url')
  @RequirePermissions(Permission.MEETINGS_CREATE)
  @providerParam
  @externalIdParam
  @ApiOperation({
    summary: 'Enlace de anfitrión vigente',
    description:
      'HU-29: el `start_url` de Zoom caduca (≈2 h), así que el botón "Iniciar como anfitrión" debe ' +
      'pedir uno nuevo aquí justo antes de abrirlo. Google Meet devuelve el mismo enlace de la ' +
      'reunión. 404 `NOT_FOUND` si la reunión ya no existe en el proveedor. Permiso `meetings.create`.',
  })
  @ApiOkResponse({ type: MeetingHostUrlDto })
  @ApiErrorResponses(
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'MEETING_PROVIDER_ERROR',
    'MEETING_PROVIDER_NOT_CONFIGURED',
  )
  hostUrl(
    @Param('provider', MeetingProviderPipe) provider: MeetingProvider,
    @Param('externalId', ExternalIdPipe) externalId: string,
  ): Promise<MeetingHostUrlDto> {
    return this.meetings.hostUrl(provider, externalId);
  }

  @Delete(':provider/:externalId')
  @HttpCode(204)
  @RequirePermissions(Permission.MEETINGS_CREATE)
  @providerParam
  @externalIdParam
  @ApiOperation({
    summary: 'Cancelar reunión generada',
    description:
      'HU-29 / HU-31: borra la reunión en Zoom (o el evento de Google Calendar) cuando el usuario ' +
      'descarta el formulario o cambia de enlace. Idempotente: si ya no existe en el proveedor ' +
      'responde 204 igual. No toca la sesión ni la entrevista guardadas. Auditoría ' +
      '`meeting.cancel`. Permiso `meetings.create`.',
  })
  @ApiNoContentResponse()
  @ApiErrorResponses(
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'MEETING_PROVIDER_ERROR',
    'MEETING_PROVIDER_NOT_CONFIGURED',
  )
  async cancel(
    @Param('provider', MeetingProviderPipe) provider: MeetingProvider,
    @Param('externalId', ExternalIdPipe) externalId: string,
    @CurrentUser() user: AdminUser,
  ): Promise<void> {
    await this.meetings.cancel(provider, externalId, user);
  }
}
