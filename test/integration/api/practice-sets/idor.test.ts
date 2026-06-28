import type { APIRoute } from 'astro';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createFakeSupabase,
  type FakeSupabaseSeed,
} from '../../../support/fake-supabase';
import { makeApiContext } from '../../../support/fake-context';
import { ANSWER_MARKER, CV_MARKER, JD_MARKER } from '../../../support/fixtures';

vi.mock('../../../../src/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock('../../../../src/lib/server/practice/run-open-ended-check', () => ({
  runOpenEndedCheck: vi.fn(),
}));

import { createSupabaseServerClient } from '../../../../src/lib/supabase/server';
import { runOpenEndedCheck } from '../../../../src/lib/server/practice/run-open-ended-check';
import { POST as answerPost } from '../../../../src/pages/api/practice-sets/[id]/answer';
import { POST as savePost } from '../../../../src/pages/api/practice-sets/[id]/save-answer';
import { POST as checkPost } from '../../../../src/pages/api/practice-sets/[id]/check';
import { GET as statusGet } from '../../../../src/pages/api/practice-sets/[id]/status';

function mockClient(seed: FakeSupabaseSeed) {
  const fake = createFakeSupabase(seed);
  vi.mocked(createSupabaseServerClient).mockReturnValue(fake.client);
  return fake;
}

/**
 * A signed-in but NON-owning caller: every owner-scoped read
 * (`.eq('user_id', user.id)`) misses, so `practice_sets`/`generation_jobs`
 * resolve to null — exactly what the real client + RLS would return for a row
 * the caller does not own.
 */
function nonOwnerSeed(): FakeSupabaseSeed {
  return {
    user: { id: 'attacker' },
    tables: {
      practice_sets: { select: { data: null } },
      generation_jobs: { select: { data: null } },
    },
  };
}

type RouteCase = {
  name: string;
  handler: APIRoute;
  body?: unknown;
  notFoundError: string;
  mutating: boolean;
  isCheck?: boolean;
  /** Table whose owner-scoped read gates the route (the null-read → 404 path). */
  scopedTable: string;
  /** Whether the scoped read also applies the soft-delete `.is('deleted_at', null)` filter. */
  softDeleteScoped: boolean;
};

const cases: RouteCase[] = [
  {
    name: 'answer',
    handler: answerPost,
    body: { questionId: 'q-1', selectedOptionId: 'A' },
    notFoundError: 'practice_set_not_found',
    mutating: true,
    scopedTable: 'practice_sets',
    softDeleteScoped: true,
  },
  {
    name: 'save-answer',
    handler: savePost,
    body: { questionId: 'oe-1', answerText: 'a draft answer' },
    notFoundError: 'practice_set_not_found',
    mutating: true,
    scopedTable: 'practice_sets',
    softDeleteScoped: true,
  },
  {
    name: 'check',
    handler: checkPost,
    body: { questionId: 'oe-1', answerText: 'x'.repeat(50) },
    notFoundError: 'practice_set_not_found',
    mutating: true,
    isCheck: true,
    scopedTable: 'practice_sets',
    softDeleteScoped: true,
  },
  {
    name: 'status',
    handler: statusGet,
    notFoundError: 'job_not_found',
    mutating: false,
    scopedTable: 'generation_jobs',
    softDeleteScoped: false,
  },
];

beforeEach(() => {
  vi.mocked(runOpenEndedCheck).mockResolvedValue({ ok: true, feedback: 'unused' });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('practice-set [id] routes — IDOR / authorization', () => {
  it.each(cases)(
    '$name: a non-owner gets 404 and no data is served or mutated',
    async (route) => {
      const fake = mockClient(nonOwnerSeed());

      const res = await route.handler(
        makeApiContext({ params: { id: 'victim-set' }, body: route.body }),
      );

      expect(res.status).toBe(404);
      const text = await res.text();
      expect(JSON.parse(text).error).toBe(route.notFoundError);

      // The denial body must never carry another user's JD/CV/answer content.
      expect(text).not.toContain(JD_MARKER);
      expect(text).not.toContain(CV_MARKER);
      expect(text).not.toContain(ANSWER_MARKER);

      // The 404 must come from the ownership predicate, not merely an empty
      // read: assert the route actually scoped its gating read by user_id (a
      // dropped `.eq('user_id', ...)` would be the IDOR regression).
      expect(fake.calls.filters).toContainEqual({
        table: route.scopedTable,
        column: 'user_id',
        value: 'attacker',
      });
      if (route.softDeleteScoped) {
        expect(fake.calls.filters).toContainEqual({
          table: route.scopedTable,
          column: 'deleted_at',
          value: null,
        });
      }

      // Mutating routes must fail closed before any write.
      if (route.mutating) {
        expect(fake.calls.updates).toHaveLength(0);
      }

      // Check must not call the AI or consume usage for a non-owner.
      if (route.isCheck) {
        expect(runOpenEndedCheck).not.toHaveBeenCalled();
        expect(fake.calls.rpc.map((c) => c.name)).not.toContain('increment_check_usage');
      }
    },
  );

  it.each(cases)('$name: an unauthenticated caller gets 401', async (route) => {
    mockClient({ user: null });

    const res = await route.handler(
      makeApiContext({ params: { id: 'victim-set' }, body: route.body }),
    );

    expect(res.status).toBe(401);
  });
});
