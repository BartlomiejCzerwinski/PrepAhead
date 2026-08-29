/**
 * Risk: stripe-pro-subscription Phase 3 — PRO dashboard exposes portal link; FREE does not.
 * Change: stripe-pro-subscription
 * Seed: e2e/seed.spec.ts
 */
import { test, expect } from '@playwright/test';

import {
  resetBillingTestUser,
  seedProUserWithStripeCustomer,
} from './helpers/billing';
import { ensureE2ETestUser } from './helpers/supabase';

test('PRO user sees manage subscription link on dashboard', async ({ page }) => {
  const user = await ensureE2ETestUser();

  try {
    await seedProUserWithStripeCustomer(user.id);

    await page.goto('/app');
    await expect(page.getByRole('heading', { name: 'Usage dashboard' })).toBeVisible();
    await expect(page.getByText('PRO', { exact: true })).toBeVisible();

    const manageLink = page.getByRole('link', { name: 'Manage subscription' });
    await expect(manageLink).toBeVisible();
    await expect(manageLink).toHaveAttribute('href', '/api/billing/portal');
  } finally {
    await resetBillingTestUser(user.id).catch(() => undefined);
  }
});

test('FREE user does not see manage subscription link', async ({ page }) => {
  const user = await ensureE2ETestUser();

  try {
    await resetBillingTestUser(user.id);

    await page.goto('/app');
    await expect(page.getByRole('heading', { name: 'Usage dashboard' })).toBeVisible();
    await expect(page.getByText('FREE', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Manage subscription' })).not.toBeVisible();
  } finally {
    await resetBillingTestUser(user.id).catch(() => undefined);
  }
});
