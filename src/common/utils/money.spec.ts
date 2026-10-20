import {
  addMoney,
  currencyForCountry,
  applyPercentDiscount,
  formatMoney,
  fromCents,
  money,
  percentOf,
  splitInstallments,
  subtractMoney,
  toCents,
} from './money';

describe('money utils', () => {
  it('toCents sin errores de punto flotante', () => {
    expect(toCents('10200')).toBe(1020000);
    expect(toCents('10200.5')).toBe(1020050);
    expect(toCents('0.29')).toBe(29);
    expect(toCents(19.99)).toBe(1999);
    expect(toCents('-5.10')).toBe(-510);
    expect(() => toCents('1.234')).toThrow();
    expect(() => toCents('abc')).toThrow();
  });

  it('fromCents', () => {
    expect(fromCents(1020050)).toBe('10200.50');
    expect(fromCents(5)).toBe('0.05');
    expect(fromCents(-510)).toBe('-5.10');
  });

  it('money exige enteros', () => {
    expect(money(100, 'MXN')).toEqual({ amountCents: 100, currency: 'MXN' });
    expect(() => money(1.5, 'MXN')).toThrow();
  });

  it('addMoney / subtractMoney no mezclan monedas', () => {
    expect(addMoney(money(100, 'USD'), money(250, 'USD'))).toEqual(money(350, 'USD'));
    expect(subtractMoney(money(500, 'MXN'), money(200, 'MXN'))).toEqual(money(300, 'MXN'));
    expect(() => addMoney(money(100, 'MXN'), money(100, 'USD'))).toThrow(/MXN y USD/);
  });

  it('beca Aguas Libres 50% sobre 10,200 MXN → saldo 5,100 MXN (HU-31)', () => {
    expect(percentOf(1020000, 50)).toBe(510000);
    expect(applyPercentDiscount(1020000, 50)).toBe(510000);
    expect(applyPercentDiscount(1020000, 25)).toBe(765000);
  });

  it('splitInstallments: cuotas iguales, centavos de ajuste en la última (HU-24)', () => {
    expect(splitInstallments(1000000, 3)).toEqual([333333, 333333, 333334]);
    expect(splitInstallments(510000, 2)).toEqual([255000, 255000]);
    expect(splitInstallments(100, 4).reduce((a, b) => a + b, 0)).toBe(100);
    expect(() => splitInstallments(100, 0)).toThrow();
  });

  it('formatMoney', () => {
    expect(formatMoney(money(1020000, 'MXN'))).toBe('$10,200.00 MXN');
  });
});

describe('currencyForCountry (HU-14)', () => {
  it('México paga en MXN', () => {
    expect(currencyForCountry('MX')).toBe('MXN');
    expect(currencyForCountry('mx')).toBe('MXN');
  });

  it('el resto de países paga en USD', () => {
    expect(currencyForCountry('CO')).toBe('USD');
    expect(currencyForCountry('ES')).toBe('USD');
    expect(currencyForCountry(undefined)).toBe('USD');
  });
});
