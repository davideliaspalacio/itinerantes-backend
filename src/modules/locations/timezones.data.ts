/**
 * Zonas IANA sugeridas para el selector (HU-02, HU-11, HU-14). El selector admite cualquier zona
 * IANA válida; esta lista solo prioriza las del público (México, Centroamérica, Sudamérica,
 * España, EE. UU.).
 */
export const SUGGESTED_TIMEZONES: ReadonlyArray<{
  id: string;
  label: string;
  countryCode: string;
}> = [
  // México
  { id: 'America/Mexico_City', label: 'Ciudad de México (CDMX)', countryCode: 'MX' },
  { id: 'America/Monterrey', label: 'Monterrey (México)', countryCode: 'MX' },
  { id: 'America/Merida', label: 'Mérida (México)', countryCode: 'MX' },
  { id: 'America/Cancun', label: 'Cancún / Quintana Roo (México)', countryCode: 'MX' },
  { id: 'America/Chihuahua', label: 'Chihuahua (México)', countryCode: 'MX' },
  { id: 'America/Ciudad_Juarez', label: 'Ciudad Juárez (México)', countryCode: 'MX' },
  { id: 'America/Mazatlan', label: 'Mazatlán / Sinaloa (México)', countryCode: 'MX' },
  { id: 'America/Hermosillo', label: 'Hermosillo / Sonora (México)', countryCode: 'MX' },
  { id: 'America/Tijuana', label: 'Tijuana / Baja California (México)', countryCode: 'MX' },
  { id: 'America/Matamoros', label: 'Matamoros (México)', countryCode: 'MX' },
  { id: 'America/Bahia_Banderas', label: 'Bahía de Banderas (México)', countryCode: 'MX' },
  // Centroamérica
  { id: 'America/Guatemala', label: 'Guatemala', countryCode: 'GT' },
  { id: 'America/Belize', label: 'Belice', countryCode: 'BZ' },
  { id: 'America/El_Salvador', label: 'El Salvador', countryCode: 'SV' },
  { id: 'America/Tegucigalpa', label: 'Honduras', countryCode: 'HN' },
  { id: 'America/Managua', label: 'Nicaragua', countryCode: 'NI' },
  { id: 'America/Costa_Rica', label: 'Costa Rica', countryCode: 'CR' },
  { id: 'America/Panama', label: 'Panamá', countryCode: 'PA' },
  // Caribe
  { id: 'America/Havana', label: 'La Habana (Cuba)', countryCode: 'CU' },
  { id: 'America/Santo_Domingo', label: 'Santo Domingo (Rep. Dominicana)', countryCode: 'DO' },
  { id: 'America/Puerto_Rico', label: 'Puerto Rico', countryCode: 'PR' },
  // Sudamérica
  { id: 'America/Bogota', label: 'Bogotá (Colombia)', countryCode: 'CO' },
  { id: 'America/Lima', label: 'Lima (Perú)', countryCode: 'PE' },
  { id: 'America/Guayaquil', label: 'Quito / Guayaquil (Ecuador)', countryCode: 'EC' },
  { id: 'America/Caracas', label: 'Caracas (Venezuela)', countryCode: 'VE' },
  { id: 'America/La_Paz', label: 'La Paz (Bolivia)', countryCode: 'BO' },
  { id: 'America/Santiago', label: 'Santiago (Chile)', countryCode: 'CL' },
  { id: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (Argentina)', countryCode: 'AR' },
  { id: 'America/Montevideo', label: 'Montevideo (Uruguay)', countryCode: 'UY' },
  { id: 'America/Asuncion', label: 'Asunción (Paraguay)', countryCode: 'PY' },
  { id: 'America/Sao_Paulo', label: 'São Paulo / Brasilia (Brasil)', countryCode: 'BR' },
  { id: 'America/Manaus', label: 'Manaus (Brasil)', countryCode: 'BR' },
  // España
  { id: 'Europe/Madrid', label: 'Madrid (España)', countryCode: 'ES' },
  { id: 'Atlantic/Canary', label: 'Canarias (España)', countryCode: 'ES' },
  // Estados Unidos
  { id: 'America/New_York', label: 'Nueva York / Este (EE. UU.)', countryCode: 'US' },
  { id: 'America/Chicago', label: 'Chicago / Centro (EE. UU.)', countryCode: 'US' },
  { id: 'America/Denver', label: 'Denver / Montaña (EE. UU.)', countryCode: 'US' },
  { id: 'America/Phoenix', label: 'Phoenix / Arizona (EE. UU.)', countryCode: 'US' },
  { id: 'America/Los_Angeles', label: 'Los Ángeles / Pacífico (EE. UU.)', countryCode: 'US' },
  // Referencia
  { id: 'UTC', label: 'UTC', countryCode: '' },
];

/** Tabla "Ver en otros países" de HU-11 (fila CDMX de referencia primero). */
export const REFERENCE_TIMEZONES: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'America/Mexico_City', label: 'Ciudad de México (hora CDMX)' },
  {
    id: 'America/Guatemala',
    label: 'Centroamérica (Guatemala, El Salvador, Honduras, Nicaragua, Costa Rica)',
  },
  { id: 'America/Bogota', label: 'Bogotá / Lima' },
  { id: 'America/Santiago', label: 'Santiago' },
  { id: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires' },
  { id: 'Europe/Madrid', label: 'Madrid' },
];
