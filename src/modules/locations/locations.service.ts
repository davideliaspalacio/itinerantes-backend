import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { ErrorDetail } from '../../common/errors/app.exception';
import { AppException } from '../../common/errors/app.exception';
import { FIELD_ERROR_CODES } from '../../common/errors/error-codes';
import { currencyForCountry } from '../../common/utils/money';
import { BUSINESS_RULES } from '../../config/business-rules';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { CountryDto, DivisionDto, MunicipalityDto } from './dto/locations.response.dto';
import type { TimezonesResponseDto } from './dto/timezones.dto';
import { REFERENCE_TIMEZONES, SUGGESTED_TIMEZONES } from './timezones.data';

export interface LocationInput {
  countryCode: string;
  divisionId?: string;
  divisionName?: string;
  municipalityId?: string;
  municipalityName?: string;
}

/** Ubicación validada lista para guardar en User (ids de catálogo + nombres denormalizados). */
export interface ResolvedLocation {
  countryCode: string;
  divisionId: string | null;
  divisionName: string;
  municipalityId: string | null;
  municipalityName: string;
}

/**
 * Catálogos de ubicación (País → Estado → Municipio) y zonas horarias. También valida la ubicación
 * y el teléfono que envían registro (HU-02) y perfil (HU-14).
 */
@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCountries(): Promise<CountryDto[]> {
    const countries = await this.prisma.country.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { divisions: true } } },
    });
    return countries.map(({ _count, ...country }) => ({
      code: country.code,
      name: country.name,
      phoneCode: country.phoneCode,
      phoneMinLength: country.phoneMinLength,
      phoneMaxLength: country.phoneMaxLength,
      hasDivisions: _count.divisions > 0,
      divisionLabel: country.divisionLabel,
      municipalityLabel: country.municipalityLabel,
      currency: currencyForCountry(country.code),
    }));
  }

  async listDivisions(countryCode: string): Promise<DivisionDto[]> {
    const code = countryCode.toUpperCase();
    const country = await this.prisma.country.findUnique({ where: { code } });
    if (!country) throw AppException.notFound('El país no existe en el catálogo.');
    const divisions = await this.prisma.adminDivision.findMany({
      where: { countryCode: code },
      orderBy: { name: 'asc' },
      include: { _count: { select: { municipalities: true } } },
    });
    return divisions.map((division) => ({
      id: division.id,
      code: division.code,
      name: division.name,
      hasMunicipalities: division._count.municipalities > 0,
    }));
  }

  async listMunicipalities(divisionId: string): Promise<MunicipalityDto[]> {
    const division = await this.prisma.adminDivision.findUnique({ where: { id: divisionId } });
    if (!division) throw AppException.notFound('El estado no existe en el catálogo.');
    return this.prisma.municipality.findMany({
      where: { divisionId },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    });
  }

  async getCountryName(code: string): Promise<string> {
    const country = await this.prisma.country.findUnique({ where: { code } });
    return country?.name ?? code;
  }

  /**
   * Valida la cascada País → Estado → Municipio (HU-02): ids de catálogo cuando hay lista, texto
   * libre cuando no. Lanza VALIDATION_ERROR con `details` por campo (`location.divisionId`, ...).
   */
  async resolveLocation(input: LocationInput, prefix = 'location'): Promise<ResolvedLocation> {
    const fail = (
      field: string,
      message: string,
      code: string = FIELD_ERROR_CODES.INVALID_LOCATION,
    ) => AppException.validation([{ field: `${prefix}.${field}`, code, message }]);
    const required = (field: string, message: string) =>
      fail(field, message, FIELD_ERROR_CODES.REQUIRED);

    const country = await this.prisma.country.findUnique({
      where: { code: input.countryCode },
      include: { _count: { select: { divisions: true } } },
    });
    if (!country) throw fail('countryCode', 'Elige un país de la lista.');

    // Sin lista de divisiones: estado y municipio en texto libre (Anexo A, HU-02).
    if (country._count.divisions === 0) {
      if (input.divisionId)
        throw fail('divisionId', 'Este país no tiene lista de estados; escríbelo.');
      if (input.municipalityId) {
        throw fail('municipalityId', 'Este país no tiene lista de municipios; escríbelo.');
      }
      if (!input.divisionName)
        throw required('divisionName', `Escribe tu ${country.divisionLabel.toLowerCase()}.`);
      if (!input.municipalityName) {
        throw required(
          'municipalityName',
          `Escribe tu ${country.municipalityLabel.toLowerCase()}.`,
        );
      }
      return {
        countryCode: country.code,
        divisionId: null,
        divisionName: input.divisionName,
        municipalityId: null,
        municipalityName: input.municipalityName,
      };
    }

    if (!input.divisionId)
      throw required('divisionId', `Elige tu ${country.divisionLabel.toLowerCase()}.`);
    const division = await this.prisma.adminDivision.findFirst({
      where: { id: input.divisionId, countryCode: country.code },
      include: { _count: { select: { municipalities: true } } },
    });
    if (!division)
      throw fail('divisionId', `Elige un ${country.divisionLabel.toLowerCase()} de la lista.`);

    if (division._count.municipalities === 0) {
      if (input.municipalityId)
        throw fail('municipalityId', 'Este estado no tiene lista de municipios.');
      if (!input.municipalityName) {
        throw required(
          'municipalityName',
          `Escribe tu ${country.municipalityLabel.toLowerCase()}.`,
        );
      }
      return {
        countryCode: country.code,
        divisionId: division.id,
        divisionName: division.name,
        municipalityId: null,
        municipalityName: input.municipalityName,
      };
    }

    if (!input.municipalityId) {
      throw required('municipalityId', `Elige tu ${country.municipalityLabel.toLowerCase()}.`);
    }
    const municipality = await this.prisma.municipality.findFirst({
      where: { id: input.municipalityId, divisionId: division.id },
    });
    if (!municipality) {
      throw fail(
        'municipalityId',
        `Elige un ${country.municipalityLabel.toLowerCase()} de la lista.`,
      );
    }
    return {
      countryCode: country.code,
      divisionId: division.id,
      divisionName: division.name,
      municipalityId: municipality.id,
      municipalityName: municipality.name,
    };
  }

  /**
   * HU-02: "longitud válida para el indicativo". Usa la longitud de los países con ese indicativo
   * (p. ej. +1 lo comparten EE. UU., Puerto Rico y Rep. Dominicana). Indicativo desconocido →
   * longitud genérica E.164 (4–15).
   */
  async validatePhone(
    phone: { countryCode: string; number: string },
    prefix = 'phone',
  ): Promise<void> {
    const countries = await this.prisma.country.findMany({
      where: { phoneCode: phone.countryCode },
      select: { phoneMinLength: true, phoneMaxLength: true },
    });
    const min = countries.length ? Math.min(...countries.map((c) => c.phoneMinLength)) : 4;
    const max = countries.length ? Math.max(...countries.map((c) => c.phoneMaxLength)) : 15;
    const length = phone.number.length;
    if (length < min || length > max) {
      const expected = min === max ? `${min}` : `${min} a ${max}`;
      const detail: ErrorDetail = {
        field: `${prefix}.number`,
        code: FIELD_ERROR_CODES.INVALID_PHONE,
        message: `El número debe tener ${expected} dígitos para el indicativo ${phone.countryCode}.`,
      };
      throw AppException.validation([detail]);
    }
  }

  /** Zonas sugeridas y tabla de referencia (HU-11) con su offset en el instante `at`. */
  listTimezones(at: Date = new Date()): TimezonesResponseDto {
    const offsetOf = (zone: string) => {
      const dt = DateTime.fromJSDate(at, { zone });
      return { utcOffset: dt.toFormat('ZZ'), offsetMinutes: dt.offset };
    };
    return {
      officialTimezone: BUSINESS_RULES.OFFICIAL_TIMEZONE,
      defaultTimezone: BUSINESS_RULES.DEFAULT_USER_TIMEZONE,
      at: at.toISOString(),
      zones: SUGGESTED_TIMEZONES.map((zone) => ({
        id: zone.id,
        label: zone.label,
        countryCode: zone.countryCode || null,
        ...offsetOf(zone.id),
      })),
      referenceZones: REFERENCE_TIMEZONES.map((zone) => ({
        id: zone.id,
        label: zone.label,
        ...offsetOf(zone.id),
        isOfficial: zone.id === BUSINESS_RULES.OFFICIAL_TIMEZONE,
      })),
    };
  }
}
