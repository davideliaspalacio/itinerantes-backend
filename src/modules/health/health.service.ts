import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { APP_VERSION } from '../../app.version';
import { HealthResponseDto, ReadinessResponseDto } from './dto/health.response.dto';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  liveness(): HealthResponseDto {
    return {
      status: 'ok',
      version: APP_VERSION,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async readiness(): Promise<ReadinessResponseDto> {
    try {
      await this.prisma.ping();
    } catch (error) {
      this.logger.warn({ err: error }, 'Readiness: la base de datos no responde');
      throw new AppException('SERVICE_UNAVAILABLE', {
        message: 'La base de datos no está disponible.',
        details: [{ field: 'database', code: 'DOWN', message: 'Sin conexión a la base de datos.' }],
      });
    }
    return { status: 'ok', checks: { database: 'up' }, timestamp: new Date().toISOString() };
  }
}
