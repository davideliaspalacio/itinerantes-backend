import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { ApiErrorResponses } from '../../common/swagger/api-error-responses.decorator';
import { HealthResponseDto, ReadinessResponseDto } from './dto/health.response.dto';
import { HealthService } from './health.service';

@ApiTags('Health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Liveness',
    description:
      'Indica que el proceso está vivo. No consulta dependencias. Lo usa Railway como healthcheck.',
  })
  @ApiOkResponse({ type: HealthResponseDto })
  liveness(): HealthResponseDto {
    return this.health.liveness();
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness',
    description: 'Verifica que la API puede atender peticiones (ping a la base de datos).',
  })
  @ApiOkResponse({ type: ReadinessResponseDto })
  @ApiErrorResponses('SERVICE_UNAVAILABLE')
  readiness(): Promise<ReadinessResponseDto> {
    return this.health.readiness();
  }
}
