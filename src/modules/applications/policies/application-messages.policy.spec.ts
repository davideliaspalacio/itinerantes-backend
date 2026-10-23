import {
  type ApplicationMessageContext,
  balanceReminderMessage,
  dualTime,
  interviewReminderMessage,
  statusChangeMessage,
} from './application-messages.policy';

const ctx: ApplicationMessageContext = {
  applicationId: 'app-1',
  kind: 'SCHOLARSHIP',
  folio: 'BEC-000123',
  offer: { id: 'offer-1', name: 'Diplomado en Ecotecnologías del Agua' },
  userTimezone: 'America/Bogota',
  requestedScholarshipType: { name: 'Aguas Libres', requiresInterview: false },
  assignedScholarshipTypeName: 'Aguas Libres',
  assignedPercent: 50,
  balance: { amountCents: 510_000, currency: 'MXN' },
  responseDueAt: new Date('2026-10-28T18:00:00Z'),
  interview: { startsAt: new Date('2026-11-12T16:00:00Z') },
};

describe('mensajes de postulaciones (HU-13 / HU-21)', () => {
  it('hora local + CDMX', () => {
    expect(dualTime(new Date('2026-11-12T16:00:00Z'), 'America/Bogota')).toBe(
      '12/11/2026 a las 11:00 (tu hora) · 10:00 hora CDMX',
    );
    expect(dualTime(new Date('2026-11-12T16:00:00Z'), 'America/Mexico_City')).toBe(
      '12/11/2026 a las 10:00 hora CDMX',
    );
  });

  it('enviada: folio y estado con el mismo nombre de "Mis postulaciones"', () => {
    const message = statusChangeMessage('SUBMITTED', ctx)!;
    expect(message.type).toBe('APPLICATION_SUBMITTED');
    expect(message.body).toContain('BEC-000123');
    expect(message.body).toContain('Estado: Enviada');
    expect(message.action).toEqual({
      label: 'Ver mi postulación',
      path: '/portal/postulaciones/app-1',
    });
    expect(statusChangeMessage('SUBMITTED', { ...ctx, kind: 'OPEN_CALL' })!.body).toContain(
      'entrevista por Zoom',
    );
    expect(statusChangeMessage('SUBMITTED', ctx)!.body).not.toContain('entrevista');
    expect(
      statusChangeMessage('SUBMITTED', {
        ...ctx,
        requestedScholarshipType: { name: 'Beca especial', requiresInterview: true },
      })!.body,
    ).toContain('Solicitaste Beca especial: el proceso incluye una entrevista por Zoom.');
  });

  it('"En revisión" solo en portal (sin correo)', () => {
    expect(statusChangeMessage('IN_REVIEW', ctx)).toMatchObject({
      type: 'APPLICATION_STATUS_CHANGED',
      email: false,
    });
    expect(statusChangeMessage('SUBMITTED', ctx)!.email).toBeUndefined();
  });

  it('beca aprobada: tipo, %, saldo, plazo y Pagar saldo', () => {
    const message = statusChangeMessage('APPROVED_PENDING_PAYMENT', ctx)!;
    expect(message.type).toBe('SCHOLARSHIP_APPROVED');
    expect(message.body).toContain('Aguas Libres (50%)');
    expect(message.body).toContain('$5,100.00 MXN');
    expect(message.body).toContain('28/10/2026');
    expect(message.action).toEqual({
      label: 'Pagar saldo',
      path: '/portal/postulaciones/app-1/pago',
    });
  });

  it('confirmación, inscrita, no seleccionada y vencida', () => {
    expect(
      statusChangeMessage('APPROVED_PENDING_CONFIRMATION', { ...ctx, balance: null })!.action,
    ).toMatchObject({ label: 'Confirmar mi participación' });
    expect(statusChangeMessage('ENROLLED', ctx)!.action).toEqual({
      label: 'Ir a mi aula',
      path: '/portal/aula/offer-1',
    });
    expect(statusChangeMessage('NOT_SELECTED', ctx)!.body).toContain('No seleccionada');
    const expired = statusChangeMessage('EXPIRED', ctx)!;
    expect(expired.type).toBe('APPLICATION_EXPIRED');
    expect(expired.body).toContain('pagar el saldo');
    expect(statusChangeMessage('DRAFT', ctx)).toBeNull();
  });

  it('entrevista y recordatorios', () => {
    const scheduled = statusChangeMessage('INTERVIEW_SCHEDULED', ctx)!;
    expect(scheduled.type).toBe('INTERVIEW_SCHEDULED');
    expect(scheduled.body).toContain('11:00 (tu hora) · 10:00 hora CDMX');
    expect(interviewReminderMessage(ctx).type).toBe('INTERVIEW_REMINDER');
    const reminder = balanceReminderMessage(ctx);
    expect(reminder.type).toBe('BALANCE_DUE_REMINDER');
    expect(reminder.body).toContain('$5,100.00 MXN');
  });
});
