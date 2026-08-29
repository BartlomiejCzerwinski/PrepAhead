import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFakeSupabase } from '../../../../test/support/fake-supabase';

vi.mock('../../../../src/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { createSupabaseAdminClient } from '../../../../src/lib/supabase/admin';
import { incrementCheckUsageForUser } from '../../../../src/lib/server/usage/increment-check-usage';

describe('incrementCheckUsageForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls the service-role RPC and returns check_count', async () => {
    const fake = createFakeSupabase({
      rpc: {
        increment_check_usage_for_user: {
          data: {
            period_start: '2026-06-01T00:00:00.000Z',
            period_end: '2026-07-01T00:00:00.000Z',
            generation_count: 0,
            check_count: 3,
          },
        },
      },
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(fake.client);

    const result = await incrementCheckUsageForUser('user-1');

    expect(result).toEqual({ ok: true, checkCount: 3 });
    expect(fake.calls.rpc).toEqual([
      { name: 'increment_check_usage_for_user', params: { p_user_id: 'user-1' } },
    ]);
  });

  it('surfaces RPC errors instead of pretending increment succeeded', async () => {
    const fake = createFakeSupabase({
      rpc: {
        increment_check_usage_for_user: {
          error: { code: '42501', message: 'permission denied' },
        },
      },
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(fake.client);

    const result = await incrementCheckUsageForUser('user-1');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('42501');
    }
  });
});
