import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createFakeSupabase,
  freeUserSummaryRow,
  type FakeSupabaseSeed,
} from '../../../support/fake-supabase';
import { makeApiContext } from '../../../support/fake-context';
import { CV_MARKER, JD_MARKER, makePracticeContent } from '../../../support/fixtures';

vi.mock('../../../../src/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock('../../../../src/lib/server/practice/run-open-ended-check', () => ({
  runOpenEndedCheck: vi.fn(),
}));

import { createSupabaseServerClient } from '../../../../src/lib/supabase/server';
import { runOpenEndedCheck } from '../../../../src/lib/server/practice/run-open-ended-check';
import { POST } from '../../../../src/pages/api/practice-sets/[id]/check';

const ANSWER = 'x'.repeat(50);

function mockClient(seed: FakeSupabaseSeed) {
  const fake = createFakeSupabase(seed);
  vi.mocked(createSupabaseServerClient).mockReturnValue(fake.client);
  return fake;
}

function rpcNames(fake: ReturnType<typeof createFakeSupabase>): string[] {
  return fake.calls.rpc.map((c) => c.name);
}

/** A seed where ownership read + succeeded job + persist all succeed. */
function readySeed(
  overrides: {
    content?: Record<string, unknown>;
    summaryRow?: Record<string, unknown>;
    updateRows?: unknown;
    incrementError?: unknown;
  } = {},
): FakeSupabaseSeed {
  return {
    user: { id: 'u1' },
    tables: {
      practice_sets: {
        select: {
          data: {
            id: 'set-1',
            content: overrides.content ?? makePracticeContent(),
            status: 'in_progress',
            job_description_text: JD_MARKER,
            cv_text: CV_MARKER,
          },
        },
        update: { data: overrides.updateRows ?? [{ id: 'set-1' }] },
      },
      generation_jobs: { select: { data: { status: 'succeeded' } } },
    },
    rpc: {
      get_current_usage_summary: { data: overrides.summaryRow ?? freeUserSummaryRow() },
      increment_check_usage: { error: overrides.incrementError ?? null },
    },
  };
}

function checkRequest() {
  return makeApiContext({ params: { id: 'set-1' }, body: { questionId: 'oe-1', answerText: ANSWER } });
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(runOpenEndedCheck).mockResolvedValue({ ok: true, feedback: 'Helpful feedback.' });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/practice-sets/[id]/check — gating & metering contract', () => {
  it('401 when unauthenticated', async () => {
    mockClient({ user: null });
    const res = await POST(checkRequest());
    expect(res.status).toBe(401);
  });

  it('403 at the Check limit, with no AI call and no increment', async () => {
    const fake = mockClient(readySeed({ summaryRow: freeUserSummaryRow({ check_count: 5 }) }));
    const res = await POST(checkRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('check_limit_reached');
    expect(body.checkRemaining).toBe(0);
    expect(runOpenEndedCheck).not.toHaveBeenCalled();
    expect(rpcNames(fake)).not.toContain('increment_check_usage');
  });

  it('success: AI called, increments exactly once, remaining decremented', async () => {
    const fake = mockClient(readySeed());
    const res = await POST(checkRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.feedback).toBe('Helpful feedback.');
    expect(body.checkRemaining).toBe(4);
    expect(runOpenEndedCheck).toHaveBeenCalledTimes(1);
    expect(rpcNames(fake).filter((n) => n === 'increment_check_usage')).toHaveLength(1);
  });

  it('AI failure: no persist and no increment (no charge)', async () => {
    vi.mocked(runOpenEndedCheck).mockResolvedValue({
      ok: false,
      code: 'provider_error',
      message: 'provider down',
    });
    const fake = mockClient(readySeed());
    const res = await POST(checkRequest());
    expect(res.status).toBe(502);
    expect(fake.calls.updates).toHaveLength(0);
    expect(rpcNames(fake)).not.toContain('increment_check_usage');
  });

  it('persist failure: 500 and no increment (no charge)', async () => {
    const fake = mockClient(readySeed({ updateRows: [] }));
    const res = await POST(checkRequest());
    expect(res.status).toBe(500);
    expect(rpcNames(fake)).not.toContain('increment_check_usage');
  });

  it('already-checked question: 409 with no AI call and no increment', async () => {
    const fake = mockClient(
      readySeed({
        content: makePracticeContent([
          {
            answerText: 'prior',
            checkFeedback: 'prior feedback',
            checkedAt: '2026-06-01T00:00:00.000Z',
          },
        ]),
      }),
    );
    const res = await POST(checkRequest());
    expect(res.status).toBe(409);
    expect(runOpenEndedCheck).not.toHaveBeenCalled();
    expect(rpcNames(fake)).not.toContain('increment_check_usage');
  });

  it('increment-RPC failure after persist: still ok, under-counted (remaining unchanged)', async () => {
    const fake = mockClient(readySeed({ incrementError: { code: 'XX999' } }));
    const res = await POST(checkRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.feedback).toBe('Helpful feedback.');
    // Persist succeeded but the increment failed → user keeps feedback, is not
    // charged (accepted v1 under-count edge), so remaining stays at 5 not 4.
    expect(body.checkRemaining).toBe(5);
    expect(rpcNames(fake).filter((n) => n === 'increment_check_usage')).toHaveLength(1);
  });
});
