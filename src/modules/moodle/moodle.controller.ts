import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ThrottleRule } from '../../common/decorators/throttle-rule.decorator';
import { ApiErrorResponses } from '../../common/swagger/api-error-responses.decorator';
import { BUSINESS_RULES } from '../../config/business-rules';
import { BEARER_AUTH_NAME } from '../../config/openapi';
import { MoodleLinkResultDto, RedeemMoodleCodeRequestDto } from './dto/moodle.dto';
import { MoodleAccessService } from './moodle-access.service';

@ApiTags('Acceso Moodle')
@ApiBearerAuth(BEARER_AUTH_NAME)
@Controller('me/moodle-access')
export class MoodleController {
  constructor(private readonly moodle: MoodleAccessService) {}

  @Post('link')
  @HttpCode(200)
  @ApiOperation({
    summary: '¿No ves tu formación? Buscar por mi correo',
    description:
      'HU-25: busca mi correo en las listas de inscritos de ofertas Moodle y vincula las ' +
      'formaciones (también ocurre solo al verificar el correo y cuando el equipo carga la lista). ' +
      '`found = false` → "No encontramos una inscripción asociada a tu correo" + código de acceso o ' +
      'contacto. Idempotente.',
  })
  @ApiOkResponse({ type: MoodleLinkResultDto })
  @ApiErrorResponses('UNAUTHORIZED', 'RATE_LIMITED')
  link(@CurrentUser() user: AuthUser): Promise<MoodleLinkResultDto> {
    return this.moodle.linkByEmail(user.id);
  }

  @Post('redeem')
  @HttpCode(200)
  @ThrottleRule(BUSINESS_RULES.MOODLE_ACCESS_CODE_THROTTLE)
  @ApiOperation({
    summary: 'Activar acceso con código',
    description:
      'HU-25 [Ya estoy inscrito: activar mi acceso] para quien usó otro correo en Moodle: código ' +
      'XXXX-XXXX de un solo uso, vigente hasta el fin de la cohorte. Errores específicos: ' +
      '`MOODLE_CODE_INVALID`, `MOODLE_CODE_USED`, `MOODLE_CODE_EXPIRED`; ya inscrito → ' +
      '`ENROLLMENT_ALREADY_EXISTS` (el código no se consume). Límite: 10 intentos / 10 min por IP.',
  })
  @ApiOkResponse({ type: MoodleLinkResultDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'MOODLE_CODE_USED',
    'ENROLLMENT_ALREADY_EXISTS',
    'MOODLE_CODE_INVALID',
    'MOODLE_CODE_EXPIRED',
    'RATE_LIMITED',
  )
  redeem(
    @CurrentUser() user: AuthUser,
    @Body() dto: RedeemMoodleCodeRequestDto,
  ): Promise<MoodleLinkResultDto> {
    return this.moodle.redeemCode(user.id, dto.code);
  }
}
