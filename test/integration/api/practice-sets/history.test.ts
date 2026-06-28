import { describe, expect, it } from 'vitest';

import { createFakeSupabase } from '../../../support/fake-supabase';
import { makePracticeContent } from '../../../support/fixtures';
import {
  listPracticeSetSummaries,
  PRACTICE_SET_HISTORY_LIMIT,
} from '../../../../src/lib/practice/history';

const USER_ID = 'owner-123';

function completeContent(): Record<string, unknown> {
  const content = makePracticeContent(
    Array.from({ length: 5 }, () => ({ answerText: 'ans', checkedAt: '2026-06-02T00:00:00.000Z' })),
  );
  content.questions = (content.questions as Array<Record<string, unknown>>).map((question) =>
    question.type === 'abcd'
      ? { ...question, selectedOptionId: 'A', answeredAt: '2026-06-02T00:00:00.000Z' }
      : question,
  );
  return content;
}

function seededRows() {
  return [
    {
      id: 'set-new',
      title: 'Newest set',
      status: 'completed',
      content: completeContent(),
      created_at: '2026-06-10T00:00:00.000Z',
      cv_text: 'cv present',
    },
    {
      id: 'set-old',
      title: 'Older set',
      status: 'in_progress',
      content: {},
      created_at: '2026-06-01T00:00:00.000Z',
      cv_text: null,
    },
  ];
}

describe('listPracticeSetSummaries — scoping + mapping', () => {
  it('scopes by user_id and soft-delete, and maps rows', async () => {
    const fake = createFakeSupabase({
      tables: { practice_sets: { select: { data: seededRows() } } },
    });

    const result = await listPracticeSetSummaries(fake.client, USER_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // IDOR discipline (mirrors idor.test.ts:129-140): the reader must request
    // the user_id predicate and the soft-delete filter on practice_sets.
    expect(fake.calls.filters).toContainEqual({
      table: 'practice_sets',
      column: 'user_id',
      value: USER_ID,
    });
    expect(fake.calls.filters).toContainEqual({
      table: 'practice_sets',
      column: 'deleted_at',
      value: null,
    });

    expect(result.data).toHaveLength(2);

    // Order/limit are DB-enforced (the `created_at desc` partial index + `.limit(50)`),
    // not asserted here: the fake treats `.order()`/`.limit()` as no-ops
    // (fake-supabase.ts:117-123), so this only reflects the seed array order.
    const [newest, older] = result.data;
    expect(newest.id).toBe('set-new');
    expect(newest.statusLabel).toBe('completed');
    expect(newest.contentReady).toBe(true);
    expect(newest.abcdScorePercent).toBe(100);
    expect(newest.hasCv).toBe(true);

    expect(older.id).toBe('set-old');
    expect(older.statusLabel).toBe('in_progress');
    expect(older.contentReady).toBe(false);
    expect(older.abcdScorePercent).toBeNull();
    expect(older.hasCv).toBe(false);
  });

  it('returns an empty list when the user has no sets', async () => {
    const fake = createFakeSupabase({
      tables: { practice_sets: { select: { data: [] } } },
    });

    const result = await listPracticeSetSummaries(fake.client, USER_ID);

    expect(result).toEqual({ ok: true, data: [] });
  });

  it('returns { ok: false } on a read error', async () => {
    const fake = createFakeSupabase({
      tables: { practice_sets: { select: { error: { message: 'boom' } } } },
    });

    const result = await listPracticeSetSummaries(fake.client, USER_ID);

    expect(result).toEqual({ ok: false });
  });

  it('exposes the documented history cap', () => {
    expect(PRACTICE_SET_HISTORY_LIMIT).toBe(50);
  });
});
