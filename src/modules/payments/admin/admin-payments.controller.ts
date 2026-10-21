import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import type { PaginatedResponseDto } from '../../../common/dto/pagination.dto';
import type { AdminUser } from '../../../common/guards/permissions.guard';
import { uuidOr404 } from '../../../common/pipes/uuid-or-404.pipe';
import { ApiErrorResponses } from '../../../common/swagger/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../../../common/swagger/api-paginated-response.decorator';
import { BEARER_AUTH_NAME } from '../../../config/openapi';
import { Permission } from '../../../config/permissions';
import { AccessUrlDto } from '../../enrollments/dto/portal-shared.dto';
import { AdminPaymentPlansService } from './admin-payment-plans.service';
import { AdminPaymentsService } from './admin-payments.service';
import {
  AdminPaymentsSummaryQueryDto,
  ListAdminPaymentsQueryDto,
  ListAdminPlansQueryDto,
  ListAdminRefundsQueryDto,
  ListAdminTransfersQueryDto,
  PlanActionReasonRequestDto,
  RefundRequestDto,
  RejectTransferRequestDto,
  ValidateTransferRequestDto,
} from './dto/admin-payments.request.dto';
import {
  AdminPaymentDetailDto,
  AdminPaymentDto,
  AdminPaymentPlanDto,
  AdminPaymentsSummaryDto,
  AdminRefundDto,
} from './dto/admin-payments.response.dto';

const PAYMENT_ID = uuidOr404('El pago no existe.');
const PLAN_ID = uuidOr404('El plan no existe.');
const READ =
  ' Permiso `payments.read` (todo el equipo puede CONSULTAR; HU-33: sin el rol de finanzas, solo ' +
  'lectura).';
const MANAGE =
  ' Permiso `payments.manage` (Administración y finanzas / SUPER_ADMIN); el resto → 403.';

@ApiTags('Admin – Pagos')
@ApiBearerAuth(BEARER_AUTH_NAME)
@Controller('admin')
export class AdminPaymentsController {
  constructor(
    private readonly payments: AdminPaymentsService,
    private readonly plans: AdminPaymentPlansService,
  ) {}

  // --- Pagos ---------------------------------------------------------------------------------------

  @Get('payments')
  @RequirePermissions(Permission.PAYMENTS_READ)
  @ApiOperation({
    summary: 'Listado de pagos',
    description:
      'HU-33 pestaña "Pagos": concepto (completo / saldo tras beca / cuota n de N), método, monto, ' +
      'moneda, estado, quién paga, oferta e IDs de Stripe. Los pagos de Stripe aparecen solos (webhook). ' +
      'Filtros por estado, método, concepto, moneda, oferta, persona, fechas y `q` (folio, nombre, ' +
      'correo). Por defecto excluye `CANCELLED` (checkouts abandonados). MXN y USD nunca se suman.' +
      READ,
  })
  @ApiPaginatedResponse(AdminPaymentDto)
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN')
  list(@Query() query: ListAdminPaymentsQueryDto): Promise<PaginatedResponseDto<AdminPaymentDto>> {
    return this.payments.list(query);
  }

  @Get('payments/summary')
  @RequirePermissions(Permission.PAYMENTS_READ)
  @ApiOperation({
    summary: 'Resumen de pagos por moneda',
    description:
      'HU-33 "resumen separado por MXN y USD": cobrado, reembolsado y neto por moneda (nunca se ' +
      'suman), contador de transferencias por conciliar, planes en cobro fallido / mora / suspendidos ' +
      'y reembolsos en proceso. Filtros por oferta y rango de fecha de cobro.' +
      READ,
  })
  @ApiOkResponse({ type: AdminPaymentsSummaryDto })
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN')
  summary(@Query() query: AdminPaymentsSummaryQueryDto): Promise<AdminPaymentsSummaryDto> {
    return this.payments.summary(query);
  }

  @Get('payments/:id')
  @RequirePermissions(Permission.PAYMENTS_READ)
  @ApiOperation({
    summary: 'Detalle de un pago',
    description:
      'HU-33: datos del pago, IDs de Stripe, transferencia (saldo esperado junto a lo declarado: monto, ' +
      'fecha, clave de rastreo; monto recibido, revisor, motivo de rechazo), reembolsos y `actions` ' +
      '(`canRefund`, `canReview`) según el permiso del usuario.' +
      READ,
  })
  @ApiOkResponse({ type: AdminPaymentDetailDto })
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  detail(
    @Param('id', PAYMENT_ID) id: string,
    @CurrentUser() user: AdminUser,
  ): Promise<AdminPaymentDetailDto> {
    return this.payments.detail(id, user);
  }

  @Get('payments/:id/proof')
  @RequirePermissions(Permission.PAYMENTS_READ)
  @ApiOperation({
    summary: 'Comprobante de transferencia (URL firmada)',
    description:
      'HU-33 "Visor": URL firmada temporal (~10 min) del comprobante (PDF/JPG/PNG). Sin comprobante → ' +
      '404.' +
      READ,
  })
  @ApiOkResponse({ type: AccessUrlDto })
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  proof(@Param('id', PAYMENT_ID) id: string): Promise<AccessUrlDto> {
    return this.payments.proof(id);
  }

  @Post('payments/:id/refund')
  @HttpCode(201)
  @RequirePermissions(Permission.PAYMENTS_MANAGE)
  @ApiOperation({
    summary: 'Reembolsar un pago (total o parcial)',
    description:
      'HU-33 "Reembolso": monto ≤ pagado − reembolsado − en proceso y motivo obligatorio (Anexo A: sin ' +
      'política de plazos). Tarjeta → se procesa en Stripe (el reembolso puede quedar `PENDING` = "en ' +
      'proceso" hasta el webhook `charge.refunded`, o `FAILED` con motivo). Transferencia → se REGISTRA ' +
      'el reembolso hecho fuera de la plataforma (`SUCCEEDED`). Reembolso total → pago "Reembolsado". ' +
      'La inscripción NO cambia. Sin llaves de Stripe → 503.' +
      MANAGE,
  })
  @ApiCreatedResponse({ type: AdminPaymentDetailDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'PAYMENT_INVALID_STATE',
    'PAYMENT_REFUND_INVALID',
    'PAYMENT_PROVIDER_ERROR',
    'PAYMENTS_NOT_CONFIGURED',
  )
  refund(
    @Param('id', PAYMENT_ID) id: string,
    @CurrentUser() user: AdminUser,
    @Body() dto: RefundRequestDto,
  ): Promise<AdminPaymentDetailDto> {
    return this.payments.refund(id, user, dto);
  }

  @Get('refunds')
  @RequirePermissions(Permission.PAYMENTS_READ)
  @ApiOperation({
    summary: 'Reembolsos',
    description:
      'HU-33 pestaña "Reembolsos" (más reciente primero; `PENDING` = en proceso en Stripe).' + READ,
  })
  @ApiPaginatedResponse(AdminRefundDto)
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN')
  refunds(@Query() query: ListAdminRefundsQueryDto): Promise<PaginatedResponseDto<AdminRefundDto>> {
    return this.payments.listRefunds(query);
  }

  // --- Transferencias -------------------------------------------------------------------------------

  @Get('transfers')
  @RequirePermissions(Permission.PAYMENTS_READ)
  @ApiOperation({
    summary: 'Transferencias por conciliar',
    description:
      'HU-33 pestaña "Transferencias por conciliar": por defecto `PENDING_VALIDATION` (la más antigua ' +
      'primero; el contador es `meta.total`). También `VALIDATED`, `REJECTED`, `REFUNDED`.' +
      READ,
  })
  @ApiPaginatedResponse(AdminPaymentDto)
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN')
  transfers(
    @Query() query: ListAdminTransfersQueryDto,
  ): Promise<PaginatedResponseDto<AdminPaymentDto>> {
    return this.payments.listTransfers(query);
  }

  @Post('transfers/:id/validate')
  @HttpCode(200)
  @RequirePermissions(Permission.PAYMENTS_MANAGE)
  @ApiOperation({
    summary: 'Validar transferencia y activar inscripción',
    description:
      'HU-33: captura el monto y la fecha recibidos. Monto ≥ saldo esperado → "Validada", la ' +
      'postulación pasa a "Inscrita", se activa la inscripción y se notifica a la persona ' +
      '(TRANSFER_VALIDATED). Monto menor → 422 `PAYMENT_TRANSFER_AMOUNT_MISMATCH` con ' +
      '`meta.differenceCents`/`expectedCents`: solo se puede rechazar con "Monto no coincide". Ya ' +
      'resuelta → 409 `PAYMENT_INVALID_STATE`.' +
      MANAGE,
  })
  @ApiOkResponse({ type: AdminPaymentDetailDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'PAYMENT_TRANSFER_AMOUNT_MISMATCH',
    'PAYMENT_INVALID_STATE',
    'APPLICATION_INVALID_TRANSITION',
  )
  validateTransfer(
    @Param('id', PAYMENT_ID) id: string,
    @CurrentUser() user: AdminUser,
    @Body() dto: ValidateTransferRequestDto,
  ): Promise<AdminPaymentDetailDto> {
    return this.payments.validateTransfer(id, user, dto);
  }

  @Post('transfers/:id/reject')
  @HttpCode(200)
  @RequirePermissions(Permission.PAYMENTS_MANAGE)
  @ApiOperation({
    summary: 'Rechazar transferencia',
    description:
      'HU-33: motivo Ilegible / Monto no coincide / No encontrado / Otro (`note` obligatoria con ' +
      '`OTHER`). Pasa a "Rechazada", la postulación vuelve a correr su plazo y la persona puede subir ' +
      'otro comprobante (aviso TRANSFER_REJECTED con el motivo).' +
      MANAGE,
  })
  @ApiOkResponse({ type: AdminPaymentDetailDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'PAYMENT_INVALID_STATE',
  )
  rejectTransfer(
    @Param('id', PAYMENT_ID) id: string,
    @CurrentUser() user: AdminUser,
    @Body() dto: RejectTransferRequestDto,
  ): Promise<AdminPaymentDetailDto> {
    return this.payments.rejectTransfer(id, user, dto);
  }

  // --- Planes de cuotas ----------------------------------------------------------------------------

  @Get('payment-plans')
  @RequirePermissions(Permission.PAYMENTS_READ)
  @ApiOperation({
    summary: 'Planes de cuotas',
    description:
      'HU-33 pestaña "Planes de cuotas": cuotas pagadas/total, próximo cobro, estado (Al día / Cobro ' +
      'fallido / En mora / Completado / Cancelado), días desde el cobro fallido, acceso suspendido, ' +
      'mini línea de cuotas, contacto y `availableActions`. Por defecto excluye `PENDING_ACTIVATION`; ' +
      'orden: más días con cobro fallido primero.' +
      READ,
  })
  @ApiPaginatedResponse(AdminPaymentPlanDto)
  @ApiErrorResponses('VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN')
  plansList(
    @Query() query: ListAdminPlansQueryDto,
  ): Promise<PaginatedResponseDto<AdminPaymentPlanDto>> {
    return this.plans.list(query);
  }

  @Get('payment-plans/:id')
  @RequirePermissions(Permission.PAYMENTS_READ)
  @ApiOperation({ summary: 'Detalle de un plan de cuotas', description: 'HU-33.' + READ })
  @ApiOkResponse({ type: AdminPaymentPlanDto })
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND')
  plan(@Param('id', PLAN_ID) id: string): Promise<AdminPaymentPlanDto> {
    return this.plans.detail(id);
  }

  @Post('payment-plans/:id/retry')
  @HttpCode(200)
  @RequirePermissions(Permission.PAYMENTS_MANAGE)
  @ApiOperation({
    summary: 'Reintentar cobro',
    description:
      'HU-33 "Reintentar en Cobro fallido / En mora": cobra YA las cuotas fallidas con la tarjeta ' +
      'registrada (misma lógica que [Pagar ahora]). Éxito → plan "Al día" (regulariza y restablece el ' +
      'acceso suspendido). Rechazo → 422 `PAYMENT_CHARGE_FAILED` (`meta.failureMessage`). Otro estado → ' +
      '409 `PAYMENT_PLAN_INVALID_STATE`.' +
      MANAGE,
  })
  @ApiOkResponse({ type: AdminPaymentPlanDto })
  @ApiErrorResponses(
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'PAYMENT_PLAN_INVALID_STATE',
    'PAYMENT_INVALID_STATE',
    'PAYMENT_CHARGE_FAILED',
    'PAYMENT_PROVIDER_ERROR',
    'PAYMENTS_NOT_CONFIGURED',
  )
  retry(
    @Param('id', PLAN_ID) id: string,
    @CurrentUser() user: AdminUser,
  ): Promise<AdminPaymentPlanDto> {
    return this.plans.retry(id, user);
  }

  @Post('payment-plans/:id/mark-delinquent')
  @HttpCode(200)
  @RequirePermissions(Permission.PAYMENTS_MANAGE)
  @ApiOperation({
    summary: 'Marcar plan "En mora"',
    description:
      'HU-33: pasa a "En mora" un plan en "Cobro fallido" sin esperar al job (aviso PLAN_DELINQUENT). ' +
      'OJO: con la regla actual `SUSPEND_ACCESS_ON_DELINQUENCY=true` esto también SUSPENDE el acceso ' +
      '(ver la guía: discrepancia con HU-33 por confirmar con el cliente).' +
      MANAGE,
  })
  @ApiOkResponse({ type: AdminPaymentPlanDto })
  @ApiErrorResponses('UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'PAYMENT_PLAN_INVALID_STATE')
  markDelinquent(
    @Param('id', PLAN_ID) id: string,
    @CurrentUser() user: AdminUser,
  ): Promise<AdminPaymentPlanDto> {
    return this.plans.markDelinquent(id, user);
  }

  @Post('payment-plans/:id/suspend-access')
  @HttpCode(200)
  @RequirePermissions(Permission.PAYMENTS_MANAGE)
  @ApiOperation({
    summary: 'Suspender acceso (manual)',
    description:
      'HU-33 "Suspender solo en En mora": inscripción → SUSPENDED (el Aula responde 403 ' +
      '`ENROLLMENT_SUSPENDED`) y aviso fijado a la persona. Si luego regulariza el pago, el acceso se ' +
      'restablece solo. Requiere plan "En mora" e inscripción activa → si no, 409 ' +
      '`PAYMENT_PLAN_INVALID_STATE`.' +
      MANAGE,
  })
  @ApiOkResponse({ type: AdminPaymentPlanDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'PAYMENT_PLAN_INVALID_STATE',
  )
  suspendAccess(
    @Param('id', PLAN_ID) id: string,
    @CurrentUser() user: AdminUser,
    @Body() dto: PlanActionReasonRequestDto,
  ): Promise<AdminPaymentPlanDto> {
    return this.plans.suspendAccess(id, user, dto.reason);
  }

  @Post('payment-plans/:id/restore-access')
  @HttpCode(200)
  @RequirePermissions(Permission.PAYMENTS_MANAGE)
  @ApiOperation({
    summary: 'Restablecer acceso',
    description:
      'HU-33: inscripción SUSPENDED → ACTIVE (aunque el plan siga en mora; suspensión automática o ' +
      'manual). Desfija el aviso de suspensión y avisa a la persona. Sin suspensión → 409.' +
      MANAGE,
  })
  @ApiOkResponse({ type: AdminPaymentPlanDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'PAYMENT_PLAN_INVALID_STATE',
  )
  restoreAccess(
    @Param('id', PLAN_ID) id: string,
    @CurrentUser() user: AdminUser,
    @Body() dto: PlanActionReasonRequestDto,
  ): Promise<AdminPaymentPlanDto> {
    return this.plans.restoreAccess(id, user, dto.reason);
  }

  @Post('payment-plans/:id/cancel')
  @HttpCode(200)
  @RequirePermissions(Permission.PAYMENTS_MANAGE)
  @ApiOperation({
    summary: 'Cancelar plan',
    description:
      'HU-33: plan "Cancelado"; las cuotas programadas o fallidas se cancelan (no se cobran más) y se ' +
      'desfijan sus avisos. La inscripción NO cambia (suspender/dar de baja es otra acción). Plan ' +
      'completado o ya cancelado → 409.' +
      MANAGE,
  })
  @ApiOkResponse({ type: AdminPaymentPlanDto })
  @ApiErrorResponses(
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'PAYMENT_PLAN_INVALID_STATE',
  )
  cancel(
    @Param('id', PLAN_ID) id: string,
    @CurrentUser() user: AdminUser,
    @Body() dto: PlanActionReasonRequestDto,
  ): Promise<AdminPaymentPlanDto> {
    return this.plans.cancel(id, user, dto.reason);
  }
}
