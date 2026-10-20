import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { AppException } from '../errors/app.exception';
import { AllExceptionsFilter, ErrorResponseBody } from './all-exceptions.filter';

function createHost(requestId: string | null = 'req-123') {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const headers: Record<string, string> = {};
  const response = {
    status,
    headersSent: false,
    getHeader: (name: string) => headers[name],
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
  };
  const request = { id: requestId ?? undefined, headers: {} };
  const host = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ArgumentsHost;
  const body = (): ErrorResponseBody => json.mock.calls[0][0] as ErrorResponseBody;
  return { host, status, body, headers };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  beforeAll(() => {
    // Silencia el log de errores 5xx durante las pruebas.
    jest.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);
  });

  it('AppException → status/código/mensaje/details del catálogo + requestId', () => {
    const { host, status, body } = createHost();
    filter.catch(
      new AppException('CONFLICT', {
        message: 'El correo ya está registrado.',
        details: [{ field: 'email', code: 'ALREADY_EXISTS', message: 'Ya existe.' }],
      }),
      host,
    );
    expect(status).toHaveBeenCalledWith(409);
    expect(body()).toEqual({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'El correo ya está registrado.',
      details: [{ field: 'email', code: 'ALREADY_EXISTS', message: 'Ya existe.' }],
      requestId: 'req-123',
    });
  });

  it('AppException sin details → omite la clave details', () => {
    const { host, body } = createHost();
    filter.catch(AppException.notFound(), host);
    expect(body()).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'El recurso solicitado no existe.',
      requestId: 'req-123',
    });
  });

  it('ThrottlerException → 429 RATE_LIMITED', () => {
    const { host, status, body } = createHost();
    filter.catch(new ThrottlerException(), host);
    expect(status).toHaveBeenCalledWith(429);
    expect(body().code).toBe('RATE_LIMITED');
  });

  it('ruta inexistente (NotFoundException "Cannot GET /x") → 404 NOT_FOUND en español', () => {
    const { host, body } = createHost();
    filter.catch(new NotFoundException('Cannot GET /api/v1/nope'), host);
    expect(body()).toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'La ruta solicitada no existe.',
    });
  });

  it('HttpException genérica → código genérico por status y mensaje del catálogo', () => {
    const { host, body } = createHost();
    filter.catch(new ForbiddenException('Forbidden resource'), host);
    expect(body()).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    expect(body().message).toBe('No tienes permiso para realizar esta acción.');
  });

  it('BadRequest de ValidationPipe estándar (message: string[]) → VALIDATION_ERROR con details', () => {
    const { host, body } = createHost();
    filter.catch(new BadRequestException(['email must be an email']), host);
    expect(body()).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      details: [{ field: 'email', code: 'INVALID', message: 'email must be an email' }],
    });
  });

  it('Prisma P2002 (clásico, meta.target) → 409 CONFLICT con campos', () => {
    const { host, status, body } = createHost();
    const error = Object.assign(new Error('Unique constraint failed'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
      meta: { target: ['email'] },
    });
    filter.catch(error, host);
    expect(status).toHaveBeenCalledWith(409);
    expect(body()).toMatchObject({
      code: 'CONFLICT',
      details: [{ field: 'email', code: 'ALREADY_EXISTS' }],
    });
  });

  it('Prisma P2002 (driver adapter) → 409 CONFLICT con campos', () => {
    const { host, body } = createHost();
    const error = Object.assign(new Error('Unique constraint failed'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
      meta: {
        modelName: 'User',
        driverAdapterError: { cause: { constraint: { fields: ['username'] } } },
      },
    });
    filter.catch(error, host);
    expect(body().details).toEqual([
      { field: 'username', code: 'ALREADY_EXISTS', message: 'Este valor ya está registrado.' },
    ]);
  });

  it('Prisma P2025 → 404 NOT_FOUND', () => {
    const { host, body } = createHost();
    const error = Object.assign(new Error('Record not found'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2025',
    });
    filter.catch(error, host);
    expect(body()).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('error desconocido → 500 INTERNAL_ERROR sin exponer el mensaje original', () => {
    const { host, status, body } = createHost();
    filter.catch(new Error('secreto interno'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(body().code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body())).not.toContain('secreto');
  });

  it('sin req.id (error antes de pino-http) → genera requestId y lo pone en el header', () => {
    const { host, body, headers } = createHost(null);
    filter.catch(new BadRequestException('Unexpected token in JSON at position 1'), host);
    expect(body().requestId).toEqual(expect.any(String));
    expect(headers['X-Request-Id']).toBe(body().requestId);
    expect(body().message).toBe('El cuerpo de la solicitud no es un JSON válido.');
  });
});
