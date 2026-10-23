/**
 * Tipos de beca iniciales (los 5 niveles que existían como enum hasta la migración
 * `scholarship_types`). El seed los crea solo si su `key` no existe, así que nunca pisa lo que el
 * equipo edite desde el panel. "Beca especial": el comité asigna 71–80% tras la entrevista
 * (Anexo A, HU-19).
 */
export const DEFAULT_SCHOLARSHIP_TYPES = [
  {
    key: 'AGUA_VIVA',
    name: 'Agua Viva',
    minPercent: 10,
    maxPercent: 10,
    requiresInterview: false,
    sortOrder: 1,
  },
  {
    key: 'RIOS_VIVOS',
    name: 'Ríos Vivos',
    minPercent: 25,
    maxPercent: 25,
    requiresInterview: false,
    sortOrder: 2,
  },
  {
    key: 'AGUAS_LIBRES',
    name: 'Aguas Libres',
    minPercent: 50,
    maxPercent: 50,
    requiresInterview: false,
    sortOrder: 3,
  },
  {
    key: 'CENOTES_VIVOS',
    name: 'Cenotes Vivos',
    minPercent: 70,
    maxPercent: 70,
    requiresInterview: false,
    sortOrder: 4,
  },
  {
    key: 'SPECIAL',
    name: 'Beca especial',
    minPercent: 71,
    maxPercent: 80,
    requiresInterview: true,
    sortOrder: 5,
  },
] as const;
