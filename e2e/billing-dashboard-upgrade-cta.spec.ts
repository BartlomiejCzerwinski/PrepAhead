/**
 * Risk: stripe-pro-subscription Phase 3 — FREE upgrade CTA routes to checkout redirect.
 * Change: stripe-pro-subscription
 * Seed: e2e/seed.spec.ts
 */
import { test, expect } from '@playwright/test';

import { loadE2EEnv, requireStripePaymentLinkUrl } from './helpers/env';
import {
  resetBillingTestUser,
  seedFreeUserAtGenerationLimit,
} from './helpers/billing';
import { ensureE2ETestUser } from './helpers/supabase';

test('FREE user at generation limit sees upgrade CTA to checkout redirect', async ({
  page,
}) => {
  const env = loadE2EEnv();
  requireStripePaymentLinkUrl(env);
  const user = await ensureE2ETestUser();

  try {
    await seedFreeUserAtGenerationLimit(user.id);

    await page.goto('/app');
    await expect(page.getByRole('heading', { name: 'Usage dashboard' })).toBeVisible();
    await expect(page.getByText('FREE', { exact: true })).toBeVisible();

    const paymentLinkHost = new URL(env.stripePaymentLinkUrl).host;
    const upgradeLink = page.getByRole('link', { name: 'Upgrade to PRO' }).first();
    await expect(upgradeLink).toBeVisible();
    await expect(upgradeLink).toHaveAttribute('href', '/api/billing/checkout-redirect');

    const redirectResponse = await page.request.get('/api/billing/checkout-redirect', {
      maxRedirects: 0,
    });
    expect(redirectResponse.status()).toBe(302);
    const redirectUrl = new URL(redirectResponse.headers().location!);
    expect(redirectUrl.host).toBe(paymentLinkHost);
    expect(redirectUrl.searchParams.get('client_reference_id')).toBe(user.id);
    expect(redirectUrl.searchParams.get('prefilled_email')).toBe(user.email);
  } finally {
    await resetBillingTestUser(user.id).catch(() => undefined);
  }
});
