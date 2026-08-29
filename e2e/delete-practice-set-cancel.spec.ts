/**
 * Risk: FR-010 / plan Phase 2.4 — cancel dismisses inline confirm without deleting.
 * Change: delete-practice-data
 * Seed: e2e/seed.spec.ts
 */
import { test, expect } from '@playwright/test';

import { cleanupPracticeSet, createOwnedPracticeSet, ensureE2ETestUser } from './helpers/supabase';

test('cancel dismisses delete confirmation without removing the set', async ({ page }) => {
  const user = await ensureE2ETestUser();
  const title = `E2E delete cancel ${Date.now()}`;
  const practiceSetId = await createOwnedPracticeSet(user.id, title);

  try {
    await page.goto(`/app/sets/${practiceSetId}`);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await page.getByRole('button', { name: 'Delete this set' }).click();
    await expect(
      page.getByText('Delete this set? You won’t be able to access it again.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('button', { name: 'Delete this set' })).toBeVisible();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  } finally {
    await cleanupPracticeSet(practiceSetId, { hard: true }).catch(() => undefined);
  }
});
