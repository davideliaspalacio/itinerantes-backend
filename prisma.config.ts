import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Configuración del CLI de Prisma (Prisma 7).
 *
 * - Las migraciones (`migrate dev|deploy|reset`) usan DIRECT_URL si existe (conexión directa o
 *   "session pooler" de Supabase) y si no, DATABASE_URL.
 * - En tiempo de ejecución la app usa DATABASE_URL (puede ser el pooler) vía PrismaService.
 * - `url` es opcional para `prisma generate` (p. ej. dentro del build de Docker sin variables).
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node --transpile-only prisma/seed.ts',
  },
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
