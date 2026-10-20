import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { config } from 'dotenv';

/**
 * Prepara la BD de pruebas (eia_test del docker-compose) aplicando las migraciones existentes y el
 * seed idempotente (catálogos de ubicación y usuarios demo, que las e2e usan).
 * Requiere `docker compose up -d`. Para empezar de cero: `pnpm test:e2e:reset` (ver README).
 */
export default function globalSetup(): void {
  const root = resolve(__dirname, '..', '..');
  const parsed: Record<string, string> =
    config({ path: resolve(root, '.env.test'), quiet: true }).parsed ?? {};
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...parsed,
    NODE_ENV: 'test',
    DIRECT_URL: parsed.DIRECT_URL ?? '',
  };

  if (!String(env.DATABASE_URL ?? '').includes('_test')) {
    throw new Error(
      `Las e2e deben usar una BD de prueba (*_test). DATABASE_URL=${env.DATABASE_URL}`,
    );
  }

  // Reintento: el primer acceso a Postgres en Docker Desktop a veces es lento.
  for (let attempt = 1; ; attempt++) {
    try {
      execSync('pnpm exec prisma migrate deploy', { cwd: root, env, stdio: 'pipe' });
      execSync('pnpm exec prisma db seed', { cwd: root, env, stdio: 'pipe' });
      return;
    } catch (error) {
      if (attempt >= 3) {
        const output = (error as { stdout?: Buffer; stderr?: Buffer }).stderr?.toString() ?? '';
        throw new Error(`prisma migrate deploy / db seed falló en la BD de pruebas:\n${output}`, {
          cause: error,
        });
      }
    }
  }
}
