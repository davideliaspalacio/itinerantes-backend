import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ThrottleRule } from '../../common/decorators/throttle-rule.decorator';
import { ApiErrorResponses } from '../../common/swagger/api-error-responses.decorator';
import { BUSINESS_RULES } from '../../config/business-rules';
import { AuthService } from './auth.service';
import {
  AvailabilityQueryDto,
  ForgotPasswordRequestDto,
  LoginRequestDto,
  LogoutRequestDto,
  RefreshRequestDto,
  RegisterRequestDto,
  ResendOtpRequestDto,
  ResetPasswordRequestDto,
  VerifyEmailRequestDto,
  VerifyResetOtpRequestDto,
} from './dto/auth.request.dto';
import {
  AvailabilityResponseDto,
  LoginResponseDto,
  OtpDeliveryDto,
  RegisterResponseDto,
  ResetTokenResponseDto,
  TokenPairDto,
  VerifyEmailResponseDto,
} from './dto/auth.response.dto';

const T = BUSINESS_RULES.AUTH_THROTTLE;
const R = BUSINESS_RULES;
const OTP_RULES_TEXT =
  `Código de ${R.OTP_LENGTH} dígitos; vence en ${R.OTP_TTL_MINUTES} min; reenvío cada ` +
  `${R.OTP_RESEND_COOLDOWN_SECONDS} s; ${R.OTP_MAX_ATTEMPTS} intentos fallidos consecutivos → ` +
  `bloqueo de ${R.OTP_LOCKOUT_MINUTES} min.`;

@ApiTags('Auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ThrottleRule(T.REGISTER)
  @ApiOperation({
    summary: 'Registro',
    description:
      'HU-02: crea la cuenta en estado `PENDING_VERIFICATION` y envía un OTP al correo (HU-03). ' +
      'Ubicación en cascada (ver /locations): ids de catálogo cuando el país/estado tiene lista; ' +
      'texto libre si no. El teléfono se valida contra la longitud del indicativo. ' +
      `Contraseña: mínimo ${R.PASSWORD_MIN_LENGTH} caracteres con al menos una letra y un número. ` +
      'La respuesta trae `otp.expiresAt` y `otp.resendAvailableAt` para la cuenta regresiva.',
  })
  @ApiCreatedResponse({ type: RegisterResponseDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'AUTH_EMAIL_ALREADY_REGISTERED',
    'AUTH_USERNAME_TAKEN',
    'RATE_LIMITED',
  )
  register(@Body() dto: RegisterRequestDto): Promise<RegisterResponseDto> {
    return this.auth.register(dto);
  }

  @Get('availability')
  @ThrottleRule(T.AVAILABILITY)
  @ApiOperation({
    summary: 'Disponibilidad de correo / username',
    description:
      'HU-02: validación en línea ("ya está registrado"). Envía `email`, `username` o ambos. ' +
      '`valid` indica formato correcto; `available`, que además no está registrado.',
  })
  @ApiOkResponse({ type: AvailabilityResponseDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'RATE_LIMITED')
  availability(@Query() query: AvailabilityQueryDto): Promise<AvailabilityResponseDto> {
    return this.auth.availability(query.email, query.username);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ThrottleRule(T.OTP_VERIFY)
  @ApiOperation({
    summary: 'Verificar correo con OTP',
    description:
      `HU-03: activa la cuenta. ${OTP_RULES_TEXT} Errores con \`meta\`: ` +
      '`AUTH_OTP_INVALID` → `attemptsRemaining`; `AUTH_OTP_LOCKED` → `lockedUntil`; ' +
      '`AUTH_OTP_EXPIRED` → `resendAvailableAt`. Por defecto NO inicia sesión (redirige al login); ' +
      'con `startSession: true` la respuesta trae `session` (tokens + perfil, como el login).',
  })
  @ApiOkResponse({ type: VerifyEmailResponseDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'AUTH_OTP_INVALID',
    'AUTH_OTP_EXPIRED',
    'AUTH_OTP_LOCKED',
    'AUTH_ALREADY_VERIFIED',
    'AUTH_ACCOUNT_DISABLED',
    'RATE_LIMITED',
  )
  verifyEmail(
    @Body() dto: VerifyEmailRequestDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<VerifyEmailResponseDto> {
    return this.auth.verifyEmail(dto.email, dto.code, {
      startSession: dto.startSession,
      rememberMe: dto.rememberMe,
      userAgent,
    });
  }

  @Post('otp/resend')
  @HttpCode(HttpStatus.OK)
  @ThrottleRule(T.OTP_SEND)
  @ApiOperation({
    summary: 'Reenviar código OTP',
    description:
      `HU-03 / HU-05: envía un código nuevo e invalida el anterior. ${OTP_RULES_TEXT} ` +
      'Dentro del cooldown → `AUTH_OTP_COOLDOWN` con `meta.resendAvailableAt`. Con ' +
      '`purpose: PASSWORD_RESET` se comporta igual que POST /auth/password/forgot.',
  })
  @ApiOkResponse({ type: OtpDeliveryDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'AUTH_ACCOUNT_NOT_FOUND',
    'AUTH_ALREADY_VERIFIED',
    'AUTH_ACCOUNT_DISABLED',
    'AUTH_OTP_COOLDOWN',
    'AUTH_OTP_LOCKED',
    'RATE_LIMITED',
  )
  resendOtp(@Body() dto: ResendOtpRequestDto): Promise<OtpDeliveryDto> {
    return this.auth.resendOtp(dto.email, dto.purpose);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ThrottleRule(T.LOGIN)
  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'HU-04: correo + contraseña. Credenciales incorrectas → mensaje genérico ' +
      `\`AUTH_INVALID_CREDENTIALS\`. ${R.LOGIN_MAX_ATTEMPTS} fallos consecutivos → ` +
      `\`AUTH_LOGIN_LOCKED\` por ${R.LOGIN_LOCKOUT_MINUTES} min (\`meta.lockedUntil\`). Cuenta sin ` +
      'verificar (contraseña correcta) → 403 `AUTH_EMAIL_NOT_VERIFIED`: redirige a HU-03; se ' +
      'reenvía el OTP solo si el cooldown lo permite (`meta.otpSent`, `meta.expiresAt`, ' +
      '`meta.resendAvailableAt`). `rememberMe` alarga la vida del refresh token.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'AUTH_INVALID_CREDENTIALS',
    'AUTH_EMAIL_NOT_VERIFIED',
    'AUTH_ACCOUNT_DISABLED',
    'AUTH_LOGIN_LOCKED',
    'RATE_LIMITED',
  )
  login(
    @Body() dto: LoginRequestDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<LoginResponseDto> {
    return this.auth.login(dto, userAgent);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ThrottleRule(T.REFRESH)
  @ApiOperation({
    summary: 'Renovar tokens',
    description:
      'Rota el refresh token: devuelve un par nuevo y el anterior queda invalidado. Reusar un ' +
      'refresh ya rotado revoca toda la sesión (detección de robo). Haz un solo refresh a la vez.',
  })
  @ApiOkResponse({ type: TokenPairDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'AUTH_REFRESH_INVALID', 'RATE_LIMITED')
  refresh(
    @Body() dto: RefreshRequestDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<TokenPairDto> {
    return this.auth.refresh(dto.refreshToken, userAgent);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ThrottleRule(T.REFRESH)
  @ApiOperation({
    summary: 'Cerrar sesión',
    description:
      'Revoca la sesión del refresh token enviado. Idempotente (204 aunque ya esté revocado). ' +
      'No requiere access token. El frontend borra los tokens guardados.',
  })
  @ApiNoContentResponse({ description: 'Sesión cerrada.' })
  @ApiErrorResponses('VALIDATION_ERROR', 'RATE_LIMITED')
  async logout(@Body() dto: LogoutRequestDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  @ThrottleRule(T.OTP_SEND)
  @ApiOperation({
    summary: 'Recuperar contraseña — paso 1 (enviar código)',
    description:
      `HU-05: envía un OTP al correo. ${OTP_RULES_TEXT} Correo sin cuenta → 404 ` +
      '`AUTH_ACCOUNT_NOT_FOUND` (lo pide la HU; configurable con ' +
      '`BUSINESS_RULES.REVEAL_UNKNOWN_EMAIL_ON_RESET`, riesgo de enumeración documentado).',
  })
  @ApiOkResponse({ type: OtpDeliveryDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'AUTH_ACCOUNT_NOT_FOUND',
    'AUTH_ACCOUNT_DISABLED',
    'AUTH_OTP_COOLDOWN',
    'AUTH_OTP_LOCKED',
    'RATE_LIMITED',
  )
  forgotPassword(@Body() dto: ForgotPasswordRequestDto): Promise<OtpDeliveryDto> {
    return this.auth.forgotPassword(dto.email);
  }

  @Post('password/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ThrottleRule(T.OTP_VERIFY)
  @ApiOperation({
    summary: 'Recuperar contraseña — paso 2 (verificar código)',
    description:
      'HU-05: valida el OTP y devuelve un `resetToken` de un solo uso que vence en ' +
      `${R.PASSWORD_RESET_TOKEN_TTL_MINUTES} min. Mismos errores y bloqueo que HU-03.`,
  })
  @ApiOkResponse({ type: ResetTokenResponseDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'AUTH_ACCOUNT_NOT_FOUND',
    'AUTH_OTP_INVALID',
    'AUTH_OTP_EXPIRED',
    'AUTH_OTP_LOCKED',
    'RATE_LIMITED',
  )
  verifyResetOtp(@Body() dto: VerifyResetOtpRequestDto): Promise<ResetTokenResponseDto> {
    return this.auth.verifyResetOtp(dto.email, dto.code);
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ThrottleRule(T.PASSWORD_RESET)
  @ApiOperation({
    summary: 'Recuperar contraseña — paso 3 (nueva contraseña)',
    description:
      'HU-05: guarda la nueva contraseña (mismas reglas que HU-02; `confirmPassword` debe ' +
      'coincidir → `details[].code = PASSWORD_MISMATCH`). Invalida el OTP, cierra todas las ' +
      'sesiones y desbloquea el login. Después, redirige al login.',
  })
  @ApiNoContentResponse({ description: 'Contraseña actualizada.' })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'AUTH_RESET_TOKEN_INVALID',
    'AUTH_ACCOUNT_DISABLED',
    'RATE_LIMITED',
  )
  async resetPassword(@Body() dto: ResetPasswordRequestDto): Promise<void> {
    await this.auth.resetPassword(dto);
  }
}
