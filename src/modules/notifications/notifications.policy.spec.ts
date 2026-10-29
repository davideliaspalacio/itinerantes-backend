import {
  defaultPriority,
  frontendLink,
  isPinnedOnCreate,
  NOTIFICATION_CATEGORY_BY_TYPE,
  shouldEmail,
} from './notifications.policy';

describe('notifications.policy (HU-13)', () => {
  it('agrupa por categoría', () => {
    expect(NOTIFICATION_CATEGORY_BY_TYPE.ATTENDANCE_OPEN).toBe('TRAINING');
    expect(NOTIFICATION_CATEGORY_BY_TYPE.SCHOLARSHIP_APPROVED).toBe('APPLICATIONS');
    expect(NOTIFICATION_CATEGORY_BY_TYPE.INSTALLMENT_FAILED).toBe('PAYMENTS');
  });

  it('cobro fallido y mora: prioridad alta y fijadas', () => {
    expect(defaultPriority('INSTALLMENT_FAILED')).toBe('HIGH');
    expect(defaultPriority('PLAN_DELINQUENT')).toBe('HIGH');
    expect(defaultPriority('ATTENDANCE_OPEN')).toBe('NORMAL');
    expect(isPinnedOnCreate('HIGH')).toBe(true);
    expect(isPinnedOnCreate('NORMAL')).toBe(false);
  });

  it('correo por defecto, salvo los solo-portal', () => {
    expect(shouldEmail(undefined)).toBe(true);
    expect(shouldEmail(true)).toBe(true);
    expect(shouldEmail({ subject: 'x' })).toBe(true);
    expect(shouldEmail(false)).toBe(false);
  });

  it('arma el enlace del frontend', () => {
    expect(frontendLink('https://eia.mx/', '/aula/1')).toBe('https://eia.mx/aula/1');
    expect(frontendLink('https://eia.mx', 'portal')).toBe('https://eia.mx/portal');
  });
});
