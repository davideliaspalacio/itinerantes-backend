import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readVersion(): string {
  try {
    // Funciona desde src/ (ts-node/jest) y desde dist/ (build): package.json está un nivel arriba.
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Versión de la API (de package.json). */
export const APP_VERSION = readVersion();
