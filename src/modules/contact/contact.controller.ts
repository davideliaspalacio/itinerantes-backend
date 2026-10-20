import { Body, Controller, Headers, Ip, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ThrottleRule } from '../../common/decorators/throttle-rule.decorator';
import { ApiErrorResponses } from '../../common/swagger/api-error-responses.decorator';
import { BUSINESS_RULES } from '../../config/business-rules';
import { ContactService } from './contact.service';
import { ContactMessageResponseDto, CreateContactMessageRequestDto } from './dto/contact.dto';

@ApiTags('Contacto')
@Public()
@Controller('contact-messages')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @ThrottleRule(BUSINESS_RULES.CONTACT_THROTTLE)
  @ApiOperation({
    summary: 'Enviar mensaje de Contacto',
    description:
      'HU-38 / HU-01: formulario único (página Contacto y landing, distinguidos por `origin`). ' +
      'Con `subject = DESIGN_CONSULTING` son obligatorios `projectType`, `projectLocation` y ' +
      '`service`; con otro asunto se ignoran. Anti-spam: honeypot `website` (si llega con texto ' +
      'se descarta en silencio con la misma respuesta 201), máximo ' +
      `${BUSINESS_RULES.CONTACT_THROTTLE.limit} envíos por IP por hora (429 \`RATE_LIMITED\`) y ` +
      'captcha Cloudflare Turnstile opcional (`captchaToken`; solo se exige si el backend tiene ' +
      'TURNSTILE_SECRET_KEY). Queda registrado con estado `NEW`; se envía acuse al visitante y ' +
      'aviso al buzón del equipo.',
  })
  @ApiCreatedResponse({ type: ContactMessageResponseDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'CONTACT_CAPTCHA_FAILED', 'RATE_LIMITED')
  create(
    @Body() dto: CreateContactMessageRequestDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<ContactMessageResponseDto> {
    return this.contact.create(dto, { ip, userAgent });
  }
}
