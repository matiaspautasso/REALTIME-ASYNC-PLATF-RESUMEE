/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite + React for the JobFlow dashboard. The Vitest config lives here too so a
// single toolchain drives dev, build and the unit tests (EPIC-06).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    // @jobflow/contracts ships CommonJS and, as a linked workspace package, its
    // real path sits outside node_modules — so the Rollup CommonJS plugin skips
    // it by default and its named exports go unseen. Include it explicitly.
    commonjsOptions: {
      include: [/packages\/contracts\/dist/, /node_modules/],
    },
  },
  optimizeDeps: {
    include: ['@jobflow/contracts'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Unit tests live under src/. The Playwright E2E specs in e2e/ run with
    // Playwright, not Vitest.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
