import { config } from 'dotenv';
import { resolve } from 'node:path';

// Carga .env.test en cada worker de Jest. `override: true` evita que un .env local o variables
// del shell apunten las pruebas a la BD de desarrollo.
process.env.NODE_ENV = 'test';
config({ path: resolve(__dirname, '..', '..', '.env.test'), override: true, quiet: true });
