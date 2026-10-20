import {
  checkOtpUsability,
  decideIssue,
  evaluateFailedAttempt,
  OtpRules,
  OtpState,
  otpExpiresAt,
  resendAvailableAt,
} from './otp.policy';

const rules: OtpRules = {
  length: 6,
  ttlMinutes: 10,
  cooldownSeconds: 30,
  maxAttempts: 5,
  lockoutMinutes: 15,
};
const t0 = new Date('2026-11-07T16:00:00.000Z');
const plus = (ms: number) => new Date(t0.getTime() + ms);

function otp(overrides: Partial<OtpState> = {}): OtpState {
  return {
    createdAt: t0,
    expiresAt: otpExpiresAt(t0, rules),
    attempts: 0,
    lockedUntil: null,
    verifiedAt: null,
    consumedAt: null,
    invalidatedAt: null,
    ...overrides,
  };
}

describe('otp.policy', () => {
  describe('expiración', () => {
    it('expira tras ttlMinutes', () => {
      expect(otpExpiresAt(t0, rules).toISOString()).toBe('2026-11-07T16:10:00.000Z');
    });

    it('vigente antes de expirar, EXPIRED después', () => {
      expect(checkOtpUsability(otp(), plus(9 * 60_000))).toEqual({ status: 'USABLE' });
      expect(checkOtpUsability(otp(), plus(10 * 60_000))).toEqual({ status: 'EXPIRED' });
    });

    it('sin código, usado o invalidado → NONE', () => {
      expect(checkOtpUsability(null, t0).status).toBe('NONE');
      expect(checkOtpUsability(otp({ consumedAt: t0 }), t0).status).toBe('NONE');
      expect(checkOtpUsability(otp({ invalidatedAt: t0 }), t0).status).toBe('NONE');
      expect(checkOtpUsability(otp({ verifiedAt: t0 }), t0).status).toBe('NONE');
    });
  });

  describe('intentos y bloqueo', () => {
    it('cuenta intentos restantes hasta el máximo', () => {
      expect(evaluateFailedAttempt(1, t0, rules)).toEqual({
        locked: false,
        attempts: 1,
        attemptsRemaining: 4,
      });
      expect(evaluateFailedAttempt(4, t0, rules)).toMatchObject({ attemptsRemaining: 1 });
    });

    it('al agotar intentos bloquea lockoutMinutes', () => {
      const outcome = evaluateFailedAttempt(5, t0, rules);
      expect(outcome.locked).toBe(true);
      expect(outcome.locked && outcome.lockedUntil.toISOString()).toBe('2026-11-07T16:15:00.000Z');
    });

    it('un código bloqueado no se puede verificar mientras dure el bloqueo', () => {
      const locked = otp({ lockedUntil: plus(15 * 60_000), invalidatedAt: t0, attempts: 5 });
      expect(checkOtpUsability(locked, plus(60_000))).toMatchObject({ status: 'LOCKED' });
      expect(checkOtpUsability(locked, plus(16 * 60_000))).toEqual({ status: 'NONE' });
    });
  });

  describe('reenvío (cooldown)', () => {
    it('reenvío disponible tras cooldownSeconds', () => {
      expect(resendAvailableAt(t0, rules).toISOString()).toBe('2026-11-07T16:00:30.000Z');
    });

    it('primer envío siempre permitido', () => {
      expect(decideIssue(null, t0, rules)).toEqual({ allowed: true, carriedAttempts: 0 });
    });

    it('dentro del cooldown → COOLDOWN con la hora de disponibilidad', () => {
      const decision = decideIssue(otp(), plus(10_000), rules);
      expect(decision).toEqual({ allowed: false, reason: 'COOLDOWN', until: plus(30_000) });
    });

    it('tras el cooldown se permite y arrastra los intentos fallidos', () => {
      expect(decideIssue(otp({ attempts: 3 }), plus(31_000), rules)).toEqual({
        allowed: true,
        carriedAttempts: 3,
      });
    });

    it('bloqueado → no se puede reenviar hasta que termine el bloqueo', () => {
      const locked = otp({ attempts: 5, lockedUntil: plus(15 * 60_000), invalidatedAt: t0 });
      expect(decideIssue(locked, plus(60_000), rules)).toMatchObject({
        allowed: false,
        reason: 'LOCKED',
      });
      // Bloqueo cumplido: se reinician los intentos.
      expect(decideIssue(locked, plus(16 * 60_000), rules)).toEqual({
        allowed: true,
        carriedAttempts: 0,
      });
    });

    it('un código usado con éxito no arrastra intentos', () => {
      expect(decideIssue(otp({ attempts: 2, consumedAt: t0 }), plus(60_000), rules)).toEqual({
        allowed: true,
        carriedAttempts: 0,
      });
    });
  });
});
