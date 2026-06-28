import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createFakeSupabase,
  freeUserSummaryRow,
  type FakeSupabaseSeed,
} from '../../../support/fake-supabase';
import { makeApiContext } from '../../../support/fake-context';

// Route/integration tests live OUTSIDE src/pages: Astro routes every file under
// src/pages, so a `*.test.ts` there is built as an endpoint and crashes the
// build when it loads Vitest. `vi.mock` resolves by absolute module path, so
// mocking the route's deep relative imports from here works unchanged.
vi.mock('../../../../src/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from '../../../../src/lib/supabase/server';
import { POST } from '../../../../src/pages/api/practice-sets/generate';

function mockClient(seed: FakeSupabaseSeed) {
  const fake = createFakeSupabase(seed);
  vi.mocked(createSupabaseServerClient).mockReturnValue(fake.client);
  return fake;
}

beforeEach(() => {
  // The route fire-and-forgets a worker nudge via fetch; stub it so no real
  // network call happens during the test.
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null))));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('POST /api/practice-sets/generate — gating', () => {
  it('401 when unauthenticated', async () => {
    mockClient({ user: null });
    const res = await POST(makeApiContext({ body: { jobDescription: 'JD' } }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('unauthorized');
  });

  it('403 and no insert when at the FREE generation limit', async () => {
    const fake = mockClient({
      user: { id: 'u1' },
      rpc: { get_current_usage_summary: { data: freeUserSummaryRow({ generation_count: 1 }) } },
    });

    const res = await POST(makeApiContext({ body: { jobDescription: 'JD' } }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('generation_limit_reached');
    expect(body.upgradeUrl).toBe('/#plans');
    // No draft set / job is created when blocked.
    expect(fake.calls.inserts).toHaveLength(0);
  });

  it('short-circuits to the existing job on a repeated idempotency key', async () => {
    const fake = mockClient({
      user: { id: 'u1' },
      rpc: { get_current_usage_summary: { data: freeUserSummaryRow() } },
      tables: {
        generation_jobs: {
          select: { data: { id: 'job-existing', practice_set_id: 'ps-existing' } },
        },
      },
    });

    const res = await POST(
      makeApiContext({ body: { jobDescription: 'JD', idempotencyKey: 'key-1' } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ jobId: 'job-existing', practiceSetId: 'ps-existing' });
    expect(fake.calls.inserts).toHaveLength(0);
  });

  it('happy path creates a job (202) without metering on the request path', async () => {
    const fake = mockClient({
      user: { id: 'u1' },
      rpc: { get_current_usage_summary: { data: freeUserSummaryRow() } },
      tables: {
        generation_jobs: {
          select: { data: null },
          insert: { data: { id: 'job-1', practice_set_id: 'ps-1' } },
        },
        practice_sets: {
          insert: { data: { id: 'ps-1' } },
        },
      },
    });

    const res = await POST(makeApiContext({ body: { jobDescription: 'JD' } }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body).toMatchObject({ jobId: 'job-1', practiceSetId: 'ps-1' });
    // The only RPC on this path is the read-only usage summary — no increment.
    expect(fake.calls.rpc.map((c) => c.name)).toEqual(['get_current_usage_summary']);
  });
});
