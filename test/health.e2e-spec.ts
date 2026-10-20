import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createTestApp } from './utils/create-test-app';

describe('Health (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('GET /api/v1/health → 200 liveness', async () => {
    const res = await http().get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', version: expect.any(String) });
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /api/v1/health/ready → 200 con la BD de pruebas', async () => {
    const res = await http().get('/api/v1/health/ready').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', checks: { database: 'up' } });
  });

  it('reutiliza un X-Request-Id entrante válido', async () => {
    const res = await http()
      .get('/api/v1/health')
      .set('X-Request-Id', 'test-request-id-123')
      .expect(200);
    expect(res.headers['x-request-id']).toBe('test-request-id-123');
  });

  it('GET /docs/openapi.json → documento OpenAPI 3.1', async () => {
    const res = await http().get('/docs/openapi.json').expect(200);
    expect(res.body.openapi).toBe('3.1.0');
    expect(res.body.paths['/api/v1/health']).toBeDefined();
  });

  it('GET /docs → UI de Scalar (HTML)', async () => {
    const res = await http().get('/docs').expect(200);
    expect(res.headers['content-type']).toContain('text/html');
  });
});
