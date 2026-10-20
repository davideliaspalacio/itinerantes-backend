import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { ThrottleRule } from '../../common/decorators/throttle-rule.decorator';
import { ApiErrorResponses } from '../../common/swagger/api-error-responses.decorator';
import { BUSINESS_RULES } from '../../config/business-rules';
import { AuthService } from './auth.service';
import { ChangePasswordRequestDto } from './dto/auth.request.dto';

/** HU-14 pestaña "Seguridad" (vive en AuthModule porque usa contraseñas y sesiones). */
@ApiTags('Perfil')
@Controller('me')
export class AccountSecurityController {
  constructor(private readonly auth: AuthService) {}

  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ThrottleRule(BUSINESS_RULES.AUTH_THROTTLE.LOGIN)
  @ApiOperation({
    summary: 'Cambiar mi contraseña',
    description:
      'HU-14 "Seguridad": valida la contraseña actual y que la nueva cumpla las reglas de HU-02 ' +
      '(`confirmPassword` debe coincidir). Cierra las demás sesiones; la actual sigue activa.',
  })
  @ApiNoContentResponse({ description: 'Contraseña actualizada.' })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'AUTH_CURRENT_PASSWORD_INVALID',
    'UNAUTHORIZED',
    'RATE_LIMITED',
  )
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordRequestDto,
  ): Promise<void> {
    await this.auth.changePassword(user.id, user.sessionId, dto);
  }
}
