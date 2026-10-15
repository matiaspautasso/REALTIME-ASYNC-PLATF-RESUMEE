/** @type {import('jest').Config} */
// Integration tests: exercise the processor against real PostgreSQL + Redis.
// A Testcontainers global setup boots throwaway containers and runs migrations
// (TICKET-08.1); if Docker/Testcontainers is unavailable the setup fails fast.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.int-spec.ts'],
  globalSetup: '<rootDir>/test/testcontainers.global-setup.ts',
  globalTeardown: '<rootDir>/test/testcontainers.global-teardown.ts',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  clearMocks: true,
  passWithNoTests: true,
  testTimeout: 30000,
  // One shared container set: run files serially so their per-test cleanup
  // cannot collide across files.
  maxWorkers: 1,
  // Redis and BullMQ keep handles open after the suite; exit once the tests and
  // global teardown are done instead of hanging on them.
  forceExit: true,
};
