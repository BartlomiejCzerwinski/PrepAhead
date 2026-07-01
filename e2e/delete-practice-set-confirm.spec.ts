/**
 * Risk: FR-010 / plan Phase 2.3 — soft-deleted set vanishes from overview and direct nav.
 * Change: delete-practice-data
 * Seed: e2e/seed.spec.ts
 */
import { test, expect } from '@playwright/test';

import { cleanupPracticeSet, createOwnedPracticeSet, ensureE2ETestUser } from './helpers/supabase';

test('confirming delete soft-deletes the set and redirects to dashboard', async ({
  page,
}) => {
  const user = await ensureE2ETestUser();
  const title = `E2E delete confirm ${Date.now()}`;
  const practiceSetId = await createOwnedPracticeSet(user.id, title);

  try {
    // Open owned set overview
    await page.goto(`/app/sets/${practiceSetId}`);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    // Inline confirm → redirect → set gone from overview
    await page.getByRole('button', { name: 'Delete this set' }).click();
    await expect(
      page.getByText('Delete this set? You won’t be able to access it again.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.waitForURL('**/app');
    await expect(page.getByRole('link', { name: /Your practice sets/i })).toBeVisible();

    // Direct navigation to deleted set redirects away
    await page.goto(`/app/sets/${practiceSetId}`);
    await page.waitForURL('**/app');
    await expect(page.getByRole('heading', { name: title })).not.toBeVisible();
  } finally {
    await cleanupPracticeSet(practiceSetId, { hard: true }).catch(() => undefined);
  }
});
