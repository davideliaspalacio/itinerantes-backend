import type { Config } from 'jest';

/**
 * Pruebas e2e: test/**\/*.e2e-spec.ts contra la BD de pruebas del docker-compose (eia_test).
 * globalSetup aplica las migraciones a esa BD antes de correr.
 */
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  roots: ['<rootDir>/test'],
  testRegex: '.e2e-spec.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
    // @scalar/* publica dependencias solo-ESM. Node 22 las carga (require(esm)), pero Jest no:
    // se convierten a CommonJS solo para las pruebas.
    '^.+\\.m?js$': ['babel-jest', { plugins: ['@babel/plugin-transform-modules-commonjs'] }],
  },
  transformIgnorePatterns: ['/node_modules/(?!(\\.pnpm/[^/]+/node_modules/)?@scalar/)'],
  testEnvironment: 'node',
  globalSetup: '<rootDir>/test/setup/global-setup.ts',
  setupFiles: ['<rootDir>/test/setup/load-test-env.ts'],
  testTimeout: 30000,
};

export default config;
