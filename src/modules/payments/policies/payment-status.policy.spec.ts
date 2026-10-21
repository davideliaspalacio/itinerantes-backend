import {
  canTransitionPayment,
  canTransitionPlan,
  hasReceipt,
  paymentStatusesBefore,
  paymentStatusLabel,
  planStatusAfterInstallmentPaid,
} from './payment-status.policy';

describe('payment-status.policy (máquinas de estado)', () => {
  it('tarjeta: un pago PAID no retrocede por eventos fuera de orden', () => {
    expect(canTransitionPayment('PENDING', 'PAID')).toBe(true);
    expect(canTransitionPayment('PAID', 'CANCELLED')).toBe(false); // expired tras completed
    expect(canTransitionPayment('PAID', 'FAILED')).toBe(false);
    expect(canTransitionPayment('FAILED', 'PAID')).toBe(true); // reintento exitoso
    expect(canTransitionPayment('CANCELLED', 'PAID')).toBe(true); // cobro tardío
    expect(canTransitionPayment('PAID', 'REFUNDED')).toBe(true);
    expect(paymentStatusesBefore('PAID').sort()).toEqual(['CANCELLED', 'FAILED', 'PENDING']);
  });

  it('transferencia: pendiente → validada o rechazada (final)', () => {
    expect(canTransitionPayment('PENDING_VALIDATION', 'VALIDATED')).toBe(true);
    expect(canTransitionPayment('PENDING_VALIDATION', 'REJECTED')).toBe(true);
    expect(canTransitionPayment('REJECTED', 'VALIDATED')).toBe(false);
  });

  it('comprobante solo para Pagado o Validada', () => {
    expect(hasReceipt('PAID')).toBe(true);
    expect(hasReceipt('VALIDATED')).toBe(true);
    expect(hasReceipt('PENDING_VALIDATION')).toBe(false);
    expect(hasReceipt('REFUNDED')).toBe(false);
    expect(paymentStatusLabel('VALIDATED', 'BANK_TRANSFER')).toBe('Validada');
    expect(paymentStatusLabel('FAILED', 'CARD')).toBe('Fallido');
  });

  it('plan: transiciones permitidas', () => {
    expect(canTransitionPlan('PENDING_ACTIVATION', 'CURRENT')).toBe(true);
    expect(canTransitionPlan('CURRENT', 'DELINQUENT')).toBe(false); // primero "Cobro fallido"
    expect(canTransitionPlan('PAST_DUE', 'DELINQUENT')).toBe(true);
    expect(canTransitionPlan('DELINQUENT', 'CURRENT')).toBe(true);
    expect(canTransitionPlan('COMPLETED', 'CURRENT')).toBe(false);
  });

  it('estado tras pagar una cuota', () => {
    const s = (...statuses: Array<'PAID' | 'SCHEDULED' | 'FAILED'>) =>
      statuses.map((status) => ({ status }));
    expect(planStatusAfterInstallmentPaid('PENDING_ACTIVATION', s('PAID', 'SCHEDULED'))).toBe(
      'CURRENT',
    );
    expect(planStatusAfterInstallmentPaid('PAST_DUE', s('PAID', 'PAID', 'SCHEDULED'))).toBe(
      'CURRENT',
    );
    expect(planStatusAfterInstallmentPaid('DELINQUENT', s('PAID', 'FAILED', 'SCHEDULED'))).toBe(
      'DELINQUENT',
    );
    expect(planStatusAfterInstallmentPaid('CURRENT', s('PAID', 'PAID'))).toBe('COMPLETED');
  });
});
