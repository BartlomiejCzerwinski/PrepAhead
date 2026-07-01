import type Stripe from 'stripe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFakeSupabase } from '../../../support/fake-supabase';
import { makeApiContext } from '../../../support/fake-context';

vi.mock('../../../../src/lib/server/env', () => ({
  requireEnv: vi.fn((key: string) => {
    if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test';
    throw new Error(`unexpected env key: ${key}`);
  }),
}));

vi.mock('../../../../src/lib/billing/stripe', () => ({
  getStripeClient: vi.fn(),
}));

vi.mock('../../../../src/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { getStripeClient } from '../../../../src/lib/billing/stripe';
import { createSupabaseAdminClient } from '../../../../src/lib/supabase/admin';
import { POST } from '../../../../src/pages/api/webhooks/stripe';

const PROFILE_ROW = {
  id: 'user-1',
  stripe_customer_id: 'cus_test',
  stripe_subscription_id: 'sub_test',
  subscription_grace_ends_at: null,
};

let mockEvent: Stripe.Event;

function mockAdmin(seed: Parameters<typeof createFakeSupabase>[0] = {}) {
  const fake = createFakeSupabase({
    tables: {
      stripe_webhook_events: {
        select: { data: null },
        insert: { data: null, error: null },
      },
      profiles: {
        select: { data: PROFILE_ROW },
      },
    },
    rpc: {
      set_plan_tier_from_billing: { data: null, error: null },
    },
    ...seed,
  });
  vi.mocked(createSupabaseAdminClient).mockReturnValue(fake.client);
  return fake;
}

function mockStripe() {
  vi.mocked(getStripeClient).mockReturnValue({
    webhooks: {
      constructEvent: vi.fn(() => mockEvent),
    },
    checkout: {
      sessions: {
        retrieve: vi.fn(),
      },
    },
  } as never);
}

function checkoutSessionEvent(
  session: Partial<Stripe.Checkout.Session>,
): Stripe.Event {
  return {
    id: 'evt_checkout_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test',
        client_reference_id: 'user-1',
        customer: 'cus_test',
        subscription: 'sub_test',
        customer_details: { email: 'test@example.com' },
        ...session,
      } as Stripe.Checkout.Session,
    },
  } as Stripe.Event;
}

beforeEach(() => {
  mockStripe();
});

afterEach(() => {
  vi.clearAllMocks();
});

function webhookContext(body: unknown) {
  return makeApiContext({
    method: 'POST',
    body,
    url: 'http://localhost:4321/api/webhooks/stripe',
    headers: { 'stripe-signature': 't=0,v1=test' },
  });
}

describe('POST /api/webhooks/stripe', () => {
  it('400 when Stripe-Signature header is missing', async () => {
    const res = await POST(
      makeApiContext({
        method: 'POST',
        body: '{}',
        url: 'http://localhost:4321/api/webhooks/stripe',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('checkout.session.completed upgrades PRO when email binding matches', async () => {
    mockEvent = checkoutSessionEvent({});
    const fake = mockAdmin({
      adminUsers: {
        'user-1': { email: 'test@example.com' },
      },
    });

    const res = await POST(webhookContext(JSON.stringify(mockEvent)));

    expect(res.status).toBe(200);
    const billingCall = fake.calls.rpc.find(
      (c) => c.name === 'set_plan_tier_from_billing',
    );
    expect(billingCall?.params).toMatchObject({
      p_user_id: 'user-1',
      p_plan_tier: 'PRO',
      p_stripe_customer_id: 'cus_test',
      p_stripe_subscription_id: 'sub_test',
      p_grace_ends_at: null,
    });
  });

  it('checkout.session.completed skips upgrade on email mismatch', async () => {
    mockEvent = checkoutSessionEvent({
      customer_details: { email: 'other@example.com' } as Stripe.Checkout.Session['customer_details'],
    });
    const fake = mockAdmin({
      adminUsers: {
        'user-1': { email: 'test@example.com' },
      },
    });

    const res = await POST(webhookContext(JSON.stringify(mockEvent)));

    expect(res.status).toBe(200);
    expect(
      fake.calls.rpc.some((c) => c.name === 'set_plan_tier_from_billing'),
    ).toBe(false);
  });

  it('customer.subscription.deleted downgrades to FREE', async () => {
    mockEvent = {
      id: 'evt_sub_deleted',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_test',
          customer: 'cus_test',
          status: 'canceled',
          cancel_at_period_end: false,
        } as Stripe.Subscription,
      },
    } as Stripe.Event;

    const fake = mockAdmin();

    const res = await POST(webhookContext(JSON.stringify(mockEvent)));

    expect(res.status).toBe(200);
    const billingCall = fake.calls.rpc.find(
      (c) => c.name === 'set_plan_tier_from_billing',
    );
    expect(billingCall?.params).toMatchObject({
      p_user_id: 'user-1',
      p_plan_tier: 'FREE',
      p_stripe_subscription_id: null,
      p_grace_ends_at: null,
    });
  });

  it('invoice.payment_failed sets PRO grace period', async () => {
    mockEvent = {
      id: 'evt_invoice_failed',
      type: 'invoice.payment_failed',
      data: {
        object: {
          id: 'in_test',
          customer: 'cus_test',
        } as Stripe.Invoice,
      },
    } as Stripe.Event;

    const fake = mockAdmin();

    const res = await POST(webhookContext(JSON.stringify(mockEvent)));

    expect(res.status).toBe(200);
    const billingCall = fake.calls.rpc.find(
      (c) => c.name === 'set_plan_tier_from_billing',
    );
    expect(billingCall?.params).toMatchObject({
      p_user_id: 'user-1',
      p_plan_tier: 'PRO',
      p_stripe_customer_id: 'cus_test',
      p_stripe_subscription_id: 'sub_test',
    });
    const params = billingCall?.params as Record<string, unknown> | undefined;
    expect(params).toHaveProperty('p_grace_ends_at');
    expect(params?.p_grace_ends_at).not.toBeNull();
  });

  it('skips re-processing when event id was already recorded', async () => {
    mockEvent = checkoutSessionEvent({});
    const fake = mockAdmin({
      adminUsers: {
        'user-1': { email: 'test@example.com' },
      },
      tables: {
        stripe_webhook_events: {
          select: { data: { event_id: 'evt_checkout_1' } },
          insert: { data: null, error: null },
        },
        profiles: {
          select: { data: PROFILE_ROW },
        },
      },
    });

    const res = await POST(webhookContext(JSON.stringify(mockEvent)));

    expect(res.status).toBe(200);
    expect(fake.calls.rpc).toHaveLength(0);
  });
});
