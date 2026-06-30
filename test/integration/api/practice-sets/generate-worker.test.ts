import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createFakeSupabase,
  type FakeSupabaseSeed,
} from '../../../support/fake-supabase';
import { makeApiContext } from '../../../support/fake-context';
import { makePracticeContent } from '../../../support/fixtures';

vi.mock('../../../../src/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock('../../../../src/lib/server/practice/generate-practice-set', () => ({
  generatePracticeSet: vi.fn(),
}));

import { createSupabaseServerClient } from '../../../../src/lib/supabase/server';
import { generatePracticeSet } from '../../../../src/lib/server/practice/generate-practice-set';
import { POST } from '../../../../src/pages/api/practice-sets/generate-worker';

// NOTE: the atomic generation cap and the `usage_incremented_at` idempotency
// guard live INSIDE the SQL RPC `finalize_generation_job` and are not reachable
// by this in-process mock. These tests assert only the handler's orchestration
// (which RPC is called, and when); the SQL-internal enforcement is verified only
// once a real-Supabase layer is added (future test-plan phase).

function mockClient(seed: FakeSupabaseSeed) {
  const fake = createFakeSupabase(seed);
  vi.mocked(createSupabaseServerClient).mockReturnValue(fake.client);
  return fake;
}

function rpcNames(fake: ReturnType<typeof createFakeSupabase>): string[] {
  return fake.calls.rpc.map((c) => c.name);
}

afterEach(() => {
  vi.clearAllMocks();
});

const QUEUED_JOB = {
  id: 'job-1',
  practice_set_id: 'ps-1',
  status: 'queued',
  failure_code: null,
  failure_message: null,
  started_at: null,
};

describe('POST /api/practice-sets/generate-worker — metering orchestration', () => {
  it('on success: finalizes and never marks failed', async () => {
    vi.mocked(generatePracticeSet).mockResolvedValue({
      ok: true,
      title: 'Generated set',
      content: makePracticeContent() as never,
    });

    const fake = mockClient({
      user: { id: 'u1' },
      tables: {
        generation_jobs: {
          select: { data: QUEUED_JOB },
          update: { data: { id: 'job-1', practice_set_id: 'ps-1' } },
        },
        practice_sets: {
          select: { data: { id: 'ps-1', job_description_text: 'JD', cv_text: null } },
        },
      },
      rpc: { finalize_generation_job: { data: [{ practice_set_id: 'ps-1' }] } },
    });

    const res = await POST(makeApiContext({ body: { jobId: 'job-1' } }));
    expect(res.status).toBe(200);
    expect(rpcNames(fake)).toContain('finalize_generation_job');
    expect(rpcNames(fake)).not.toContain('mark_generation_job_failed');
  });

  it('on generation failure: marks failed and never finalizes (no charge)', async () => {
    vi.mocked(generatePracticeSet).mockResolvedValue({
      ok: false,
      code: 'malformed_output',
      message: 'bad output',
    });

    const fake = mockClient({
      user: { id: 'u1' },
      tables: {
        generation_jobs: {
          select: { data: QUEUED_JOB },
          update: { data: { id: 'job-1', practice_set_id: 'ps-1' } },
        },
        practice_sets: {
          select: { data: { id: 'ps-1', job_description_text: 'JD', cv_text: null } },
        },
      },
    });

    const res = await POST(makeApiContext({ body: { jobId: 'job-1' } }));
    expect(res.status).toBe(422);
    expect(rpcNames(fake)).toContain('mark_generation_job_failed');
    expect(rpcNames(fake)).not.toContain('finalize_generation_job');
  });

  it('already-succeeded job: returns early without re-finalizing (no double-count)', async () => {
    const fake = mockClient({
      user: { id: 'u1' },
      tables: {
        generation_jobs: {
          select: { data: { ...QUEUED_JOB, status: 'succeeded' } },
        },
      },
    });

    const res = await POST(makeApiContext({ body: { jobId: 'job-1' } }));
    expect(res.status).toBe(200);
    expect(rpcNames(fake)).not.toContain('finalize_generation_job');
    expect(rpcNames(fake)).not.toContain('mark_generation_job_failed');
    expect(generatePracticeSet).not.toHaveBeenCalled();
  });
});
