/**
 * Datos DEMO de la Fase 03 (portal del participante). Solo con SEED_DEMO_DATA (por defecto fuera de
 * producción). Las inscripciones/asistencias/notificaciones demo se crean solo para el usuario demo,
 * que nunca existe con NODE_ENV=production. Recursos con enlaces externos (sin archivos en storage).
 */
import type { Prisma } from '../../src/generated/prisma/client';
import { cdmxToUtc } from '../../src/common/utils/time';

const thumb = (text: string, bg = '0E7490') =>
  `https://placehold.co/600x400/${bg}/FFFFFF/png?text=${encodeURIComponent(text)}`;

/** Biblioteca (HU-09). `offerSlug` = exclusivo de ese curso (audience OFFER_ENROLLED). */
export const DEMO_LIBRARY: Array<
  Omit<Prisma.LibraryResourceUncheckedCreateInput, 'offerId'> & { slug: string; offerSlug?: string }
> = [
  {
    slug: 'guia-practica-humedales-construidos',
    title: 'Guía práctica de humedales construidos',
    description: 'Manual paso a paso para diseñar un humedal para aguas grises en vivienda rural.',
    type: 'PDF',
    author: 'Ana Solís Ríos',
    keywords: ['humedales', 'aguas grises', 'saneamiento'],
    thumbnailKey: thumb('Guía humedales'),
    url: 'https://example.com/biblioteca/guia-humedales.pdf',
    featured: true,
  },
  {
    slug: 'articulo-cosecha-de-lluvia-en-la-ciudad',
    title: 'Cosecha de lluvia en la ciudad: lecciones de 10 años',
    type: 'ARTICLE',
    author: 'Tomás Ek Canché',
    keywords: ['captación', 'lluvia', 'ciudad'],
    thumbnailKey: thumb('Cosecha de lluvia', '0F766E'),
    url: 'https://example.com/biblioteca/cosecha-lluvia-ciudad',
    featured: true,
  },
  {
    slug: 'libro-saneamiento-ecologico',
    title: 'Saneamiento ecológico: baños secos y compostaje',
    type: 'BOOK',
    author: 'Rafael Ortiz Luna',
    keywords: ['baños secos', 'saneamiento ecológico'],
    thumbnailKey: thumb('Saneamiento ecológico', '7C3AED'),
    url: 'https://example.com/biblioteca/saneamiento-ecologico',
  },
  {
    slug: 'video-biofiltro-paso-a-paso',
    title: 'Video: biofiltro para aguas jabonosas paso a paso',
    type: 'VIDEO',
    keywords: ['biofiltro', 'aguas jabonosas'],
    thumbnailKey: thumb('Biofiltro', 'B45309'),
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    featured: true,
  },
  {
    slug: 'podcast-aguas-vivas-episodio-1',
    title: 'Podcast Aguas Vivas · Episodio 1',
    type: 'AUDIO',
    keywords: ['podcast', 'comunidad'],
    thumbnailKey: thumb('Podcast', 'BE123C'),
    url: 'https://example.com/podcast/aguas-vivas-1',
  },
  {
    slug: 'mapa-conagua-disponibilidad',
    title: 'Disponibilidad de agua por cuenca (CONAGUA)',
    type: 'EXTERNAL',
    keywords: ['cuencas', 'datos'],
    url: 'https://sigagis.conagua.gob.mx/',
  },
  {
    slug: 'material-curso-humedales-plantillas',
    title: 'Plantillas de dimensionamiento (exclusivo del curso de humedales)',
    type: 'COURSE_MATERIAL',
    keywords: ['plantillas', 'humedales'],
    url: 'https://example.com/biblioteca/plantillas-humedales.xlsx',
    audience: 'OFFER_ENROLLED',
    offerSlug: 'curso-humedales-construidos',
  },
];

/** Recursos de módulo (HU-08) por oferta y número de módulo. */
export const DEMO_MODULE_RESOURCES: Array<{
  offerSlug: string;
  modulePosition: number;
  resources: Array<
    Pick<
      Prisma.ModuleResourceUncheckedCreateInput,
      'type' | 'title' | 'description' | 'url' | 'activityDueAt' | 'position'
    > & { title: string; libraryResourceSlug?: string }
  >;
}> = [
  {
    offerSlug: 'diplomado-en-ecotecnologias-del-agua',
    modulePosition: 1,
    resources: [
      {
        type: 'PRESENTATION',
        title: 'Presentación del Módulo 1',
        description: 'Objetivos, contenidos y docente del módulo.',
        url: 'https://example.com/diplomado/modulo-1/presentacion',
        position: 1,
      },
      {
        type: 'PRE_READING',
        title: 'Lectura previa: el ciclo hidrosocial',
        url: 'https://example.com/diplomado/modulo-1/lectura-ciclo-hidrosocial',
        position: 1,
      },
      {
        type: 'PRE_READING',
        title: 'Guía práctica de humedales construidos (Biblioteca)',
        libraryResourceSlug: 'guia-practica-humedales-construidos',
        position: 2,
      },
      {
        type: 'ACTIVITY',
        title: 'Actividad: diagnóstico hídrico de tu vivienda',
        description: 'Llena la ficha de diagnóstico y compártela en la sesión del domingo.',
        url: 'https://example.com/diplomado/modulo-1/actividad-diagnostico',
        activityDueAt: cdmxToUtc('2026-11-08', '10:00'),
        position: 1,
      },
    ],
  },
  {
    offerSlug: 'diplomado-en-ecotecnologias-del-agua',
    modulePosition: 2,
    resources: [
      {
        type: 'PRESENTATION',
        title: 'Presentación del Módulo 2',
        url: 'https://example.com/diplomado/modulo-2/presentacion',
        position: 1,
      },
    ],
  },
  {
    offerSlug: 'curso-introduccion-sistemas-de-tratamiento-2026',
    modulePosition: 1,
    resources: [
      {
        type: 'PRESENTATION',
        title: 'Presentación del curso',
        url: 'https://example.com/curso-tratamiento/presentacion',
        position: 1,
      },
      {
        type: 'PRE_READING',
        title: 'Lectura: tratamiento descentralizado',
        url: 'https://example.com/curso-tratamiento/lectura',
        position: 1,
      },
    ],
  },
];

/** Eventos manuales del calendario (HU-10 / HU-29 "+ Evento manual"). Clave estable: título. */
export const DEMO_CALENDAR_EVENTS: Array<
  Omit<Prisma.CalendarEventUncheckedCreateInput, 'offerId'> & { title: string; offerSlug?: string }
> = [
  {
    title: 'Webinar: el agua como bien común',
    description: 'Panel abierto a todas las personas registradas.',
    category: 'EVENTS',
    audience: 'ALL_REGISTERED',
    startsAt: cdmxToUtc('2026-11-12', '17:00'),
    endsAt: cdmxToUtc('2026-11-12', '18:30'),
    joinUrl: 'https://zoom.us/j/1111111111?pwd=demo',
  },
  {
    title: 'Encuentro de comunidad Itinerante',
    description: 'Encuentro mensual para compartir avances de proyectos.',
    category: 'COMMUNITY',
    audience: 'ALL_REGISTERED',
    startsAt: cdmxToUtc('2026-11-28', '11:00'),
    endsAt: cdmxToUtc('2026-11-28', '13:00'),
    location: 'Huerto comunitario, Coyoacán (CDMX)',
  },
  {
    title: 'Sesión de bienvenida del Diplomado',
    description: 'Presentación del equipo docente y dinámica del diplomado (solo inscritos).',
    category: 'TRAINING',
    audience: 'OFFER_ENROLLED',
    offerSlug: 'diplomado-en-ecotecnologias-del-agua',
    startsAt: cdmxToUtc('2026-11-05', '19:00'),
    endsAt: cdmxToUtc('2026-11-05', '20:00'),
    joinUrl: 'https://meet.google.com/demo-bien-venida',
  },
];

/** Inscripciones del usuario demo (participante@example.com). */
export const DEMO_ENROLLMENTS: Array<{
  offerSlug: string;
  origin: 'NAS' | 'MOODLE';
  source: Prisma.EnrollmentUncheckedCreateInput['source'];
  /** Sesiones (por orden) con asistencia registrada. */
  attendedSessionIndexes?: number[];
}> = [
  { offerSlug: 'diplomado-en-ecotecnologias-del-agua', origin: 'NAS', source: 'MANUAL' },
  { offerSlug: 'curso-humedales-construidos', origin: 'NAS', source: 'MANUAL' },
  {
    offerSlug: 'curso-captacion-y-cosecha-de-agua-moodle',
    origin: 'MOODLE',
    source: 'MOODLE_LIST',
  },
  {
    offerSlug: 'curso-introduccion-sistemas-de-tratamiento-2026',
    origin: 'NAS',
    source: 'MANUAL',
    attendedSessionIndexes: [0, 1],
  },
];
