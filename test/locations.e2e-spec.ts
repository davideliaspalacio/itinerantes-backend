import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createTestApp } from './utils/create-test-app';

describe('Catálogos (e2e) — ubicaciones y zonas horarias', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('GET /locations/countries → México y Centroamérica primero, sin token', async () => {
    const res = await http().get('/api/v1/locations/countries').expect(200);
    const codes = (res.body.data as Array<{ code: string }>).map((c) => c.code);
    expect(codes.slice(0, 8)).toEqual(['MX', 'GT', 'BZ', 'SV', 'HN', 'NI', 'CR', 'PA']);
    expect(codes).toEqual(expect.arrayContaining(['CO', 'ES', 'US', 'AR']));
    expect(res.body.data[0]).toEqual({
      code: 'MX',
      name: 'México',
      phoneCode: '+52',
      phoneMinLength: 10,
      phoneMaxLength: 10,
      hasDivisions: true,
      divisionLabel: 'Estado',
      municipalityLabel: 'Municipio',
      currency: 'MXN',
    });
    const co = (res.body.data as Array<{ code: string; hasDivisions: boolean }>).find(
      (c) => c.code === 'CO',
    );
    expect(co).toMatchObject({ hasDivisions: false, currency: 'USD' });
  });

  it('GET /locations/countries/MX/divisions → 32 estados con municipios', async () => {
    const res = await http().get('/api/v1/locations/countries/mx/divisions').expect(200);
    expect(res.body.data).toHaveLength(32);
    const cdmx = (res.body.data as Array<{ id: string; code: string; name: string }>).find(
      (d) => d.code === '09',
    );
    expect(cdmx).toMatchObject({ name: 'Ciudad de México', hasMunicipalities: true });

    const muni = await http()
      .get(`/api/v1/locations/divisions/${cdmx!.id}/municipalities`)
      .expect(200);
    expect(muni.body.data).toHaveLength(16);
    expect(muni.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Coyoacán', code: '003' })]),
    );
  });

  it('país sin lista → divisiones vacías; país inexistente → 404', async () => {
    const co = await http().get('/api/v1/locations/countries/CO/divisions').expect(200);
    expect(co.body.data).toEqual([]);
    const missing = await http().get('/api/v1/locations/countries/ZZ/divisions').expect(404);
    expect(missing.body.code).toBe('NOT_FOUND');
    await http()
      .get('/api/v1/locations/divisions/00000000-0000-4000-8000-000000000000/municipalities')
      .expect(404);
    await http().get('/api/v1/locations/divisions/no-uuid/municipalities').expect(404);
  });

  it('GET /timezones → zonas con offset y tabla de referencia HU-11', async () => {
    const res = await http()
      .get('/api/v1/timezones')
      .query({ at: '2026-11-07T16:00:00.000Z' })
      .expect(200);
    expect(res.body).toMatchObject({
      officialTimezone: 'America/Mexico_City',
      defaultTimezone: 'America/Mexico_City',
      at: '2026-11-07T16:00:00.000Z',
    });
    expect(res.body.zones).toEqual(
      expect.arrayContaining([
        {
          id: 'America/Bogota',
          label: 'Bogotá (Colombia)',
          countryCode: 'CO',
          utcOffset: '-05:00',
          offsetMinutes: -300,
        },
      ]),
    );
    const reference = res.body.referenceZones as Array<{
      id: string;
      utcOffset: string;
      isOfficial: boolean;
    }>;
    expect(reference.map((z) => z.id)).toEqual([
      'America/Mexico_City',
      'America/Guatemala',
      'America/Bogota',
      'America/Santiago',
      'America/Argentina/Buenos_Aires',
      'Europe/Madrid',
    ]);
    expect(reference[0]).toMatchObject({ utcOffset: '-06:00', isOfficial: true });
    expect(reference.find((z) => z.id === 'Europe/Madrid')?.utcOffset).toBe('+01:00');
  });
});
