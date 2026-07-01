/**
 * Seed exemplar — every generated E2E spec in this repo should mirror these patterns.
 *
 * Risk: auth/session protection (test-plan #4) — signed-in user reaches /app.
 * Change: delete-practice-data (infrastructure baseline).
 */
import { test, expect } from '@playwright/test';

test('signed-in user reaches the app dashboard', async ({ page }) => {
  await page.goto('/app');

  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('link', { name: /Your practice sets/i })).toBeVisible();
});
