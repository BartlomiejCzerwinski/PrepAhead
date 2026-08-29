/**
 * Risk: stripe-pro-subscription Phase 3 — checkout redirect binds auth user to Payment Link.
 * Change: stripe-pro-subscription
 * Seed: e2e/seed.spec.ts
 */
import { test, expect } from '@playwright/test';

import { loadE2EEnv, requireStripePaymentLinkUrl } from './helpers/env';
import { resetBillingTestUser } from './helpers/billing';
import { ensureE2ETestUser } from './helpers/supabase';

test('authenticated checkout redirect includes user binding params', async ({ page }) => {
  const env = loadE2EEnv();
  const paymentLink = requireStripePaymentLinkUrl(env);
  const user = await ensureE2ETestUser();

  try {
    const response = await page.request.get('/api/billing/checkout-redirect', {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(302);

    const location = response.headers().location;
    expect(location).toBeTruthy();

    const redirectUrl = new URL(location!);
    expect(redirectUrl.origin + redirectUrl.pathname).toBe(
      new URL(paymentLink).origin + new URL(paymentLink).pathname,
    );
    expect(redirectUrl.searchParams.get('client_reference_id')).toBe(user.id);
    expect(redirectUrl.searchParams.get('prefilled_email')).toBe(user.email);
  } finally {
    await resetBillingTestUser(user.id).catch(() => undefined);
  }
});
