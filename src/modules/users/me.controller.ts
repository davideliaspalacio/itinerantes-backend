import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { ApiErrorResponses } from '../../common/swagger/api-error-responses.decorator';
import { BEARER_AUTH_NAME } from '../../config/openapi';
import {
  UpdateProfileRequestDto,
  UpdateTimezoneRequestDto,
} from './dto/update-profile.request.dto';
import { UserProfileDto } from './dto/user-profile.response.dto';
import { UsersService } from './users.service';

@ApiTags('Perfil')
@ApiBearerAuth(BEARER_AUTH_NAME)
@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'Mi perfil',
    description:
      'HU-14: datos del usuario autenticado. `currency` es calculado (MX → MXN; resto → USD) y ' +
      'define la moneda de los pagos nuevos. Username y correo son de solo lectura.',
  })
  @ApiOkResponse({ type: UserProfileDto })
  @ApiErrorResponses('UNAUTHORIZED', 'RATE_LIMITED')
  getMe(@CurrentUser() user: AuthUser): Promise<UserProfileDto> {
    return this.users.getProfile(user.id);
  }

  @Patch()
  @ApiOperation({
    summary: 'Actualizar mi perfil',
    description:
      'HU-14 "Datos personales": nombre, teléfono, ubicación (completa: país + estado + municipio, ' +
      'misma lógica que HU-02) y zona horaria. Solo se modifican los campos enviados. Username y ' +
      'correo no son editables (enviarlos → 400 `UNKNOWN_FIELD`). Cambiar de país cambia la moneda ' +
      'de los pagos nuevos, sin afectar pagos hechos.',
  })
  @ApiOkResponse({ type: UserProfileDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'RATE_LIMITED')
  updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileRequestDto,
  ): Promise<UserProfileDto> {
    return this.users.updateProfile(user.id, dto);
  }

  @Patch('timezone')
  @ApiOperation({
    summary: 'Guardar mi zona horaria',
    description:
      'HU-11 "Usar siempre esta zona" y HU-14 pestaña "Zona horaria". Acepta cualquier zona IANA válida.',
  })
  @ApiOkResponse({ type: UserProfileDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'RATE_LIMITED')
  updateTimezone(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateTimezoneRequestDto,
  ): Promise<UserProfileDto> {
    return this.users.updateTimezone(user.id, dto.timezone);
  }
}
