/**
 * Risk: stripe-pro-subscription Phase 3 — billing routes reject unauthenticated callers.
 * Change: stripe-pro-subscription
 * Seed: e2e/seed.spec.ts
 */
import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('checkout redirect returns unauthorized without a session', async ({ request }) => {
  const response = await request.get('/api/billing/checkout-redirect', {
    maxRedirects: 0,
  });

  expect(response.status()).toBe(401);
  expect(await response.json()).toMatchObject({ error: 'unauthorized' });
});

test('customer portal returns unauthorized without a session', async ({ request }) => {
  const response = await request.get('/api/billing/portal', {
    maxRedirects: 0,
  });

  expect(response.status()).toBe(401);
  expect(await response.json()).toMatchObject({ error: 'unauthorized' });
});
