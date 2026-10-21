import type { ApplicationStatus } from '../../../generated/prisma/client';
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_TRANSITIONS,
  buildTimeline,
  canTransition,
  contextualAction,
  isEditable,
  requiresAction,
  type TimelineInput,
} from './application-status.policy';

const ALL: ApplicationStatus[] = Object.keys(APPLICATION_TRANSITIONS) as ApplicationStatus[];

describe('máquina de estados de la postulación', () => {
  it('el participante solo envía su borrador y confirma su participación', () => {
    const allowed = ALL.flatMap((from) =>
      ALL.filter((to) => canTransition(from, to, 'PARTICIPANT')).map((to) => `${from}→${to}`),
    );
    expect(allowed).toEqual(['DRAFT→SUBMITTED', 'APPROVED_PENDING_CONFIRMATION→ENROLLED']);
  });

  it('el sistema solo inscribe tras el pago y vence aprobadas', () => {
    const allowed = ALL.flatMap((from) =>
      ALL.filter((to) => canTransition(from, to, 'SYSTEM')).map((to) => `${from}→${to}`),
    );
    expect(allowed).toEqual([
      'APPROVED_PENDING_PAYMENT→ENROLLED',
      'APPROVED_PENDING_PAYMENT→EXPIRED',
      'APPROVED_PENDING_CONFIRMATION→EXPIRED',
    ]);
  });

  it('el equipo revisa, entrevista y decide (HU-31) y reactiva vencidas (HU-32)', () => {
    expect(canTransition('SUBMITTED', 'IN_REVIEW', 'STAFF')).toBe(true);
    expect(canTransition('IN_REVIEW', 'INTERVIEW_SCHEDULED', 'STAFF')).toBe(true);
    expect(canTransition('INTERVIEW_SCHEDULED', 'APPROVED_PENDING_PAYMENT', 'STAFF')).toBe(true);
    expect(canTransition('SUBMITTED', 'NOT_SELECTED', 'STAFF')).toBe(true);
    expect(canTransition('INTERVIEW_SCHEDULED', 'IN_REVIEW', 'STAFF')).toBe(true);
    expect(canTransition('EXPIRED', 'APPROVED_PENDING_PAYMENT', 'STAFF')).toBe(true);
    // No puede saltarse el envío ni tocar estados finales.
    expect(canTransition('DRAFT', 'IN_REVIEW', 'STAFF')).toBe(false);
    expect(canTransition('DRAFT', 'SUBMITTED', 'STAFF')).toBe(false);
    expect(canTransition('ENROLLED', 'NOT_SELECTED', 'STAFF')).toBe(false);
    expect(canTransition('NOT_SELECTED', 'APPROVED_PENDING_PAYMENT', 'STAFF')).toBe(false);
    // Vencer es del sistema (job), no del equipo.
    expect(canTransition('APPROVED_PENDING_PAYMENT', 'EXPIRED', 'STAFF')).toBe(false);
  });

  it('ENROLLED y NOT_SELECTED no tienen salidas', () => {
    expect(APPLICATION_TRANSITIONS.ENROLLED).toEqual({});
    expect(APPLICATION_TRANSITIONS.NOT_SELECTED).toEqual({});
  });

  it('solo el borrador es editable; requieren acción entrevista, pago y confirmación', () => {
    expect(ALL.filter(isEditable)).toEqual(['DRAFT']);
    expect(ALL.filter(requiresAction)).toEqual([
      'INTERVIEW_SCHEDULED',
      'APPROVED_PENDING_PAYMENT',
      'APPROVED_PENDING_CONFIRMATION',
    ]);
  });

  it('textos de HU-21', () => {
    expect(APPLICATION_STATUS_LABELS.APPROVED_PENDING_PAYMENT).toBe('Aprobada – pendiente de pago');
    expect(APPLICATION_STATUS_LABELS.EXPIRED).toBe('Vencida');
    expect(APPLICATION_STATUS_LABELS.ENROLLED).toBe('Inscrita');
  });
});

describe('contextualAction (HU-21)', () => {
  const due = new Date('2026-11-14T05:59:00Z');
  const base = { windowOpen: true, responseDueAt: null, interview: null };

  it('borrador: Continuar (deshabilitado si cerró la convocatoria)', () => {
    expect(contextualAction({ ...base, status: 'DRAFT' })).toEqual({
      type: 'CONTINUE_DRAFT',
      enabled: true,
      reason: null,
      dueAt: null,
    });
    expect(contextualAction({ ...base, status: 'DRAFT', windowOpen: false })).toMatchObject({
      enabled: false,
      reason: 'WINDOW_CLOSED',
    });
  });

  it('entrevista: habilitada solo con el enlace abierto', () => {
    const startsAt = new Date('2026-11-12T16:00:00Z');
    const at = (joinState: string) =>
      contextualAction({
        ...base,
        status: 'INTERVIEW_SCHEDULED',
        interview: { startsAt, joinState },
      });
    expect(at('OPEN')).toEqual({
      type: 'JOIN_INTERVIEW',
      enabled: true,
      reason: null,
      dueAt: startsAt,
    });
    expect(at('NOT_YET')).toMatchObject({ enabled: false, reason: 'INTERVIEW_NOT_OPEN_YET' });
    expect(at('LINK_PENDING')).toMatchObject({ reason: 'INTERVIEW_LINK_PENDING' });
    expect(at('ENDED')).toMatchObject({ reason: 'INTERVIEW_ENDED' });
  });

  it('aprobada: Pagar saldo / Confirmar con fecha límite; inscrita: Ir a mi aula', () => {
    expect(
      contextualAction({ ...base, status: 'APPROVED_PENDING_PAYMENT', responseDueAt: due }),
    ).toEqual({ type: 'PAY_BALANCE', enabled: true, reason: null, dueAt: due });
    expect(
      contextualAction({ ...base, status: 'APPROVED_PENDING_CONFIRMATION', responseDueAt: due }),
    ).toMatchObject({ type: 'CONFIRM_PARTICIPATION', dueAt: due });
    expect(contextualAction({ ...base, status: 'ENROLLED' }).type).toBe('GO_TO_CLASSROOM');
    for (const status of ['SUBMITTED', 'IN_REVIEW', 'NOT_SELECTED', 'EXPIRED'] as const) {
      expect(contextualAction({ ...base, status }).type).toBe('VIEW');
    }
  });
});

describe('buildTimeline (HU-21)', () => {
  const t = (iso: string) => new Date(iso);
  const steps = (input: TimelineInput) => buildTimeline(input).map((s) => `${s.key}:${s.state}`);
  const base: TimelineInput = {
    kind: 'SCHOLARSHIP',
    status: 'SUBMITTED',
    history: [{ toStatus: 'SUBMITTED', at: t('2026-10-21T10:00:00Z') }],
    interviewRequired: false,
    responseKind: 'PAYMENT',
  };

  it('enviada: Enviada hecha, En revisión actual, sin paso de entrevista', () => {
    expect(steps(base)).toEqual([
      'SUBMITTED:DONE',
      'IN_REVIEW:CURRENT',
      'RESULT:UPCOMING',
      'PAYMENT:UPCOMING',
      'ENROLLED:UPCOMING',
    ]);
    expect(buildTimeline(base)[0].at).toEqual(t('2026-10-21T10:00:00Z'));
  });

  it('borrador: todo pendiente', () => {
    expect(
      steps({ ...base, status: 'DRAFT', history: [] }).every((s) => s.endsWith(':UPCOMING')),
    ).toBe(true);
  });

  it('convocatoria con entrevista agendada', () => {
    expect(
      steps({
        ...base,
        kind: 'OPEN_CALL',
        status: 'INTERVIEW_SCHEDULED',
        interviewRequired: true,
        responseKind: 'CONFIRMATION',
        history: [
          { toStatus: 'SUBMITTED', at: t('2026-10-21T10:00:00Z') },
          { toStatus: 'IN_REVIEW', at: t('2026-10-22T10:00:00Z') },
          { toStatus: 'INTERVIEW_SCHEDULED', at: t('2026-10-23T10:00:00Z') },
        ],
      }),
    ).toEqual([
      'SUBMITTED:DONE',
      'IN_REVIEW:DONE',
      'INTERVIEW:CURRENT',
      'RESULT:UPCOMING',
      'CONFIRMATION:UPCOMING',
      'ENROLLED:UPCOMING',
    ]);
  });

  it('aprobada con saldo: Resultado hecho y Pago actual (decisión sin "En revisión")', () => {
    const timeline = buildTimeline({
      ...base,
      status: 'APPROVED_PENDING_PAYMENT',
      history: [
        { toStatus: 'SUBMITTED', at: t('2026-10-21T10:00:00Z') },
        { toStatus: 'APPROVED_PENDING_PAYMENT', at: t('2026-10-25T10:00:00Z') },
      ],
    });
    expect(timeline.map((s) => `${s.key}:${s.state}`)).toEqual([
      'SUBMITTED:DONE',
      'IN_REVIEW:DONE',
      'RESULT:DONE',
      'PAYMENT:CURRENT',
      'ENROLLED:UPCOMING',
    ]);
    expect(timeline[1].at).toBeNull();
    expect(timeline[2].at).toEqual(t('2026-10-25T10:00:00Z'));
  });

  it('no seleccionada sin entrevista: Resultado fallido y el resto omitido', () => {
    expect(
      steps({
        ...base,
        status: 'NOT_SELECTED',
        interviewRequired: true,
        history: [
          { toStatus: 'SUBMITTED', at: t('2026-10-21T10:00:00Z') },
          { toStatus: 'IN_REVIEW', at: t('2026-10-22T10:00:00Z') },
          { toStatus: 'NOT_SELECTED', at: t('2026-10-23T10:00:00Z') },
        ],
      }),
    ).toEqual([
      'SUBMITTED:DONE',
      'IN_REVIEW:DONE',
      'INTERVIEW:SKIPPED',
      'RESULT:FAILED',
      'PAYMENT:SKIPPED',
      'ENROLLED:SKIPPED',
    ]);
  });

  it('vencida: Pago fallido; inscrita: todo hecho', () => {
    const history = [
      { toStatus: 'SUBMITTED' as const, at: t('2026-10-21T10:00:00Z') },
      { toStatus: 'APPROVED_PENDING_PAYMENT' as const, at: t('2026-10-25T10:00:00Z') },
    ];
    expect(steps({ ...base, status: 'EXPIRED', history })).toEqual([
      'SUBMITTED:DONE',
      'IN_REVIEW:DONE',
      'RESULT:DONE',
      'PAYMENT:FAILED',
      'ENROLLED:SKIPPED',
    ]);
    expect(
      steps({
        ...base,
        status: 'ENROLLED',
        history: [...history, { toStatus: 'ENROLLED', at: t('2026-10-27T10:00:00Z') }],
      }).every((s) => s.endsWith(':DONE')),
    ).toBe(true);
  });
});
