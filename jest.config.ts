import type { Config } from 'jest';

/** Pruebas unitarias: src/**\/*.spec.ts (sin BD ni servicios externos). */
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },
  collectCoverageFrom: ['**/*.ts', '!**/*.module.ts', '!main.ts', '!generated/**', '!**/index.ts'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};

export default config;
