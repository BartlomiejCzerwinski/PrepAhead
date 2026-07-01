import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFakeSupabase } from '../../../support/fake-supabase';
import { makeApiContext } from '../../../support/fake-context';

vi.mock('../../../../src/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock('../../../../src/lib/server/env', () => ({
  requireEnv: vi.fn((key: string) => {
    if (key === 'STRIPE_PAYMENT_LINK_URL') {
      return 'https://buy.stripe.com/test_link';
    }
    throw new Error(`unexpected env key: ${key}`);
  }),
}));

import { createSupabaseServerClient } from '../../../../src/lib/supabase/server';
import { GET } from '../../../../src/pages/api/billing/checkout-redirect';

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/billing/checkout-redirect', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(createSupabaseServerClient).mockReturnValue(
      createFakeSupabase({ user: null }).client,
    );

    const res = await GET(
      makeApiContext({ url: 'http://localhost:4321/api/billing/checkout-redirect' }),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('unauthorized');
  });

  it('302 with client_reference_id when authenticated', async () => {
    vi.mocked(createSupabaseServerClient).mockReturnValue(
      createFakeSupabase({
        user: { id: 'user-abc', email: 'candidate@example.com' },
      }).client,
    );

    const res = await GET(
      makeApiContext({ url: 'http://localhost:4321/api/billing/checkout-redirect' }),
    );

    expect(res.status).toBe(302);
    const location = res.headers.get('Location');
    expect(location).toBeTruthy();
    const url = new URL(location!);
    expect(url.searchParams.get('client_reference_id')).toBe('user-abc');
    expect(url.searchParams.get('prefilled_email')).toBe('candidate@example.com');
  });
});
