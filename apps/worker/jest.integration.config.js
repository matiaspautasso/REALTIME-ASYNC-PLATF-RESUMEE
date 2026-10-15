/** @type {import('jest').Config} */
// Integration tests: exercise the processor against real PostgreSQL.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.int-spec.ts'],
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  clearMocks: true,
  passWithNoTests: true,
  testTimeout: 30000,
};
