import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

// Mandatory scenarios 5 + 6 (browser view): upload a CSV, watch progress advance
// over the WebSocket, and assert the import reaches a terminal state live.
const here = dirname(fileURLToPath(import.meta.url));
const SAMPLE_CSV = resolve(here, '../../../samples/products-with-errors.csv');

test('uploads a CSV and watches it reach a terminal state', async ({ page }) => {
  await page.goto('/imports/new');

  await page.locator('input[type="file"]').setInputFiles(SAMPLE_CSV);
  await page.getByRole('button', { name: /upload and start import/i }).click();

  // Routed to the detail view for the new import.
  await expect(page).toHaveURL(/\/imports\/[^/]+$/);

  // The badge starts non-terminal and, driven by live events, reaches a terminal
  // state. This sample has invalid rows, so it completes WITH errors.
  const badge = page.getByTestId('status-badge');
  await expect(badge).toHaveText(/Completed with errors|Completed|Failed/, { timeout: 30_000 });
  await expect(badge).toHaveText(/Completed with errors/, { timeout: 30_000 });

  // Progress reaches 100% and the row errors are listed.
  await expect(page.getByText('100%')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'MISSING_SKU' })).toBeVisible();
});
