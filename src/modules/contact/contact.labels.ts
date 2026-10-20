import {
  ContactOrigin,
  ContactProjectType,
  ContactService,
  ContactSubject,
} from '../../generated/prisma/enums';

/** Textos en español de los enums de Contacto (HU-38, HU-35). Usados en los correos. */
export const CONTACT_SUBJECT_LABELS: Record<ContactSubject, string> = {
  SCHOOL: 'Escuela',
  DESIGN_CONSULTING: 'Diseño y asesoría',
  REGENERATIVE_TECH_HAWA: 'Tecnologías regenerativas – HAWA',
  SCHOLARSHIPS_CALLS: 'Becas y convocatorias',
  OTHER: 'Otro',
};

export const CONTACT_ORIGIN_LABELS: Record<ContactOrigin, string> = {
  CONTACT_PAGE: 'Página de Contacto',
  LANDING: 'Landing',
  DESIGN_CONSULTING_PAGE: 'Diseño y Asesoría',
  REGENERATIVE_TECH_PAGE: 'Tecnologías regenerativas',
  ABOUT_PAGE: 'Nuestra trayectoria',
};

export const CONTACT_PROJECT_TYPE_LABELS: Record<ContactProjectType, string> = {
  HOUSEHOLD: 'Domiciliario',
  COMMERCIAL: 'Comercial',
  COLLECTIVE: 'Colectivo / organización',
  PRODUCTIVE: 'Productivo',
  OTHER: 'Otro',
};

export const CONTACT_SERVICE_LABELS: Record<ContactService, string> = {
  WASTEWATER_TREATMENT_DESIGN: 'Diseño de sistemas de tratamiento de aguas residuales',
  RAINWATER_HARVESTING_DESIGN: 'Diseño de sistemas de captación de lluvias',
  INFILTRATION_REHYDRATION_DESIGN: 'Diseño de sistemas de infiltración y rehidratación del paisaje',
  WATER_RESILIENCE_DIAGNOSTICS: 'Diagnósticos y estrategias para la resiliencia hídrica',
  TECHNOLOGY_IMPLEMENTATION_ADVICE: 'Asesoría para implementación de tecnologías',
  NOT_SURE: 'Aún no lo sé',
};
