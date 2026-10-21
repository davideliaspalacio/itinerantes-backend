import {
  availablePlanActions,
  canPlanAction,
  decideRefund,
  paymentRefundTotals,
  pendingRefundsCovered,
  refundableCents,
  refundStatusFromGateway,
  totalsByCurrency,
} from './admin-payments.policy';

const d = (iso: string) => new Date(iso);

describe('admin-payments.policy', () => {
  describe('reembolsos', () => {
    const base = {
      status: 'PAID' as const,
      method: 'CARD' as const,
      stripePaymentIntentId: 'pi_1',
      amountCents: 1_020_000,
      refunds: [] as Array<{ amountCents: number; status: 'PENDING' | 'SUCCEEDED' | 'FAILED' }>,
    };

    it('refundableCents descuenta confirmados y en proceso, no los fallidos', () => {
      expect(
        refundableCents({
          amountCents: 1000,
          refunds: [
            { amountCents: 300, status: 'SUCCEEDED' },
            { amountCents: 200, status: 'PENDING' },
            { amountCents: 500, status: 'FAILED' },
          ],
        }),
      ).toBe(500);
      // Reembolso hecho en el dashboard de Stripe (sin registro del panel).
      expect(refundableCents({ amountCents: 1000, refundedCents: 700, refunds: [] })).toBe(300);
    });

    it('tarjeta → Stripe; transferencia → registro manual', () => {
      expect(decideRefund({ ...base, requestedCents: 100 })).toEqual({ ok: true, via: 'GATEWAY' });
      expect(
        decideRefund({
          ...base,
          method: 'BANK_TRANSFER',
          status: 'VALIDATED',
          stripePaymentIntentId: null,
          requestedCents: 100,
        }),
      ).toEqual({ ok: true, via: 'MANUAL_RECORD' });
    });

    it('monto ≤ pagado − reembolsado, entero y > 0', () => {
      expect(decideRefund({ ...base, requestedCents: 1_020_001 })).toEqual({
        ok: false,
        code: 'PAYMENT_REFUND_INVALID',
        refundableCents: 1_020_000,
      });
      expect(decideRefund({ ...base, requestedCents: 0 }).ok).toBe(false);
      expect(
        decideRefund({
          ...base,
          refunds: [{ amountCents: 1_000_000, status: 'SUCCEEDED' }],
          requestedCents: 20_001,
        }),
      ).toMatchObject({ ok: false, refundableCents: 20_000 });
    });

    it('estados no reembolsables o tarjeta sin PaymentIntent', () => {
      expect(decideRefund({ ...base, status: 'PENDING', requestedCents: 1 })).toMatchObject({
        ok: false,
        code: 'PAYMENT_INVALID_STATE',
      });
      expect(decideRefund({ ...base, status: 'REFUNDED', requestedCents: 1 }).ok).toBe(false);
      expect(decideRefund({ ...base, stripePaymentIntentId: null, requestedCents: 1 }).ok).toBe(
        false,
      );
    });

    it('totales: suma solo confirmados y detecta reembolso total', () => {
      expect(
        paymentRefundTotals({
          amountCents: 1000,
          refunds: [
            { amountCents: 400, status: 'SUCCEEDED' },
            { amountCents: 600, status: 'PENDING' },
          ],
        }),
      ).toEqual({ refundedCents: 400, fullyRefunded: false });
      expect(
        paymentRefundTotals({
          amountCents: 1000,
          refunds: [{ amountCents: 1000, status: 'SUCCEEDED' }],
        }).fullyRefunded,
      ).toBe(true);
    });

    it('charge.refunded confirma en proceso del más antiguo mientras quepan', () => {
      const refunds = [
        { id: 'a', amountCents: 300, status: 'SUCCEEDED' as const, createdAt: d('2026-11-01') },
        { id: 'c', amountCents: 500, status: 'PENDING' as const, createdAt: d('2026-11-03') },
        { id: 'b', amountCents: 200, status: 'PENDING' as const, createdAt: d('2026-11-02') },
      ];
      expect(pendingRefundsCovered({ amountRefundedCents: 500, refunds })).toEqual(['b']);
      expect(pendingRefundsCovered({ amountRefundedCents: 1000, refunds })).toEqual(['b', 'c']);
      expect(pendingRefundsCovered({ amountRefundedCents: 300, refunds })).toEqual([]);
    });

    it('estado de Stripe → RefundStatus', () => {
      expect(refundStatusFromGateway('succeeded')).toBe('SUCCEEDED');
      expect(refundStatusFromGateway('pending')).toBe('PENDING');
      expect(refundStatusFromGateway('failed')).toBe('FAILED');
    });
  });

  describe('acciones del plan', () => {
    it('reintentar solo en Cobro fallido / En mora con cuotas fallidas', () => {
      const plan = {
        status: 'PAST_DUE' as const,
        hasFailedInstallments: true,
        enrollmentStatus: 'ACTIVE',
      };
      expect(canPlanAction('RETRY', plan)).toBe(true);
      expect(canPlanAction('RETRY', { ...plan, hasFailedInstallments: false })).toBe(false);
      expect(canPlanAction('RETRY', { ...plan, status: 'CURRENT' })).toBe(false);
    });

    it('suspender solo En mora con inscripción activa; restablecer si está suspendida', () => {
      expect(
        availablePlanActions({
          status: 'DELINQUENT',
          hasFailedInstallments: true,
          enrollmentStatus: 'ACTIVE',
        }),
      ).toEqual(['RETRY', 'SUSPEND_ACCESS', 'CANCEL']);
      expect(
        availablePlanActions({
          status: 'DELINQUENT',
          hasFailedInstallments: true,
          enrollmentStatus: 'SUSPENDED',
        }),
      ).toEqual(['RETRY', 'RESTORE_ACCESS', 'CANCEL']);
      expect(
        canPlanAction('SUSPEND_ACCESS', {
          status: 'PAST_DUE',
          hasFailedInstallments: true,
          enrollmentStatus: 'ACTIVE',
        }),
      ).toBe(false);
    });

    it('mora manual solo desde Cobro fallido; cancelar solo planes no terminados', () => {
      const p = { hasFailedInstallments: false, enrollmentStatus: null };
      expect(canPlanAction('MARK_DELINQUENT', { ...p, status: 'PAST_DUE' })).toBe(true);
      expect(canPlanAction('MARK_DELINQUENT', { ...p, status: 'CURRENT' })).toBe(false);
      expect(canPlanAction('CANCEL', { ...p, status: 'COMPLETED' })).toBe(false);
      expect(canPlanAction('CANCEL', { ...p, status: 'CURRENT' })).toBe(true);
    });
  });

  it('totalsByCurrency nunca suma MXN con USD', () => {
    const totals = totalsByCurrency([
      { currency: 'MXN', amountCents: 1_020_000, refundedCents: 20_000 },
      { currency: 'USD', amountCents: 58_500, refundedCents: 0 },
      { currency: 'MXN', amountCents: 510_000, refundedCents: 0 },
    ]);
    expect(totals).toEqual([
      {
        currency: 'MXN',
        collected: { amountCents: 1_530_000, currency: 'MXN' },
        refunded: { amountCents: 20_000, currency: 'MXN' },
        net: { amountCents: 1_510_000, currency: 'MXN' },
        paymentCount: 2,
      },
      {
        currency: 'USD',
        collected: { amountCents: 58_500, currency: 'USD' },
        refunded: { amountCents: 0, currency: 'USD' },
        net: { amountCents: 58_500, currency: 'USD' },
        paymentCount: 1,
      },
    ]);
  });
});
