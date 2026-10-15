/** @type {import('jest').Config} */
// Unit tests: pure logic under src/, no infrastructure required.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  clearMocks: true,
  passWithNoTests: true,
};
