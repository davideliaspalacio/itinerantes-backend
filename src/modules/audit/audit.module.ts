import { Global, Module } from '@nestjs/common';
import { AdminAuditController } from './admin-audit.controller';
import { AuditService } from './audit.service';

/**
 * Auditoría del panel (Fase 06). Global: cualquier servicio admin inyecta `AuditService` y llama a
 * `record()` tras cada acción. `GET /admin/audit-logs` (permiso `audit.read`).
 */
@Global()
@Module({
  controllers: [AdminAuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
