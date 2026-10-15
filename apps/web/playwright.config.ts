import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E (TICKET-08.5). Runs against the running stack — the Docker
 * Compose stack in CI, or local dev servers — pointed at by E2E_BASE_URL
 * (default the web dev/preview origin).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
