import { cdmxToUtc } from '../../../common/utils/time';
import {
  allowedInstallmentCounts,
  buildInstallmentSchedule,
  formatPaymentFolio,
  installmentOptions,
  offerPriceFor,
  paymentConceptLabel,
} from './payment-amounts.policy';

describe('payment-amounts.policy (HU-22/23/24)', () => {
  const offer = { priceMxnCents: 1_020_000, priceUsdCents: 58_500 };

  it('precio fijo por moneda; sin precio o 0 → null', () => {
    expect(offerPriceFor(offer, 'MXN')).toBe(1_020_000);
    expect(offerPriceFor(offer, 'USD')).toBe(58_500);
    expect(offerPriceFor({ priceMxnCents: 0, priceUsdCents: null }, 'MXN')).toBeNull();
    expect(offerPriceFor({ priceMxnCents: 100, priceUsdCents: null }, 'USD')).toBeNull();
  });

  it('cuotas permitidas: 2..min(4, máximo de la oferta); sin cuotas → []', () => {
    expect(allowedInstallmentCounts({ installmentsEnabled: true, installmentsMax: 3 })).toEqual([
      2, 3,
    ]);
    expect(allowedInstallmentCounts({ installmentsEnabled: true, installmentsMax: 9 })).toEqual([
      2, 3, 4,
    ]);
    expect(allowedInstallmentCounts({ installmentsEnabled: false, installmentsMax: 4 })).toEqual(
      [],
    );
    expect(allowedInstallmentCounts({ installmentsEnabled: true, installmentsMax: null })).toEqual(
      [],
    );
  });

  it('calendario: cuotas iguales mensuales, ajuste en la última, la 1.ª hoy', () => {
    const start = cdmxToUtc('2026-01-31', '10:00');
    const s = buildInstallmentSchedule(1_000_000, 3, start);
    expect(s.map((i) => i.amountCents)).toEqual([333_333, 333_333, 333_334]);
    expect(s.reduce((sum, i) => sum + i.amountCents, 0)).toBe(1_000_000);
    expect(s[0].dueAt).toEqual(start);
    // 31-ene + 1 mes → 28-feb (calendario CDMX)
    expect(s[1].dueAt.toISOString()).toBe(cdmxToUtc('2026-02-28', '10:00').toISOString());
    expect(s[2].dueAt.toISOString()).toBe(cdmxToUtc('2026-03-31', '10:00').toISOString());
  });

  it('ejemplo HU-24: $292.50 USD en 3 = $97.50 USD', () => {
    expect(buildInstallmentSchedule(29_250, 3, new Date()).map((i) => i.amountCents)).toEqual([
      9_750, 9_750, 9_750,
    ]);
  });

  it('opción no disponible si la última cuota cae después del fin de la oferta', () => {
    const now = cdmxToUtc('2026-11-01', '10:00');
    const options = installmentOptions(
      1_020_000,
      { installmentsEnabled: true, installmentsMax: 4, endsAt: cdmxToUtc('2027-01-15', '10:00') },
      now,
    );
    expect(options.map((o) => [o.count, o.available])).toEqual([
      [2, true],
      [3, true],
      [4, false],
    ]);
    expect(options[2].reason).toBe('LAST_INSTALLMENT_AFTER_END');
  });

  it('folio y conceptos', () => {
    expect(formatPaymentFolio(123)).toBe('PAG-000123');
    expect(paymentConceptLabel({ concept: 'FULL_PRICE' })).toBe('Pago completo');
    expect(paymentConceptLabel({ concept: 'BALANCE', applicationKind: 'SCHOLARSHIP' })).toBe(
      'Saldo tras beca',
    );
    expect(paymentConceptLabel({ concept: 'BALANCE', applicationKind: 'OPEN_CALL' })).toBe(
      'Pago de convocatoria',
    );
    expect(
      paymentConceptLabel({ concept: 'INSTALLMENT', installment: { sequence: 2, count: 3 } }),
    ).toBe('Cuota 2 de 3');
  });
});
