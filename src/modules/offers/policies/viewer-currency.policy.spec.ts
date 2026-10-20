import { isMexicoTimezone, resolveViewerCurrency } from './viewer-currency.policy';

describe('resolveViewerCurrency (HU-15 / Anexo A)', () => {
  it('con sesión manda el país del perfil, aunque la zona sea de otro país', () => {
    expect(resolveViewerCurrency({ profileCountryCode: 'MX', timezone: 'Europe/Madrid' })).toEqual({
      currency: 'MXN',
      source: 'PROFILE',
    });
    expect(
      resolveViewerCurrency({ profileCountryCode: 'CO', timezone: 'America/Mexico_City' }),
    ).toEqual({ currency: 'USD', source: 'PROFILE' });
  });

  it.each([
    ['America/Mexico_City', 'MXN'],
    ['America/Cancun', 'MXN'],
    ['America/Tijuana', 'MXN'],
    ['America/Bogota', 'USD'],
    ['America/Guatemala', 'USD'],
    ['Europe/Madrid', 'USD'],
  ])('sin sesión, zona %s → %s', (timezone, currency) => {
    expect(resolveViewerCurrency({ timezone })).toEqual({ currency, source: 'TIMEZONE' });
  });

  it('zona ausente o inválida → USD por defecto', () => {
    expect(resolveViewerCurrency({})).toEqual({ currency: 'USD', source: 'DEFAULT' });
    expect(resolveViewerCurrency({ timezone: 'Marte/Olympus' })).toEqual({
      currency: 'USD',
      source: 'DEFAULT',
    });
  });

  it('isMexicoTimezone', () => {
    expect(isMexicoTimezone('America/Monterrey')).toBe(true);
    expect(isMexicoTimezone('America/Chicago')).toBe(false);
  });
});
