import type { OfferType, PublicTopic } from '../../../generated/prisma/client';
import { OfferAvailability } from './offer-status.policy';

/**
 * Temáticas de la página "Itinerantes del Agua / Escuela Itinerante del Agua" (HU-34): los 10 ítems
 * literales del cliente, en su orden (3 + 4 + 3). El código es estable; el texto es el literal.
 * Cada oferta se enlaza a una temática con `Offer.publicTopic` (panel, HU-27), sin cambiar código.
 */
export const PublicTopicGroup = {
  /** "Formación especializada" */
  SPECIALIZED_TRAINING: 'SPECIALIZED_TRAINING',
  /** "Cursos y talleres online" */
  ONLINE_COURSES_WORKSHOPS: 'ONLINE_COURSES_WORKSHOPS',
  /** "Aprendizaje práctico" */
  HANDS_ON_LEARNING: 'HANDS_ON_LEARNING',
} as const;
export type PublicTopicGroup = (typeof PublicTopicGroup)[keyof typeof PublicTopicGroup];

export const PUBLIC_TOPICS: ReadonlyArray<{
  topic: PublicTopic;
  group: PublicTopicGroup;
  label: string;
}> = [
  {
    topic: 'ECOTECH_WATER_DIPLOMA',
    group: 'SPECIALIZED_TRAINING',
    label: 'Diplomado en Ecotecnologías del Agua',
  },
  {
    topic: 'ECOPEDAGOGIES_DIPLOMA',
    group: 'SPECIALIZED_TRAINING',
    label: 'Diplomado de Ecopedagogías',
  },
  {
    topic: 'WATER_APPRENTICES_SCHOOL',
    group: 'SPECIALIZED_TRAINING',
    label: 'Escuela de Aprendices del Agua',
  },
  {
    topic: 'WATER_TREATMENT_SYSTEMS_INTRO',
    group: 'ONLINE_COURSES_WORKSHOPS',
    label: 'Introducción a los sistemas de tratamiento de aguas',
  },
  {
    topic: 'CONSTRUCTED_WETLANDS',
    group: 'ONLINE_COURSES_WORKSHOPS',
    label: 'Humedales construidos',
  },
  { topic: 'DRY_TOILETS', group: 'ONLINE_COURSES_WORKSHOPS', label: 'Baños secos' },
  {
    topic: 'WATER_HARVESTING',
    group: 'ONLINE_COURSES_WORKSHOPS',
    label: 'Captación y cosecha de agua',
  },
  {
    topic: 'TRAVELING_WATER_LABS',
    group: 'HANDS_ON_LEARNING',
    label: 'Laboratorios Itinerantes del agua',
  },
  { topic: 'TERRITORIAL_PRACTICES', group: 'HANDS_ON_LEARNING', label: 'Prácticas territoriales' },
  { topic: 'FIELD_VISITS', group: 'HANDS_ON_LEARNING', label: 'Visitas y experiencias de campo' },
];

/**
 * Etiqueta de disponibilidad de una temática (HU-34):
 * Inscripciones abiertas / Próximamente / Inscripciones cerradas / Programa por convocatoria /
 * Sin fechas programadas.
 */
export const TopicAvailability = {
  ENROLLMENT_OPEN: 'ENROLLMENT_OPEN',
  UPCOMING: 'UPCOMING',
  ENROLLMENT_CLOSED: 'ENROLLMENT_CLOSED',
  OPEN_CALL: 'OPEN_CALL',
  NO_SCHEDULED_DATES: 'NO_SCHEDULED_DATES',
} as const;
export type TopicAvailability = (typeof TopicAvailability)[keyof typeof TopicAvailability];

export const TopicLinkKind = {
  /** Una sola oferta vigente → su ficha (HU-16). */
  OFFER: 'OFFER',
  /** Varias ofertas vigentes → catálogo filtrado por la temática (HU-15). */
  CATALOG: 'CATALOG',
  /** Sin oferta vigente → sin enlace. */
  NONE: 'NONE',
} as const;
export type TopicLinkKind = (typeof TopicLinkKind)[keyof typeof TopicLinkKind];

export interface TopicOffer {
  slug: string;
  type: OfferType;
  availability: OfferAvailability;
  startsAt: Date | null;
}

export interface TopicResolution {
  availability: TopicAvailability;
  linkKind: TopicLinkKind;
  slug: string | null;
  /** Ofertas vigentes (publicadas y no finalizadas). */
  offerCount: number;
}

const BEST_FIRST = ['ENROLLMENT_OPEN', 'UPCOMING', 'ENROLLMENT_CLOSED'] as const;

/**
 * Resuelve etiqueta y destino de una temática a partir de sus ofertas PUBLICADAS (HU-34):
 * - Solo cuentan las vigentes (no finalizadas). Ninguna → "Sin fechas programadas", sin enlace.
 * - Si todas las vigentes son convocatorias → "Programa por convocatoria".
 * - Si no, el mejor estado entre ellas: abiertas > próximamente > cerradas.
 * - Una vigente → enlace a su ficha; varias → catálogo filtrado (`?topic=...&status=...`).
 */
export function resolveTopic(offers: readonly TopicOffer[]): TopicResolution {
  const current = offers.filter((o) => o.availability !== OfferAvailability.FINISHED);
  if (current.length === 0) {
    return { availability: 'NO_SCHEDULED_DATES', linkKind: 'NONE', slug: null, offerCount: 0 };
  }
  const availability: TopicAvailability = current.every((o) => o.type === 'OPEN_CALL')
    ? 'OPEN_CALL'
    : (BEST_FIRST.find((state) => current.some((o) => o.availability === state)) ??
      'ENROLLMENT_CLOSED');
  if (current.length === 1) {
    return { availability, linkKind: 'OFFER', slug: current[0].slug, offerCount: 1 };
  }
  return { availability, linkKind: 'CATALOG', slug: null, offerCount: current.length };
}
