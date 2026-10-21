/**
 * Variables ficticias para exportar OpenAPI sin infraestructura. Se importa ANTES que AppModule
 * (ConfigModule valida el entorno al cargarse). No se abre ninguna conexión real.
 */
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://openapi:openapi@localhost:5432/openapi';
process.env.JWT_ACCESS_SECRET ??= 'openapi-export-placeholder-secret-0123456789';
process.env.LOG_LEVEL = 'silent';
process.env.MAIL_DRIVER = 'console';
process.env.SCHEDULER_ENABLED = 'false';
