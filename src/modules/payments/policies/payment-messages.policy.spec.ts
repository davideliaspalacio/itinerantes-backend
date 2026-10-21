import {
  installmentFailedMessage,
  paymentConfirmedMessage,
  planDelinquentMessage,
  transferRejectedMessage,
} from './payment-messages.policy';

describe('payment-messages.policy (HU-13)', () => {
  it('pago confirmado con folio, monto y acceso al aula', () => {
    const m = paymentConfirmedMessage({
      offerId: 'o1',
      offerName: 'Diplomado',
      folio: 'PAG-000001',
      concept: 'Pago completo',
      amount: { amountCents: 1_020_000, currency: 'MXN' },
      enrolled: true,
    });
    expect(m.type).toBe('PAYMENT_CONFIRMED');
    expect(m.body).toContain('$10,200.00 MXN');
    expect(m.body).toContain('PAG-000001');
    expect(m.action.path).toBe('/portal/aula/o1');
  });

  it('cobro fallido con reintento y actualización de tarjeta', () => {
    const m = installmentFailedMessage({
      offerName: 'Diplomado',
      sequence: 2,
      count: 3,
      amount: { amountCents: 9_750, currency: 'USD' },
      nextRetryAt: new Date('2026-12-04T16:00:00Z'),
      failureMessage: 'Fondos insuficientes',
      timezone: 'America/Mexico_City',
    });
    expect(m.type).toBe('INSTALLMENT_FAILED');
    expect(m.body).toContain('4/12/2026');
    expect(m.action.label).toBe('Actualizar tarjeta');
  });

  it('mora y transferencia rechazada', () => {
    expect(
      planDelinquentMessage({
        offerName: 'X',
        pending: { amountCents: 100, currency: 'MXN' },
        accessSuspended: true,
      }).body,
    ).toContain('suspendido');
    const r = transferRejectedMessage({
      applicationId: 'a1',
      offerName: 'X',
      reason: 'AMOUNT_MISMATCH',
      note: null,
      dueAt: null,
    });
    expect(r.body).toContain('El monto no coincide');
    expect(r.action.path).toBe('/portal/postulaciones/a1/pago');
  });
});
