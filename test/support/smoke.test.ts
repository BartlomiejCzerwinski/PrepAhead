import { describe, expect, it } from 'vitest';

import { createFakeSupabase } from './fake-supabase';
import { makeApiContext } from './fake-context';

describe('test harness smoke', () => {
  it('runs the runner', () => {
    expect(true).toBe(true);
  });

  it('builds a fake Supabase client without throwing', async () => {
    const { client } = createFakeSupabase({ user: { id: 'u1' } });
    const { data } = await client.auth.getUser();
    expect(data.user?.id).toBe('u1');
  });

  it('builds a fake APIContext without throwing', async () => {
    const ctx = makeApiContext({ params: { id: 'set-1' }, body: { a: 1 } });
    expect(ctx.params.id).toBe('set-1');
    await expect(ctx.request.json()).resolves.toEqual({ a: 1 });
  });
});
