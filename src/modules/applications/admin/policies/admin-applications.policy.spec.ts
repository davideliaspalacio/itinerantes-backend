import type { ApplicationStatus } from '../../../../generated/prisma/client';
import {
  applicationRequiresInterview,
  computeFunnel,
  isDueSoon,
  reminderAvailableAt,
  remainingDays,
  renderFollowUpTemplate,
  summarizeEvaluations,
  whatsappNumber,
  whatsappUrl,
} from './admin-applications.policy';

const now = new Date('2026-11-10T12:00:00.000Z');
const hours = (h: number) => new Date(now.getTime() + h * 3600_000);

describe('admin-applications.policy', () => {
  const type = (key: string, name: string, minPercent: number, maxPercent = minPercent) => ({
    id: `st-${key}`,
    key,
    name,
    minPercent,
    maxPercent,
    requiresInterview: maxPercent > 70,
  });
  const aguasLibres = type('AGUAS_LIBRES', 'Aguas Libres', 50);
  const rios = type('RIOS_VIVOS', 'Ríos Vivos', 25);
  const cenotes = type('CENOTES_VIVOS', 'Cenotes Vivos', 70);
  const special = type('SPECIAL', 'Beca especial', 71, 80);

  it('summarizeEvaluations: conteos, tipo más sugerido y texto', () => {
    const s = summarizeEvaluations([
      { recommendation: 'APPROVE', suggestedScholarshipType: aguasLibres },
      { recommendation: 'APPROVE', suggestedScholarshipType: aguasLibres },
      { recommendation: 'UNSURE', suggestedScholarshipType: rios },
    ]);
    expect(s).toMatchObject({ approve: 2, notSelect: 0, unsure: 1, total: 3 });
    expect(s.mostSuggestedScholarshipType).toEqual(aguasLibres);
    expect(s.label).toBe('2 aprobar · 1 con dudas · tipo más sugerido: Aguas Libres 50%');
    expect(summarizeEvaluations([]).label).toBe('Sin evaluaciones');
    expect(
      summarizeEvaluations([{ recommendation: 'APPROVE', suggestedScholarshipType: null }])
        .mostSuggestedScholarshipType,
    ).toBeNull();
  });

  it('summarizeEvaluations: empate → menor porcentaje; beca especial con rango', () => {
    expect(
      summarizeEvaluations([
        { recommendation: 'APPROVE', suggestedScholarshipType: special },
        { recommendation: 'APPROVE', suggestedScholarshipType: cenotes },
      ]).mostSuggestedScholarshipType?.key,
    ).toBe('CENOTES_VIVOS');
    expect(
      summarizeEvaluations([{ recommendation: 'NOT_SELECT', suggestedScholarshipType: special }])
        .label,
    ).toBe('1 no seleccionar · tipo más sugerido: Beca especial 71–80%');
  });

  it('applicationRequiresInterview: convocatoria siempre; beca según requiresInterview del tipo', () => {
    const base = { requestedScholarshipType: null, assignedScholarshipType: null };
    expect(applicationRequiresInterview({ ...base, kind: 'OPEN_CALL' })).toBe(true);
    expect(applicationRequiresInterview({ ...base, kind: 'SCHOLARSHIP' })).toBe(false);
    expect(
      applicationRequiresInterview({
        ...base,
        kind: 'SCHOLARSHIP',
        requestedScholarshipType: special,
      }),
    ).toBe(true);
    expect(
      applicationRequiresInterview({
        ...base,
        kind: 'SCHOLARSHIP',
        requestedScholarshipType: cenotes,
      }),
    ).toBe(false);
    // El asignado manda sobre el solicitado.
    expect(
      applicationRequiresInterview({
        kind: 'SCHOLARSHIP',
        requestedScholarshipType: special,
        assignedScholarshipType: aguasLibres,
      }),
    ).toBe(false);
  });

  it('computeFunnel: 40 → 30 → 24 → 20 = 50%', () => {
    const make = (status: ApplicationStatus, n: number, started = false) =>
      Array.from({ length: n }, () => ({
        status,
        submittedAt: now,
        paymentStartedAt: started ? now : null,
        responseDueAt: status.startsWith('APPROVED') ? hours(24) : null,
      }));
    const apps = [
      ...make('NOT_SELECTED', 6),
      ...make('IN_REVIEW', 4),
      ...make('ENROLLED', 20),
      ...make('APPROVED_PENDING_PAYMENT', 4, true),
      ...make('APPROVED_PENDING_PAYMENT', 3),
      ...make('EXPIRED', 3),
      // Borradores nunca cuentan.
      { status: 'DRAFT' as const, submittedAt: null, paymentStartedAt: null, responseDueAt: null },
    ];
    const f = computeFunnel(apps, now);
    expect(f.stages.map((s) => s.count)).toEqual([40, 30, 24, 20]);
    expect(f.stages.map((s) => s.percentOfApplied)).toEqual([100, 75, 60, 50]);
    expect(f.stages[3].percentOfPrevious).toBe(83);
    expect(f.conversionPercent).toBe(50);
    expect(f).toMatchObject({
      inReview: 4,
      pendingPayment: 7,
      expired: 3,
      notSelected: 6,
      dueSoon: 7,
    });
  });

  it('computeFunnel sin postulaciones → todo en 0', () => {
    const f = computeFunnel([], now);
    expect(f.stages.every((s) => s.count === 0 && s.percentOfApplied === 0)).toBe(true);
    expect(f.conversionPercent).toBe(0);
  });

  it('plazos: días restantes y alerta ≤ 2 días', () => {
    expect(remainingDays(hours(30), now)).toBe(2);
    expect(remainingDays(hours(-30), now)).toBe(-1);
    expect(remainingDays(null, now)).toBeNull();
    expect(isDueSoon(hours(47), now)).toBe(true);
    expect(isDueSoon(hours(49), now)).toBe(false);
    expect(isDueSoon(hours(-1), now)).toBe(false);
  });

  it('recordatorios: máximo 1 cada 24 h', () => {
    expect(reminderAvailableAt(null, now)).toBeNull();
    expect(reminderAvailableAt(hours(-25), now)).toBeNull();
    expect(reminderAvailableAt(hours(-2), now)).toEqual(hours(22));
  });

  it('WhatsApp: teléfono con indicativo y plantilla', () => {
    expect(whatsappNumber({ countryCode: '+52', number: '55 1234-5678' })).toBe('525512345678');
    expect(whatsappNumber({ countryCode: '52', number: '5512345678' })).toBeNull();
    expect(whatsappNumber({ countryCode: '+52', number: '' })).toBeNull();
    expect(whatsappUrl('525512345678', 'Hola Ana')).toBe(
      'https://wa.me/525512345678?text=Hola%20Ana',
    );
    expect(
      renderFollowUpTemplate('Hola {nombre}: {saldo} · {link_pago} {otro}', {
        nombre: 'Ana',
        saldo: '$5,100.00 MXN',
        link_pago: 'https://x/pago',
      }),
    ).toBe('Hola Ana: $5,100.00 MXN · https://x/pago {otro}');
  });
});
