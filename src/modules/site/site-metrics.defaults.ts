/**
 * Cifras iniciales de la landing (sección "Soñamos con ríos libres y limpios"). El seed las crea solo
 * si no existen, así que nunca pisa lo que el equipo edite desde el panel.
 */
export const DEFAULT_SITE_METRICS = [
  {
    key: 'WATER_LITERS_REVITALIZED',
    label: 'De agua revitaliza',
    value: 3_000_000,
    prefix: '+',
    suffix: ' L',
    sortOrder: 0,
  },
  {
    key: 'PEOPLE_TRAINED',
    label: 'Personas formadas',
    value: 1800,
    prefix: '',
    suffix: '+',
    sortOrder: 1,
  },
  {
    key: 'TERRITORIES_ACCOMPANIED',
    label: 'Territorios acompañados en México y Centroamérica',
    value: 12,
    prefix: '',
    suffix: '+',
    sortOrder: 2,
  },
  {
    key: 'YOUTH_TRAINED',
    label: 'Jóvenes capacitados',
    value: 250,
    prefix: '',
    suffix: '+',
    sortOrder: 3,
  },
] as const;
