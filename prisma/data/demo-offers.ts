/**
 * Datos DEMO de la Fase 02 (oferta formativa). Solo se siembran con SEED_DEMO_DATA=true (o fuera de
 * producción por defecto). Fechas en hora CDMX → UTC con `cdmxToUtc`. Imágenes: URLs de marcador
 * de posición (el modelo acepta keys de storage o URLs https absolutas).
 */
import type { Prisma } from '../../src/generated/prisma/client';
import { cdmxToUtc } from '../../src/common/utils/time';
import type { ScheduleRuleInput } from '../../src/modules/offers/policies/schedule-rule';

const img = (text: string, bg = '0E7490') =>
  `https://placehold.co/1200x630/${bg}/FFFFFF/png?text=${encodeURIComponent(text)}`;

export interface DemoTeacher {
  slug: string;
  fullName: string;
  bio: string;
  cvUrl: string | null;
  photoKey: string;
}

export const DEMO_TEACHERS: DemoTeacher[] = [
  {
    slug: 'ana-solis-rios',
    fullName: 'Ana Solís Ríos',
    photoKey: 'https://placehold.co/400x400/0E7490/FFFFFF/png?text=AS',
    bio: 'Ingeniera ambiental con 15 años diseñando humedales construidos y sistemas de tratamiento descentralizado en comunidades rurales de México.',
    cvUrl: 'https://example.com/cv/ana-solis-rios.pdf',
  },
  {
    slug: 'tomas-ek-canche',
    fullName: 'Tomás Ek Canché',
    photoKey: 'https://placehold.co/400x400/0E7490/FFFFFF/png?text=TE',
    bio: 'Arquitecto bioclimático y constructor de sistemas de captación de agua de lluvia en la península de Yucatán.',
    cvUrl: 'https://example.com/cv/tomas-ek-canche.pdf',
  },
  {
    slug: 'lucia-herrera-mendoza',
    fullName: 'Lucía Herrera Mendoza',
    photoKey: 'https://placehold.co/400x400/0E7490/FFFFFF/png?text=LH',
    bio: 'Educadora popular y facilitadora de procesos comunitarios de cuidado del agua en Centroamérica.',
    cvUrl: null,
  },
  {
    slug: 'rafael-ortiz-luna',
    fullName: 'Rafael Ortiz Luna',
    photoKey: 'https://placehold.co/400x400/0E7490/FFFFFF/png?text=RO',
    bio: 'Especialista en saneamiento ecológico y baños secos; acompaña proyectos de autoconstrucción desde 2010.',
    cvUrl: 'https://example.com/cv/rafael-ortiz-luna.pdf',
  },
];

export interface DemoOffer {
  data: Omit<Prisma.OfferUncheckedCreateInput, 'scheduleRule'> & {
    slug: string;
    name: string;
    scheduleRule?: ScheduleRuleInput;
  };
  teacherSlugs: string[];
  modules: Array<{ title: string; description: string }>;
  /** Genera sesiones desde la regla entre startsAt y endsAt (fechas CDMX). */
  generateSessions: boolean;
}

/** Receso de fin de año del diplomado (6 fines de semana excluidos → 20 sesiones · 60 h, HU-29). */
const DIPLOMA_WINTER_BREAK = [
  '2026-12-19',
  '2026-12-20',
  '2026-12-26',
  '2026-12-27',
  '2027-01-02',
  '2027-01-03',
];

const CENTRAL_AMERICA_AND_MEXICO = ['MX', 'GT', 'BZ', 'SV', 'HN', 'NI', 'CR', 'PA'];

export const DEMO_OFFERS: DemoOffer[] = [
  {
    data: {
      slug: 'diplomado-en-ecotecnologias-del-agua',
      name: 'Diplomado en Ecotecnologías del Agua',
      type: 'DIPLOMA',
      modality: 'ONLINE_LIVE',
      origin: 'NAS',
      publicationStatus: 'PUBLISHED',
      publishedAt: cdmxToUtc('2026-09-01', '00:00'),
      cohortLabel: 'Generación 2026–2027',
      summary:
        'Aprende a diseñar y construir ecotecnologías para cuidar, tratar, captar, infiltrar y regenerar el agua desde una mirada basada en la naturaleza.',
      description:
        'Nueve módulos en vivo (60 h) más un proyecto final aplicado a tu territorio. Recorremos el ciclo del agua, la captación de lluvia, el tratamiento de aguas grises y negras con humedales y biofiltros, el saneamiento ecológico y la infiltración, con prácticas de diseño y acompañamiento docente.',
      learningOutcomes: [
        'Diagnosticar la situación hídrica de una vivienda o comunidad',
        'Dimensionar un sistema de captación y cosecha de agua de lluvia',
        'Diseñar humedales construidos y biofiltros para aguas grises',
        'Elegir soluciones de saneamiento ecológico adaptadas al territorio',
        'Formular un proyecto de regeneración hídrica aplicable',
      ],
      requirements:
        'Conexión estable a internet, disponibilidad sábados y domingos de 10:00 a 13:00 (hora CDMX) y presentar un proyecto final.',
      coverImageKey: img('Diplomado en Ecotecnologías del Agua'),
      carouselImageKeys: [
        img('Humedales construidos', '155E75'),
        img('Captación de lluvia', '0F766E'),
      ],
      publicTopic: 'ECOTECH_WATER_DIPLOMA',
      enrollmentOpensAt: cdmxToUtc('2026-09-01', '00:00'),
      enrollmentClosesAt: cdmxToUtc('2026-11-06', '23:59'),
      startsAt: cdmxToUtc('2026-11-07', '10:00'),
      endsAt: cdmxToUtc('2027-01-31', '13:00'),
      finalProjectDueAt: cdmxToUtc('2027-02-27', '10:00'),
      totalMinutes: 60 * 60,
      scheduleRule: {
        weekdays: [6, 7],
        startTime: '10:00',
        endTime: '13:00',
        excludedDates: DIPLOMA_WINTER_BREAK,
      },
      calendarCategory: 'TRAINING',
      priceMxnCents: 1_020_000,
      priceUsdCents: 58_500,
      installmentsEnabled: true,
      installmentsMax: 3,
      scholarshipEnabled: true,
      scholarshipLevels: ['AGUA_VIVA', 'RIOS_VIVOS', 'AGUAS_LIBRES', 'CENOTES_VIVOS', 'SPECIAL'],
      scholarshipOpensAt: cdmxToUtc('2026-09-01', '00:00'),
      scholarshipClosesAt: cdmxToUtc('2026-10-31', '23:59'),
      attendanceWindowHours: 24,
      // PRIVADO (solo inscritos, Fase 03). Nunca debe salir en la ficha pública.
      whatsappGroupUrl: 'https://chat.whatsapp.com/DemoDiplomadoEcotecnologias',
      whatsappVisibleFrom: cdmxToUtc('2026-10-31', '00:00'),
      // Aula (Fase 03, HU-17) — PRIVADO: solo inscritos.
      classroomWelcome:
        '¡Te damos la bienvenida al Diplomado! Antes de la primera sesión únete al grupo de WhatsApp, revisa la presentación del Módulo 1 y ten a la mano una libreta para tus diagnósticos.',
      finalProjectSubmissionEnabled: true,
      finalProjectGuidelines:
        'Diseña una ecotecnología para tu vivienda o comunidad: diagnóstico, propuesta, dimensionamiento y plan de implementación. Entrega en PDF, DOCX, PPTX o ZIP (máx. 20 MB) y preséntala en la sesión final.',
    },
    teacherSlugs: ['ana-solis-rios', 'tomas-ek-canche'],
    modules: [
      {
        title: 'El ciclo del agua y las aguas vivas',
        description: 'Ciclo hidrológico, cuencas y la mirada regenerativa del agua.',
      },
      {
        title: 'Diagnóstico hídrico del territorio',
        description: 'Herramientas para leer el agua de una vivienda, escuela o comunidad.',
      },
      {
        title: 'Captación y cosecha de agua de lluvia',
        description: 'Cálculo de demanda, superficies de captación, filtros y almacenamiento.',
      },
      {
        title: 'Humedales construidos',
        description: 'Diseño y operación de humedales para aguas grises y negras.',
      },
      {
        title: 'Biofiltros y tratamiento de aguas jabonosas',
        description: 'Soluciones de bajo costo para reutilizar aguas grises.',
      },
      {
        title: 'Saneamiento ecológico y baños secos',
        description: 'Ciclo de nutrientes, tipos de baños secos y manejo seguro.',
      },
      {
        title: 'Infiltración y recarga de acuíferos',
        description: 'Zanjas, pozos de absorción y obras de conservación de suelo.',
      },
      {
        title: 'Autoconstrucción y materiales',
        description: 'Técnicas y materiales locales para construir ecotecnologías.',
      },
      {
        title: 'Proyecto final: regenerar el agua en mi territorio',
        description: 'Integración de lo aprendido en una propuesta aplicable.',
      },
    ],
    generateSessions: true,
  },
  {
    data: {
      slug: 'curso-humedales-construidos',
      name: 'Curso de Humedales construidos',
      type: 'COURSE',
      modality: 'ONLINE_LIVE',
      origin: 'NAS',
      publicationStatus: 'PUBLISHED',
      publishedAt: cdmxToUtc('2026-10-01', '00:00'),
      summary:
        'Tres sesiones en vivo para diseñar un humedal construido para aguas grises domésticas.',
      description:
        'Curso práctico de 9 horas: principios de depuración, dimensionamiento, selección de plantas y sustratos, y mantenimiento de humedales construidos.',
      learningOutcomes: [
        'Calcular el área de un humedal para una vivienda',
        'Elegir plantas y sustratos adecuados',
        'Planear el mantenimiento del sistema',
      ],
      coverImageKey: img('Humedales construidos', '155E75'),
      carouselImageKeys: [],
      publicTopic: 'CONSTRUCTED_WETLANDS',
      enrollmentOpensAt: cdmxToUtc('2026-10-01', '00:00'),
      enrollmentClosesAt: cdmxToUtc('2026-11-11', '23:59'),
      startsAt: cdmxToUtc('2026-11-12', '18:00'),
      endsAt: cdmxToUtc('2026-11-26', '21:00'),
      totalMinutes: 9 * 60,
      scheduleRule: { weekdays: [4], startTime: '18:00', endTime: '21:00' },
      calendarCategory: 'TRAINING',
      priceMxnCents: 180_000,
      priceUsdCents: 10_000,
      whatsappGroupUrl: 'https://chat.whatsapp.com/DemoCursoHumedales',
    },
    teacherSlugs: ['ana-solis-rios'],
    modules: [{ title: 'Contenido', description: 'Las tres sesiones del curso.' }],
    generateSessions: true,
  },
  {
    data: {
      slug: 'taller-biofiltro-aguas-jabonosas',
      name: 'Taller de biofiltro para aguas jabonosas',
      type: 'WORKSHOP',
      modality: 'IN_PERSON',
      origin: 'NAS',
      publicationStatus: 'PUBLISHED',
      publishedAt: cdmxToUtc('2026-10-15', '00:00'),
      summary:
        'Taller presencial de un día: construimos juntos un biofiltro para reutilizar aguas grises.',
      description:
        'Jornada práctica de autoconstrucción en sitio: excavación, capas filtrantes, plantas y conexión. Incluye materiales y comida.',
      learningOutcomes: ['Construir un biofiltro paso a paso', 'Dar mantenimiento a un biofiltro'],
      requirements: 'Ropa de trabajo, guantes y gorra. Edad mínima 16 años.',
      coverImageKey: img('Taller de biofiltro', '15803D'),
      carouselImageKeys: [],
      publicTopic: 'TERRITORIAL_PRACTICES',
      enrollmentOpensAt: cdmxToUtc('2026-11-01', '00:00'),
      enrollmentClosesAt: cdmxToUtc('2026-12-02', '23:59'),
      startsAt: cdmxToUtc('2026-12-05', '09:00'),
      endsAt: cdmxToUtc('2026-12-05', '17:00'),
      totalMinutes: 8 * 60,
      scheduleRule: { weekdays: [6], startTime: '09:00', endTime: '17:00' },
      calendarCategory: 'TERRITORY',
      venueName: 'Centro de Saberes del Agua',
      venueAddress: 'Camino a Amatlán s/n, Tepoztlán, Morelos',
      venueCity: 'Tepoztlán, Morelos',
      venueMapsUrl: 'https://maps.google.com/?q=Tepoztl%C3%A1n%2C+Morelos',
      capacity: 20,
      priceMxnCents: 120_000,
      priceUsdCents: 7_000,
    },
    teacherSlugs: ['rafael-ortiz-luna'],
    modules: [],
    generateSessions: true,
  },
  {
    data: {
      slug: 'masterclass-banos-secos-en-la-ciudad',
      name: 'Masterclass: Baños secos en la ciudad',
      type: 'EVENT',
      modality: 'ONLINE_LIVE',
      origin: 'NAS',
      publicationStatus: 'PUBLISHED',
      publishedAt: cdmxToUtc('2026-10-10', '00:00'),
      summary: 'Charla abierta sobre saneamiento ecológico en contextos urbanos. Gratuita.',
      description: 'Masterclass de 90 minutos con preguntas y respuestas.',
      learningOutcomes: ['Conocer opciones de baños secos para departamentos y casas urbanas'],
      coverImageKey: img('Masterclass Baños secos', '7E22CE'),
      carouselImageKeys: [],
      publicTopic: 'DRY_TOILETS',
      enrollmentOpensAt: cdmxToUtc('2026-10-10', '00:00'),
      enrollmentClosesAt: cdmxToUtc('2026-11-20', '17:00'),
      startsAt: cdmxToUtc('2026-11-20', '18:00'),
      endsAt: cdmxToUtc('2026-11-20', '19:30'),
      totalMinutes: 90,
      scheduleRule: { weekdays: [5], startTime: '18:00', endTime: '19:30' },
      calendarCategory: 'EVENTS',
      isFree: true,
    },
    teacherSlugs: ['rafael-ortiz-luna'],
    modules: [],
    generateSessions: true,
  },
  {
    data: {
      slug: 'aprendices-del-agua-2027',
      name: 'Aprendices del Agua 2027',
      type: 'OPEN_CALL',
      modality: 'IN_PERSON',
      origin: 'NAS',
      publicationStatus: 'PUBLISHED',
      publishedAt: cdmxToUtc('2026-10-01', '00:00'),
      cohortLabel: 'Convocatoria 2027',
      summary:
        'Programa presencial intensivo de 5 días para jóvenes que quieren cuidar el agua de su comunidad.',
      description:
        'Escuela de Aprendices del Agua: cinco días de formación práctica en territorio con hospedaje y alimentación. Las personas seleccionadas se comprometen a replicar lo aprendido en su comunidad.',
      learningOutcomes: [
        'Construir ecotecnologías en equipo',
        'Planear un proyecto comunitario de agua',
      ],
      requirements: 'Tener entre 18 y 30 años y participar en una organización o colectivo.',
      coverImageKey: img('Aprendices del Agua', 'C2410C'),
      carouselImageKeys: [],
      publicTopic: 'WATER_APPRENTICES_SCHOOL',
      enrollmentOpensAt: cdmxToUtc('2026-10-01', '00:00'),
      enrollmentClosesAt: cdmxToUtc('2026-11-30', '23:59'),
      startsAt: cdmxToUtc('2027-02-15', '09:00'),
      endsAt: cdmxToUtc('2027-02-19', '18:00'),
      totalMinutes: 40 * 60,
      scheduleRule: { weekdays: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '17:00' },
      calendarCategory: 'TERRITORY',
      venueName: 'Ecoaldea Río Vivo',
      venueAddress: 'San José del Pacífico, Oaxaca',
      venueCity: 'San José del Pacífico, Oaxaca',
      capacity: 25,
      isFree: true,
      eligibilityText:
        'Jóvenes de 18 a 30 años de México y Centroamérica vinculados a una organización o colectivo.',
      eligibleCountryCodes: CENTRAL_AMERICA_AND_MEXICO,
      requiresTravel: true,
    },
    teacherSlugs: ['lucia-herrera-mendoza', 'tomas-ek-canche'],
    modules: [],
    generateSessions: true,
  },
  {
    data: {
      slug: 'siembra-de-agua-2027',
      name: 'Siembra de Agua 2027',
      type: 'OPEN_CALL',
      modality: 'IN_PERSON',
      origin: 'NAS',
      publicationStatus: 'PUBLISHED',
      publishedAt: cdmxToUtc('2026-10-15', '00:00'),
      cohortLabel: 'Convocatoria 2027',
      summary:
        'Programa presencial para mujeres lideresas que impulsan la regeneración del agua en sus territorios.',
      description:
        'Encuentro formativo presencial de cinco días con prácticas de infiltración, captación y restauración de cuencas, y acompañamiento posterior.',
      learningOutcomes: ['Liderar proyectos comunitarios de siembra de agua'],
      coverImageKey: img('Siembra de Agua', 'B45309'),
      carouselImageKeys: [],
      publicTopic: null,
      enrollmentOpensAt: cdmxToUtc('2026-10-15', '00:00'),
      enrollmentClosesAt: cdmxToUtc('2026-12-15', '23:59'),
      startsAt: cdmxToUtc('2027-03-08', '09:00'),
      endsAt: cdmxToUtc('2027-03-12', '18:00'),
      totalMinutes: 40 * 60,
      scheduleRule: { weekdays: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '17:00' },
      calendarCategory: 'TERRITORY',
      venueName: 'Centro Comunitario Agua Viva',
      venueAddress: 'Antigua Guatemala, Sacatepéquez',
      venueCity: 'Antigua Guatemala',
      capacity: 30,
      isFree: true,
      eligibilityText: 'Dirigida a mujeres lideresas de Centroamérica y México.',
      eligibleCountryCodes: CENTRAL_AMERICA_AND_MEXICO,
      requiresTravel: true,
    },
    teacherSlugs: ['lucia-herrera-mendoza'],
    modules: [],
    generateSessions: true,
  },
  {
    data: {
      slug: 'curso-captacion-y-cosecha-de-agua-moodle',
      name: 'Curso de Captación y cosecha de agua (Moodle)',
      type: 'COURSE',
      modality: 'ONLINE_LIVE',
      origin: 'MOODLE',
      publicationStatus: 'PUBLISHED',
      publishedAt: cdmxToUtc('2026-10-01', '00:00'),
      summary:
        'Curso impartido vía Moodle: las personas inscritas activan aquí su acceso a materiales.',
      description:
        'Cohorte administrada en Moodle. La inscripción y el pago se hicieron fuera de la plataforma.',
      learningOutcomes: ['Dimensionar un sistema de captación de lluvia'],
      coverImageKey: img('Captación y cosecha de agua', '0F766E'),
      carouselImageKeys: [],
      publicTopic: 'WATER_HARVESTING',
      enrollmentOpensAt: cdmxToUtc('2026-09-15', '00:00'),
      enrollmentClosesAt: cdmxToUtc('2026-11-02', '23:59'),
      startsAt: cdmxToUtc('2026-11-03', '18:00'),
      endsAt: cdmxToUtc('2026-11-17', '21:00'),
      totalMinutes: 9 * 60,
      scheduleRule: { weekdays: [2], startTime: '18:00', endTime: '21:00' },
      calendarCategory: 'TRAINING',
      moodleCourseUrl: 'https://moodle.example.com/course/view.php?id=42',
    },
    teacherSlugs: ['tomas-ek-canche'],
    modules: [{ title: 'Contenido', description: 'Materiales de la cohorte Moodle.' }],
    generateSessions: true,
  },
  {
    data: {
      slug: 'curso-introduccion-sistemas-de-tratamiento-2026',
      name: 'Introducción a los sistemas de tratamiento de aguas (2026)',
      type: 'COURSE',
      modality: 'ONLINE_LIVE',
      origin: 'NAS',
      publicationStatus: 'PUBLISHED',
      publishedAt: cdmxToUtc('2026-04-01', '00:00'),
      summary: 'Edición finalizada (aparece en el catálogo solo con el filtro "Finalizado").',
      description: 'Panorama de sistemas de tratamiento descentralizado.',
      learningOutcomes: ['Distinguir tratamiento primario, secundario y terciario'],
      coverImageKey: img('Sistemas de tratamiento', '334155'),
      carouselImageKeys: [],
      publicTopic: 'WATER_TREATMENT_SYSTEMS_INTRO',
      enrollmentOpensAt: cdmxToUtc('2026-04-01', '00:00'),
      enrollmentClosesAt: cdmxToUtc('2026-05-06', '23:59'),
      startsAt: cdmxToUtc('2026-05-07', '18:00'),
      endsAt: cdmxToUtc('2026-05-21', '21:00'),
      totalMinutes: 9 * 60,
      scheduleRule: { weekdays: [4], startTime: '18:00', endTime: '21:00' },
      priceMxnCents: 150_000,
      priceUsdCents: 8_500,
    },
    teacherSlugs: ['ana-solis-rios'],
    // Fase 03: módulo y sesiones pasadas para el historial, grabaciones y asistencia demo.
    modules: [
      {
        title: 'Contenido',
        description: 'Tratamiento primario, secundario y terciario; casos de estudio.',
      },
    ],
    generateSessions: true,
  },
  {
    // Fase 04: diplomado con convocatoria de becas abierta (demo de "Becas disponibles" y de una beca
    // aprobada pendiente de pago del usuario demo).
    data: {
      slug: 'diplomado-gestion-comunitaria-del-agua-2027',
      name: 'Diplomado en Gestión Comunitaria del Agua',
      type: 'DIPLOMA',
      modality: 'ONLINE_LIVE',
      origin: 'NAS',
      publicationStatus: 'PUBLISHED',
      publishedAt: cdmxToUtc('2026-10-01', '00:00'),
      cohortLabel: 'Generación 2027',
      summary:
        'Herramientas para organizar, gobernar y financiar sistemas comunitarios de agua con enfoque territorial.',
      description:
        'Nueve módulos en vivo (60 h) sobre gobernanza comunitaria del agua, comités de agua, tarifas justas, monitoreo participativo y proyectos de regeneración, con un proyecto final aplicado.',
      learningOutcomes: [
        'Diseñar un modelo de gobernanza comunitaria del agua',
        'Calcular tarifas justas y sostenibles',
        'Coordinar monitoreo participativo de la calidad del agua',
      ],
      requirements: 'Participar en un comité, colectivo u organización vinculada al agua.',
      coverImageKey: img('Gestión Comunitaria del Agua', '0369A1'),
      carouselImageKeys: [],
      publicTopic: null,
      enrollmentOpensAt: cdmxToUtc('2026-10-01', '00:00'),
      enrollmentClosesAt: cdmxToUtc('2027-01-31', '23:59'),
      startsAt: cdmxToUtc('2027-02-06', '10:00'),
      endsAt: cdmxToUtc('2027-04-25', '13:00'),
      totalMinutes: 60 * 60,
      scheduleRule: { weekdays: [6, 7], startTime: '10:00', endTime: '13:00' },
      calendarCategory: 'TRAINING',
      priceMxnCents: 1_020_000,
      priceUsdCents: 58_500,
      installmentsEnabled: true,
      installmentsMax: 4,
      scholarshipEnabled: true,
      scholarshipLevels: ['AGUA_VIVA', 'RIOS_VIVOS', 'AGUAS_LIBRES', 'CENOTES_VIVOS', 'SPECIAL'],
      scholarshipOpensAt: cdmxToUtc('2026-10-01', '00:00'),
      scholarshipClosesAt: cdmxToUtc('2027-01-15', '23:59'),
      attendanceWindowHours: 24,
    },
    teacherSlugs: ['lucia-herrera-mendoza', 'ana-solis-rios'],
    modules: [
      {
        title: 'Gobernanza comunitaria del agua',
        description: 'Comités, asambleas y reglamentos comunitarios.',
      },
      {
        title: 'Tarifas justas y sostenibilidad financiera',
        description: 'Costos de operación, tarifas y fondos de reserva.',
      },
    ],
    generateSessions: false,
  },
  {
    data: {
      slug: 'diplomado-de-ecopedagogias',
      name: 'Diplomado de Ecopedagogías',
      type: 'DIPLOMA',
      modality: 'ONLINE_LIVE',
      origin: 'NAS',
      // BORRADOR: nunca debe aparecer en catálogo, ficha ni disponibilidad.
      publicationStatus: 'DRAFT',
      summary: 'Borrador en preparación.',
      description: 'Borrador.',
      learningOutcomes: [],
      carouselImageKeys: [],
      publicTopic: 'ECOPEDAGOGIES_DIPLOMA',
      priceMxnCents: 1_020_000,
      priceUsdCents: 58_500,
    },
    teacherSlugs: ['lucia-herrera-mendoza'],
    modules: [],
    generateSessions: false,
  },
];
