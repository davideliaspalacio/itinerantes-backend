/**
 * Datos DEMO de la Fase 04 (postulaciones) del usuario demo `participante@example.com`. Nunca con
 * NODE_ENV=production (el usuario demo no existe ahí). Se crean solo si no existen (por persona y
 * oferta): el seed nunca pisa cambios hechos desde el portal.
 */
import type { ApplicationStatus, Prisma } from '../../src/generated/prisma/client';
import { cdmxToUtc } from '../../src/common/utils/time';

const repeat = (text: string, minLength: number) => {
  let out = text;
  while (out.length < minLength) out = `${out} ${text}`;
  return out;
};

export interface DemoApplication {
  offerSlug: string;
  data: Omit<
    Prisma.ApplicationUncheckedCreateInput,
    | 'userId'
    | 'offerId'
    | 'applicantName'
    | 'applicantEmail'
    | 'phoneCountryCode'
    | 'phoneNumber'
    | 'countryCode'
    | 'divisionName'
    | 'municipalityName'
  >;
  /** Keys de `scholarship_types` (se resuelven a ids al sembrar). */
  requestedScholarshipTypeKey?: string;
  assignedScholarshipTypeKey?: string;
  /** Historial de estados (en orden). */
  history: Array<{ status: ApplicationStatus; at: Date; actor: 'PARTICIPANT' | 'STAFF' }>;
  interview?: { startsAt: Date; endsAt: Date; joinUrl: string };
  /** Inscripción reservada por la postulación (saldo pendiente: Fase 05). */
  enrollment?: { status: 'PENDING_PAYMENT'; source: 'SCHOLARSHIP' | 'OPEN_CALL' };
}

export const DEMO_APPLICATIONS: DemoApplication[] = [
  {
    // Beca aprobada (Aguas Libres 50%): "Pagar saldo" 5,100 MXN. Plazo extendido por el equipo para
    // que la demo no venza (HU-32).
    offerSlug: 'diplomado-gestion-comunitaria-del-agua-2027',
    data: {
      kind: 'SCHOLARSHIP',
      status: 'APPROVED_PENDING_PAYMENT',
      statusChangedAt: cdmxToUtc('2026-10-18', '12:00'),
      age: 34,
      intentLetter: repeat(
        'Coordino el comité de agua de mi comunidad y no puedo cubrir el costo completo del diplomado. ' +
          'Con lo aprendido quiero ordenar la gestión del sistema, definir tarifas justas y formar a ' +
          'más personas jóvenes para que el comité tenga relevo.',
        820,
      ),
      evidenceLinks: ['https://www.youtube.com/watch?v=demo-comite-de-agua'],
      termsAcceptedAt: cdmxToUtc('2026-10-05', '11:00'),
      currency: 'MXN',
      originalAmountCents: 1_020_000,
      assignedPercent: 50,
      balanceCents: 510_000,
      responseDueAt: cdmxToUtc('2027-01-29', '23:59'),
      submittedAt: cdmxToUtc('2026-10-05', '11:00'),
      reviewStartedAt: cdmxToUtc('2026-10-06', '09:00'),
      decidedAt: cdmxToUtc('2026-10-18', '12:00'),
    },
    requestedScholarshipTypeKey: 'AGUAS_LIBRES',
    assignedScholarshipTypeKey: 'AGUAS_LIBRES',
    history: [
      { status: 'DRAFT', at: cdmxToUtc('2026-10-04', '18:00'), actor: 'PARTICIPANT' },
      { status: 'SUBMITTED', at: cdmxToUtc('2026-10-05', '11:00'), actor: 'PARTICIPANT' },
      { status: 'IN_REVIEW', at: cdmxToUtc('2026-10-06', '09:00'), actor: 'STAFF' },
      { status: 'APPROVED_PENDING_PAYMENT', at: cdmxToUtc('2026-10-18', '12:00'), actor: 'STAFF' },
    ],
    enrollment: { status: 'PENDING_PAYMENT', source: 'SCHOLARSHIP' },
  },
  {
    // Convocatoria con entrevista por Zoom agendada.
    offerSlug: 'aprendices-del-agua-2027',
    data: {
      kind: 'OPEN_CALL',
      status: 'INTERVIEW_SCHEDULED',
      statusChangedAt: cdmxToUtc('2026-10-14', '10:00'),
      organization: 'Colectivo Agua Viva de la Sierra',
      organizationRole: 'Promotora comunitaria',
      eligibilityConfirmed: true,
      experience: repeat(
        'Desde 2022 acompaño la construcción de cisternas de ferrocemento y huertos con riego por ' +
          'goteo en escuelas rurales de la sierra.',
        320,
      ),
      motivation: repeat(
        'Quiero aprender a construir ecotecnologías en equipo para replicarlas con las juventudes ' +
          'de mi colectivo y sumar a más comunidades.',
        320,
      ),
      canTravel: true,
      evidenceLinks: [],
      termsAcceptedAt: cdmxToUtc('2026-10-09', '17:00'),
      currency: 'MXN',
      originalAmountCents: null,
      submittedAt: cdmxToUtc('2026-10-09', '17:00'),
      reviewStartedAt: cdmxToUtc('2026-10-12', '09:00'),
    },
    history: [
      { status: 'DRAFT', at: cdmxToUtc('2026-10-08', '20:00'), actor: 'PARTICIPANT' },
      { status: 'SUBMITTED', at: cdmxToUtc('2026-10-09', '17:00'), actor: 'PARTICIPANT' },
      { status: 'IN_REVIEW', at: cdmxToUtc('2026-10-12', '09:00'), actor: 'STAFF' },
      { status: 'INTERVIEW_SCHEDULED', at: cdmxToUtc('2026-10-14', '10:00'), actor: 'STAFF' },
    ],
    interview: {
      startsAt: cdmxToUtc('2026-11-12', '10:00'),
      endsAt: cdmxToUtc('2026-11-12', '10:30'),
      joinUrl: 'https://zoom.us/j/1111111111?pwd=demo',
    },
  },
  {
    // Borrador a medias (autoguardado): "Continuar".
    offerSlug: 'siembra-de-agua-2027',
    data: {
      kind: 'OPEN_CALL',
      status: 'DRAFT',
      statusChangedAt: cdmxToUtc('2026-10-19', '19:00'),
      organization: 'Cooperativa Mujeres del Agua',
      evidenceLinks: [],
    },
    history: [{ status: 'DRAFT', at: cdmxToUtc('2026-10-19', '19:00'), actor: 'PARTICIPANT' }],
  },
];
