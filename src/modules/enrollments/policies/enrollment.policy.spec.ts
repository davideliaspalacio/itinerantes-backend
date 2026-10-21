import {
  decideFreeEnrollment,
  deriveFormationPhase,
  type FreeEnrollmentInput,
  hasClassroomAccess,
} from './enrollment.policy';

const now = new Date('2026-11-10T12:00:00Z');
const opensAt = new Date('2026-12-01T06:00:00Z');
const base: FreeEnrollmentInput = {
  type: 'EVENT',
  origin: 'NAS',
  isFree: true,
  availability: 'ENROLLMENT_OPEN',
  enrollmentOpensAt: null,
  soldOut: false,
  existingStatus: null,
};

describe('hasClassroomAccess', () => {
  it.each([
    ['ACTIVE', true],
    ['COMPLETED', true],
    ['SUSPENDED', false],
    ['PENDING_PAYMENT', false],
    ['CANCELLED', false],
    [null, false],
  ] as const)('%s → %s', (status, expected) => {
    expect(hasClassroomAccess(status)).toBe(expected);
  });
});

describe('deriveFormationPhase (HU-07)', () => {
  it('activa mientras la oferta no termina', () => {
    expect(deriveFormationPhase('ACTIVE', new Date('2026-12-01T00:00:00Z'), now)).toBe('ACTIVE');
    expect(deriveFormationPhase('ACTIVE', null, now)).toBe('ACTIVE');
  });
  it('completada si la oferta terminó o el equipo la cerró', () => {
    expect(deriveFormationPhase('ACTIVE', new Date('2026-11-01T00:00:00Z'), now)).toBe('COMPLETED');
    expect(deriveFormationPhase('COMPLETED', null, now)).toBe('COMPLETED');
  });
});

describe('decideFreeEnrollment ([Inscribirme])', () => {
  it('oferta NAS gratuita abierta y con cupo → ok', () => {
    expect(decideFreeEnrollment(base)).toEqual({ ok: true, reactivate: false });
  });

  it('una inscripción cancelada se reactiva', () => {
    expect(decideFreeEnrollment({ ...base, existingStatus: 'CANCELLED' })).toEqual({
      ok: true,
      reactivate: true,
    });
  });

  it.each(['ACTIVE', 'COMPLETED', 'SUSPENDED', 'PENDING_PAYMENT'] as const)(
    'ya inscrita (%s) → ENROLLMENT_ALREADY_EXISTS',
    (existingStatus) => {
      expect(decideFreeEnrollment({ ...base, existingStatus })).toMatchObject({
        ok: false,
        code: 'ENROLLMENT_ALREADY_EXISTS',
        meta: { enrollmentStatus: existingStatus },
      });
    },
  );

  it('de pago, convocatoria o Moodle → ENROLLMENT_NOT_FREE con la acción correcta', () => {
    expect(decideFreeEnrollment({ ...base, isFree: false })).toMatchObject({
      code: 'ENROLLMENT_NOT_FREE',
      meta: { requiredAction: 'ENROLL_AND_PAY' },
    });
    expect(decideFreeEnrollment({ ...base, type: 'OPEN_CALL' })).toMatchObject({
      code: 'ENROLLMENT_NOT_FREE',
      meta: { requiredAction: 'APPLY_OPEN_CALL' },
    });
    expect(decideFreeEnrollment({ ...base, origin: 'MOODLE' })).toMatchObject({
      code: 'ENROLLMENT_NOT_FREE',
      meta: { requiredAction: 'ACTIVATE_MOODLE_ACCESS' },
    });
  });

  it('fuera de la ventana → ENROLLMENT_CLOSED con motivo', () => {
    expect(
      decideFreeEnrollment({ ...base, availability: 'UPCOMING', enrollmentOpensAt: opensAt }),
    ).toEqual({
      ok: false,
      code: 'ENROLLMENT_CLOSED',
      meta: { reason: 'ENROLLMENT_NOT_OPEN_YET', availableFrom: opensAt },
    });
    expect(decideFreeEnrollment({ ...base, availability: 'ENROLLMENT_CLOSED' })).toMatchObject({
      meta: { reason: 'ENROLLMENT_CLOSED' },
    });
    expect(decideFreeEnrollment({ ...base, availability: 'FINISHED' })).toMatchObject({
      meta: { reason: 'OFFER_FINISHED' },
    });
  });

  it('sin cupo → OFFER_SOLD_OUT', () => {
    expect(decideFreeEnrollment({ ...base, soldOut: true })).toMatchObject({
      ok: false,
      code: 'OFFER_SOLD_OUT',
    });
  });
});
