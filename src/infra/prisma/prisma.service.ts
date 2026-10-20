import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from '../../config/env.schema';
import { PrismaClient } from '../../generated/prisma/client';

/**
 * Cliente Prisma inyectable (global vía PrismaModule).
 *
 * Prisma 7 usa un "driver adapter": la conexión la hace `pg` con `DATABASE_URL`
 * (en Supabase puede ser la URL del pooler). Las migraciones usan prisma.config.ts.
 *
 * Uso en un servicio de dominio:
 * ```ts
 * constructor(private readonly prisma: PrismaService) {}
 * this.prisma.user.findUnique({ where: { id } });
 * this.prisma.$transaction(async (tx) => { ... });
 * ```
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService<Env, true>) {
    const adapter = new PrismaPg({ connectionString: config.get('DATABASE_URL', { infer: true }) });
    super({ adapter });
  }

  onModuleInit(): void {
    // Conexión anticipada SIN bloquear el arranque: la app empieza a escuchar (liveness OK) aunque
    // la BD tarde o no responda; /health/ready reporta el estado y Prisma reintenta en cada consulta.
    this.$connect()
      .then(() => this.logger.log('Conectado a la base de datos'))
      .catch((error: unknown) =>
        this.logger.error({ err: error }, 'No se pudo conectar a la base de datos al arrancar'),
      );
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Ping a la BD (readiness). Lanza si no hay conexión. */
  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
}
