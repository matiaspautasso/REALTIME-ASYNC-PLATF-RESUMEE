/** @type {import('jest').Config} */
// Integration / e2e tests: boot the Nest app against real PostgreSQL + Redis.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.e2e-spec.ts'],
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  clearMocks: true,
  passWithNoTests: true,
  testTimeout: 30000,
};
