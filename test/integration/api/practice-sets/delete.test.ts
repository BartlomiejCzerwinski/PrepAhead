import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createFakeSupabase,
  type FakeSupabaseSeed,
} from '../../../support/fake-supabase';
import { makeApiContext } from '../../../support/fake-context';
import { ANSWER_MARKER, CV_MARKER, JD_MARKER } from '../../../support/fixtures';

vi.mock('../../../../src/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from '../../../../src/lib/supabase/server';
import { POST as deletePost } from '../../../../src/pages/api/practice-sets/[id]/delete';

function mockClient(seed: FakeSupabaseSeed) {
  const fake = createFakeSupabase(seed);
  vi.mocked(createSupabaseServerClient).mockReturnValue(fake.client);
  return fake;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/practice-sets/[id]/delete — soft-delete', () => {
  it('soft-deletes a set the owner holds and returns ok', async () => {
    const fake = mockClient({
      user: { id: 'owner' },
      tables: { practice_sets: { update: { data: [{ id: 'set-1' }] } } },
    });

    const res = await deletePost(makeApiContext({ params: { id: 'set-1' }, method: 'POST' }));

    expect(res.status).toBe(200);
    expect(JSON.parse(await res.text())).toEqual({ ok: true });

    // The mutation must be a soft-delete (stamp deleted_at), scoped by user_id
    // and gated on the row not already being deleted.
    expect(fake.calls.updates).toHaveLength(1);
    expect(fake.calls.updates[0].table).toBe('practice_sets');
    expect(fake.calls.updates[0].payload).toMatchObject({
      deleted_at: expect.any(String),
    });
    expect(fake.calls.filters).toContainEqual({
      table: 'practice_sets',
      column: 'user_id',
      value: 'owner',
    });
    expect(fake.calls.filters).toContainEqual({
      table: 'practice_sets',
      column: 'deleted_at',
      value: null,
    });

    // A pure delete must never read or hard-delete the row.
    expect(fake.calls.deletes).toHaveLength(0);
  });

  it('returns 404 for a non-owner without leaking content', async () => {
    // A non-owner's ownership-scoped UPDATE matches zero rows → empty select.
    const fake = mockClient({
      user: { id: 'attacker' },
      tables: { practice_sets: { update: { data: [] } } },
    });

    const res = await deletePost(makeApiContext({ params: { id: 'victim-set' }, method: 'POST' }));

    expect(res.status).toBe(404);
    const text = await res.text();
    expect(JSON.parse(text).error).toBe('practice_set_not_found');

    expect(text).not.toContain(JD_MARKER);
    expect(text).not.toContain(CV_MARKER);
    expect(text).not.toContain(ANSWER_MARKER);

    // The 404 must come from the ownership predicate: a dropped `.eq('user_id')`
    // would be the IDOR regression.
    expect(fake.calls.filters).toContainEqual({
      table: 'practice_sets',
      column: 'user_id',
      value: 'attacker',
    });
    expect(fake.calls.filters).toContainEqual({
      table: 'practice_sets',
      column: 'deleted_at',
      value: null,
    });
  });

  it('returns 401 for an unauthenticated caller and never mutates', async () => {
    const fake = mockClient({ user: null });

    const res = await deletePost(makeApiContext({ params: { id: 'set-1' }, method: 'POST' }));

    expect(res.status).toBe(401);
    expect(fake.calls.updates).toHaveLength(0);
  });

  it('returns 400 when the practice set id is missing', async () => {
    const fake = mockClient({ user: { id: 'owner' } });

    const res = await deletePost(makeApiContext({ params: { id: '   ' }, method: 'POST' }));

    expect(res.status).toBe(400);
    expect(JSON.parse(await res.text()).error).toBe('missing_practice_set_id');
    expect(fake.calls.updates).toHaveLength(0);
  });
});
