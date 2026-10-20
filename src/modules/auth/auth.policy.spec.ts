import {
  checkRefreshToken,
  evaluateFailedLogin,
  isLoginLocked,
  isValidPassword,
  normalizeEmail,
  normalizeFullName,
  passwordIssues,
  refreshTokenExpiresAt,
} from './auth.policy';

const t0 = new Date('2026-11-07T16:00:00.000Z');

describe('auth.policy', () => {
  describe('contraseña (HU-02)', () => {
    it.each(['abcdefg1', 'Contraseña2026', 'ñandú123', '1234567a'])('acepta %s', (pw) => {
      expect(isValidPassword(pw)).toBe(true);
    });

    it('rechaza menos de 8 caracteres', () => {
      expect(passwordIssues('abc123')).toEqual(['TOO_SHORT']);
    });

    it('exige al menos una letra', () => {
      expect(passwordIssues('12345678')).toEqual(['MISSING_LETTER']);
    });

    it('exige al menos un número', () => {
      expect(passwordIssues('abcdefgh')).toEqual(['MISSING_DIGIT']);
    });

    it('rechaza contraseñas demasiado largas', () => {
      expect(passwordIssues(`a1${'x'.repeat(200)}`)).toContain('TOO_LONG');
    });
  });

  describe('bloqueo de login (HU-04)', () => {
    const rules = { maxAttempts: 5, lockoutMinutes: 15 };

    it('no bloquea antes del máximo', () => {
      expect(evaluateFailedLogin(4, t0, rules)).toEqual({ attempts: 4, lockedUntil: null });
    });

    it('al llegar al máximo bloquea y reinicia el contador', () => {
      const result = evaluateFailedLogin(5, t0, rules);
      expect(result.attempts).toBe(0);
      expect(result.lockedUntil?.toISOString()).toBe('2026-11-07T16:15:00.000Z');
    });

    it('isLoginLocked respeta la hora de desbloqueo', () => {
      const until = new Date('2026-11-07T16:15:00.000Z');
      expect(isLoginLocked(until, t0)).toBe(true);
      expect(isLoginLocked(until, until)).toBe(false);
      expect(isLoginLocked(null, t0)).toBe(false);
    });
  });

  describe('refresh tokens (rotación)', () => {
    const valid = {
      expiresAt: new Date('2026-11-14T16:00:00.000Z'),
      revokedAt: null,
      replacedById: null,
    };

    it('vigente → VALID', () => {
      expect(checkRefreshToken(valid, t0)).toBe('VALID');
    });

    it('inexistente → NOT_FOUND', () => {
      expect(checkRefreshToken(null, t0)).toBe('NOT_FOUND');
    });

    it('vencido → EXPIRED', () => {
      expect(checkRefreshToken(valid, new Date('2026-11-14T16:00:00.000Z'))).toBe('EXPIRED');
    });

    it('ya rotado y reutilizado → REUSED (revocar familia)', () => {
      expect(checkRefreshToken({ ...valid, revokedAt: t0, replacedById: 'x' }, t0)).toBe('REUSED');
    });

    it('revocado por logout → REVOKED', () => {
      expect(checkRefreshToken({ ...valid, revokedAt: t0 }, t0)).toBe('REVOKED');
    });

    it('"recordarme" alarga la vida del refresh', () => {
      const config = { ttlDays: 7, rememberTtlDays: 30 };
      expect(refreshTokenExpiresAt(t0, false, config).toISOString()).toBe(
        '2026-11-14T16:00:00.000Z',
      );
      expect(refreshTokenExpiresAt(t0, true, config).toISOString()).toBe(
        '2026-12-07T16:00:00.000Z',
      );
    });
  });

  describe('normalización', () => {
    it('email en minúsculas y sin espacios', () => {
      expect(normalizeEmail('  Ana.Perez @Correo.COM ')).toBe('ana.perez@correo.com');
    });

    it('nombre con espacios colapsados', () => {
      expect(normalizeFullName('  María   José  Núñez ')).toBe('María José Núñez');
    });
  });
});
