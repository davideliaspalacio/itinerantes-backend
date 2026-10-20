import { Body, Controller, Get, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import request from 'supertest';
import { Public } from '../src/common/decorators/public.decorator';
import { AppException } from '../src/common/errors/app.exception';
import { createTestApp } from './utils/create-test-app';

class AddressDto {
  @IsString()
  @MinLength(3)
  city!: string;
}

class ProbeDto {
  @IsEmail()
  email!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;
}

/** Controlador de prueba (no existe en la app real) para ejercitar el formato de errores. */
@Public()
@Controller('__test')
class ProbeController {
  @Post('validation')
  validate(@Body() body: ProbeDto): ProbeDto {
    return body;
  }

  @Get('conflict')
  conflict(): never {
    throw new AppException('CONFLICT', {
      message: 'El correo ya está registrado.',
      details: [{ field: 'email', code: 'ALREADY_EXISTS', message: 'Ya existe.' }],
    });
  }

  @Get('crash')
  crash(): never {
    throw new Error('boom: detalle interno que no debe filtrarse');
  }

  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  @Get('limited')
  limited(): { ok: true } {
    return { ok: true };
  }
}

const ERROR_SHAPE = {
  statusCode: expect.any(Number),
  code: expect.any(String),
  message: expect.any(String),
  requestId: expect.any(String),
};

describe('Formato de error (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp({ controllers: [ProbeController] });
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('ruta inexistente → 404 NOT_FOUND con requestId', async () => {
    const res = await http().get('/api/v1/no-existe').expect(404);
    expect(res.body).toEqual({ ...ERROR_SHAPE, statusCode: 404, code: 'NOT_FOUND' });
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it('DTO inválido → 400 VALIDATION_ERROR con details por campo (incluye anidados y campos no permitidos)', async () => {
    const res = await http()
      .post('/api/v1/__test/validation')
      .send({ email: 'no-es-correo', quantity: 0, address: { city: 'a' }, extra: true })
      .expect(400);

    expect(res.body).toMatchObject({ ...ERROR_SHAPE, statusCode: 400, code: 'VALIDATION_ERROR' });
    const fields = (res.body.details as Array<{ field: string; code: string }>).map(
      (d) => `${d.field}:${d.code}`,
    );
    expect(fields).toEqual(
      expect.arrayContaining([
        'email:IS_EMAIL',
        'quantity:MIN',
        'address.city:MIN_LENGTH',
        'extra:UNKNOWN_FIELD',
      ]),
    );
  });

  it('DTO válido → 201 y transforma/limpia el cuerpo', async () => {
    const res = await http()
      .post('/api/v1/__test/validation')
      .send({ email: 'ana@example.com', quantity: 2, address: { city: 'Oaxaca' } })
      .expect(201);
    expect(res.body).toEqual({
      email: 'ana@example.com',
      quantity: 2,
      address: { city: 'Oaxaca' },
    });
  });

  it('JSON mal formado → 400 BAD_REQUEST con requestId', async () => {
    const res = await http()
      .post('/api/v1/__test/validation')
      .set('Content-Type', 'application/json')
      .send('{"email": ')
      .expect(400);
    expect(res.body).toMatchObject({ ...ERROR_SHAPE, code: 'BAD_REQUEST' });
  });

  it('AppException → status, code, message y details del catálogo', async () => {
    const res = await http().get('/api/v1/__test/conflict').expect(409);
    expect(res.body).toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'El correo ya está registrado.',
      details: [{ field: 'email', code: 'ALREADY_EXISTS', message: 'Ya existe.' }],
    });
  });

  it('error inesperado → 500 INTERNAL_ERROR sin filtrar detalles internos', async () => {
    const res = await http().get('/api/v1/__test/crash').expect(500);
    expect(res.body).toMatchObject({ ...ERROR_SHAPE, code: 'INTERNAL_ERROR' });
    expect(JSON.stringify(res.body)).not.toContain('boom');
  });

  it('rate limit → 429 RATE_LIMITED', async () => {
    await http().get('/api/v1/__test/limited').expect(200);
    await http().get('/api/v1/__test/limited').expect(200);
    const res = await http().get('/api/v1/__test/limited').expect(429);
    expect(res.body).toMatchObject({ ...ERROR_SHAPE, statusCode: 429, code: 'RATE_LIMITED' });
  });

  it('CORS: origen permitido recibe Access-Control-Allow-Origin; no permitido, no', async () => {
    const allowed = await http().get('/api/v1/health').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const denied = await http().get('/api/v1/health').set('Origin', 'https://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});
