import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFakeSupabase } from '../../../support/fake-supabase';
import { makeApiContext } from '../../../support/fake-context';

vi.mock('../../../../src/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock('../../../../src/lib/billing/stripe', () => ({
  getStripeClient: vi.fn(),
}));

vi.mock('../../../../src/lib/server/env', () => ({
  requireEnv: vi.fn((key: string) => {
    if (key === 'PUBLIC_SITE_URL') return 'https://prepahead.dev';
    throw new Error(`unexpected env key: ${key}`);
  }),
}));

import { getStripeClient } from '../../../../src/lib/billing/stripe';
import { createSupabaseServerClient } from '../../../../src/lib/supabase/server';
import { GET } from '../../../../src/pages/api/billing/portal';

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/billing/portal', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(createSupabaseServerClient).mockReturnValue(
      createFakeSupabase({ user: null }).client,
    );

    const res = await GET(
      makeApiContext({ url: 'http://localhost:4321/api/billing/portal' }),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('unauthorized');
  });

  it('302 to Stripe Portal when authenticated with stripe_customer_id', async () => {
    vi.mocked(createSupabaseServerClient).mockReturnValue(
      createFakeSupabase({
        user: { id: 'user-1' },
        tables: {
          profiles: {
            select: { data: { stripe_customer_id: 'cus_test' } },
          },
        },
      }).client,
    );
    vi.mocked(getStripeClient).mockReturnValue({
      billingPortal: {
        sessions: {
          create: vi.fn().mockResolvedValue({
            url: 'https://billing.stripe.com/session/test',
          }),
        },
      },
    } as never);

    const res = await GET(
      makeApiContext({ url: 'http://localhost:4321/api/billing/portal' }),
    );

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(
      'https://billing.stripe.com/session/test',
    );
  });
});
