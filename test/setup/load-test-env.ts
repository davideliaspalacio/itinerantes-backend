import { config } from 'dotenv';
import { resolve } from 'node:path';

// Carga .env.test en cada worker de Jest. `override: true` evita que un .env local o variables
// del shell apunten las pruebas a la BD de desarrollo.
process.env.NODE_ENV = 'test';
config({ path: resolve(__dirname, '..', '..', '.env.test'), override: true, quiet: true });
// E2E_DATABASE_URL (opcional, debe ser una BD *_test): permite correr suites en paralelo en BDs
// distintas (p. ej. `E2E_DATABASE_URL=postgresql://…/eia_test_admin pnpm test:e2e admin`).
if (process.env.E2E_DATABASE_URL?.includes('_test')) {
  process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;
}
