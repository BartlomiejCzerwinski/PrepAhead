import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createFakeSupabase,
  freeUserSummaryRow,
  proUserSummaryRow,
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
vi.mock('../../../../src/lib/server/usage/increment-check-usage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/lib/server/usage/increment-check-usage')>();
  return {
    ...actual,
    incrementCheckUsageForUser: vi.fn(actual.incrementCheckUsageForUser),
    readCheckRemaining: vi.fn(actual.readCheckRemaining),
  };
});

import { createSupabaseServerClient } from '../../../../src/lib/supabase/server';
import { runOpenEndedCheck } from '../../../../src/lib/server/practice/run-open-ended-check';
import {
  getCheckIncrementRpcName,
  incrementCheckUsageForUser,
  readCheckRemaining,
} from '../../../../src/lib/server/usage/increment-check-usage';
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
    postIncrementSummaryRow?: Record<string, unknown>;
    updateRows?: unknown;
  } = {},
): FakeSupabaseSeed {
  const preflightRow = overrides.summaryRow ?? freeUserSummaryRow();
  const postIncrementRow =
    overrides.postIncrementSummaryRow ??
    freeUserSummaryRow({
      check_count:
        typeof preflightRow.check_count === 'number' ? preflightRow.check_count + 1 : 1,
    });

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
      get_current_usage_summary: { data: preflightRow },
      get_current_usage_summary_after_increment: { data: postIncrementRow },
    },
  };
}

function checkRequest() {
  return makeApiContext({ params: { id: 'set-1' }, body: { questionId: 'oe-1', answerText: ANSWER } });
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(runOpenEndedCheck).mockResolvedValue({ ok: true, feedback: 'Helpful feedback.' });
  vi.mocked(incrementCheckUsageForUser).mockResolvedValue({ ok: true, checkCount: 1 });
  vi.mocked(readCheckRemaining).mockImplementation(async () => 4);
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
    expect(incrementCheckUsageForUser).not.toHaveBeenCalled();
    expect(rpcNames(fake)).not.toContain(getCheckIncrementRpcName());
  });

  it('success: AI called, increments exactly once, remaining from post-increment summary', async () => {
    const fake = mockClient(readySeed());
    vi.mocked(readCheckRemaining).mockResolvedValueOnce(4);
    const res = await POST(checkRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.feedback).toBe('Helpful feedback.');
    expect(body.checkRemaining).toBe(4);
    expect(runOpenEndedCheck).toHaveBeenCalledTimes(1);
    expect(incrementCheckUsageForUser).toHaveBeenCalledTimes(1);
    expect(incrementCheckUsageForUser).toHaveBeenCalledWith('u1');
    expect(readCheckRemaining).toHaveBeenCalledTimes(1);
    expect(rpcNames(fake)).not.toContain('increment_check_usage');
  });

  it('success on PRO: remaining comes from refreshed getUsageSummary', async () => {
    mockClient(
      readySeed({
        summaryRow: proUserSummaryRow({ check_count: 0 }),
        postIncrementSummaryRow: proUserSummaryRow({ check_count: 1 }),
      }),
    );
    vi.mocked(readCheckRemaining).mockResolvedValueOnce(499);
    const res = await POST(checkRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checkRemaining).toBe(499);
    expect(incrementCheckUsageForUser).toHaveBeenCalledTimes(1);
  });

  it('fails when increment is skipped (metering contract)', async () => {
    mockClient(readySeed());
    vi.mocked(incrementCheckUsageForUser).mockResolvedValueOnce({
      ok: false,
      code: 'skipped',
      message: 'increment not called',
    });
    const res = await POST(checkRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('usage_increment_failed');
    expect(readCheckRemaining).not.toHaveBeenCalled();
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
    expect(incrementCheckUsageForUser).not.toHaveBeenCalled();
  });

  it('persist failure: 500 and no increment (no charge)', async () => {
    const fake = mockClient(readySeed({ updateRows: [] }));
    const res = await POST(checkRequest());
    expect(res.status).toBe(500);
    expect(incrementCheckUsageForUser).not.toHaveBeenCalled();
    expect(rpcNames(fake)).not.toContain(getCheckIncrementRpcName());
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
    expect(incrementCheckUsageForUser).not.toHaveBeenCalled();
  });

  it('increment failure after persist: 500, not ok, no stale remaining', async () => {
    mockClient(readySeed());
    vi.mocked(incrementCheckUsageForUser).mockResolvedValueOnce({
      ok: false,
      code: 'XX999',
      message: 'increment failed',
    });
    const res = await POST(checkRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('usage_increment_failed');
    expect(body.checkRemaining).toBeUndefined();
    expect(incrementCheckUsageForUser).toHaveBeenCalledTimes(1);
    expect(readCheckRemaining).not.toHaveBeenCalled();
  });
});
