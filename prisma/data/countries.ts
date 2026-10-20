/**
 * Catálogo de países (HU-02 / HU-14): LatAm + España + EE. UU. México y Centroamérica primero
 * (`sortOrder` 1–8); el resto, alfabético (`sortOrder` 100).
 * Longitudes = número nacional sin indicativo (supuesto razonable por país; ajustable aquí).
 */
export interface CountrySeed {
  code: string;
  name: string;
  phoneCode: string;
  phoneMinLength: number;
  phoneMaxLength: number;
  divisionLabel: string;
  municipalityLabel: string;
  sortOrder: number;
}

// prettier-ignore
export const COUNTRIES: CountrySeed[] = [
  { code: 'MX', name: 'México', phoneCode: '+52', phoneMinLength: 10, phoneMaxLength: 10, divisionLabel: 'Estado', municipalityLabel: 'Municipio', sortOrder: 1 },
  { code: 'GT', name: 'Guatemala', phoneCode: '+502', phoneMinLength: 8, phoneMaxLength: 8, divisionLabel: 'Departamento', municipalityLabel: 'Municipio', sortOrder: 2 },
  { code: 'BZ', name: 'Belice', phoneCode: '+501', phoneMinLength: 7, phoneMaxLength: 7, divisionLabel: 'Distrito', municipalityLabel: 'Ciudad', sortOrder: 3 },
  { code: 'SV', name: 'El Salvador', phoneCode: '+503', phoneMinLength: 8, phoneMaxLength: 8, divisionLabel: 'Departamento', municipalityLabel: 'Municipio', sortOrder: 4 },
  { code: 'HN', name: 'Honduras', phoneCode: '+504', phoneMinLength: 8, phoneMaxLength: 8, divisionLabel: 'Departamento', municipalityLabel: 'Municipio', sortOrder: 5 },
  { code: 'NI', name: 'Nicaragua', phoneCode: '+505', phoneMinLength: 8, phoneMaxLength: 8, divisionLabel: 'Departamento', municipalityLabel: 'Municipio', sortOrder: 6 },
  { code: 'CR', name: 'Costa Rica', phoneCode: '+506', phoneMinLength: 8, phoneMaxLength: 8, divisionLabel: 'Provincia', municipalityLabel: 'Cantón', sortOrder: 7 },
  { code: 'PA', name: 'Panamá', phoneCode: '+507', phoneMinLength: 7, phoneMaxLength: 8, divisionLabel: 'Provincia', municipalityLabel: 'Distrito', sortOrder: 8 },
  { code: 'AR', name: 'Argentina', phoneCode: '+54', phoneMinLength: 10, phoneMaxLength: 11, divisionLabel: 'Provincia', municipalityLabel: 'Ciudad', sortOrder: 100 },
  { code: 'BO', name: 'Bolivia', phoneCode: '+591', phoneMinLength: 8, phoneMaxLength: 8, divisionLabel: 'Departamento', municipalityLabel: 'Municipio', sortOrder: 100 },
  { code: 'BR', name: 'Brasil', phoneCode: '+55', phoneMinLength: 10, phoneMaxLength: 11, divisionLabel: 'Estado', municipalityLabel: 'Municipio', sortOrder: 100 },
  { code: 'CL', name: 'Chile', phoneCode: '+56', phoneMinLength: 9, phoneMaxLength: 9, divisionLabel: 'Región', municipalityLabel: 'Comuna', sortOrder: 100 },
  { code: 'CO', name: 'Colombia', phoneCode: '+57', phoneMinLength: 10, phoneMaxLength: 10, divisionLabel: 'Departamento', municipalityLabel: 'Municipio', sortOrder: 100 },
  { code: 'CU', name: 'Cuba', phoneCode: '+53', phoneMinLength: 8, phoneMaxLength: 8, divisionLabel: 'Provincia', municipalityLabel: 'Municipio', sortOrder: 100 },
  { code: 'DO', name: 'República Dominicana', phoneCode: '+1', phoneMinLength: 10, phoneMaxLength: 10, divisionLabel: 'Provincia', municipalityLabel: 'Municipio', sortOrder: 100 },
  { code: 'EC', name: 'Ecuador', phoneCode: '+593', phoneMinLength: 8, phoneMaxLength: 9, divisionLabel: 'Provincia', municipalityLabel: 'Cantón', sortOrder: 100 },
  { code: 'ES', name: 'España', phoneCode: '+34', phoneMinLength: 9, phoneMaxLength: 9, divisionLabel: 'Provincia', municipalityLabel: 'Municipio', sortOrder: 100 },
  { code: 'US', name: 'Estados Unidos', phoneCode: '+1', phoneMinLength: 10, phoneMaxLength: 10, divisionLabel: 'Estado', municipalityLabel: 'Ciudad', sortOrder: 100 },
  { code: 'PY', name: 'Paraguay', phoneCode: '+595', phoneMinLength: 7, phoneMaxLength: 9, divisionLabel: 'Departamento', municipalityLabel: 'Distrito', sortOrder: 100 },
  { code: 'PE', name: 'Perú', phoneCode: '+51', phoneMinLength: 8, phoneMaxLength: 9, divisionLabel: 'Departamento', municipalityLabel: 'Ciudad', sortOrder: 100 },
  { code: 'PR', name: 'Puerto Rico', phoneCode: '+1', phoneMinLength: 10, phoneMaxLength: 10, divisionLabel: 'Municipio', municipalityLabel: 'Localidad', sortOrder: 100 },
  { code: 'UY', name: 'Uruguay', phoneCode: '+598', phoneMinLength: 8, phoneMaxLength: 8, divisionLabel: 'Departamento', municipalityLabel: 'Ciudad', sortOrder: 100 },
  { code: 'VE', name: 'Venezuela', phoneCode: '+58', phoneMinLength: 10, phoneMaxLength: 10, divisionLabel: 'Estado', municipalityLabel: 'Municipio', sortOrder: 100 },
];
