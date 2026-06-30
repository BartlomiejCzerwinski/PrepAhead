import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFakeSupabase } from '../../../support/fake-supabase';
import { makeApiContext } from '../../../support/fake-context';

vi.mock('../../../../src/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

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
});
