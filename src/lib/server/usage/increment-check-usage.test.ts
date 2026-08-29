import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFakeSupabase } from '../../../../test/support/fake-supabase';

const SERVICE_ROLE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature';

vi.mock('../../../../src/lib/server/env', () => ({
  MissingEnvError: class MissingEnvError extends Error {
    constructor(public readonly key: string) {
      super(`Missing required environment variable: ${key}`);
      this.name = 'MissingEnvError';
    }
  },
  requireEnv: vi.fn((key: string) => {
    if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
      return SERVICE_ROLE_JWT;
    }
    if (key === 'PUBLIC_SUPABASE_ANON_KEY') {
      return 'anon-key';
    }
    throw new Error(`unexpected env key: ${key}`);
  }),
}));

vi.mock('../../../../src/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { createSupabaseAdminClient } from '../../../../src/lib/supabase/admin';
import { requireEnv } from '../../../../src/lib/server/env';
import { incrementCheckUsageForUser } from '../../../../src/lib/server/usage/increment-check-usage';

describe('incrementCheckUsageForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireEnv).mockImplementation((key: string) => {
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
        return SERVICE_ROLE_JWT;
      }
      if (key === 'PUBLIC_SUPABASE_ANON_KEY') {
        return 'anon-key';
      }
      throw new Error(`unexpected env key: ${key}`);
    });
  });

  it('calls the service-role RPC and returns check_count from a row object', async () => {
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

  it('accepts SETOF-style array payloads from PostgREST', async () => {
    const fake = createFakeSupabase({
      rpc: {
        increment_check_usage_for_user: {
          data: [
            {
              period_start: '2026-06-01T00:00:00.000Z',
              period_end: '2026-07-01T00:00:00.000Z',
              generation_count: 0,
              check_count: 2,
            },
          ],
        },
      },
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(fake.client);

    const result = await incrementCheckUsageForUser('user-1');

    expect(result).toEqual({ ok: true, checkCount: 2 });
  });

  it('rejects when SUPABASE_SERVICE_ROLE_KEY is the anon key', async () => {
    vi.mocked(requireEnv).mockImplementation((key: string) => {
      if (key === 'SUPABASE_SERVICE_ROLE_KEY' || key === 'PUBLIC_SUPABASE_ANON_KEY') {
        return 'same-key';
      }
      throw new Error(`unexpected env key: ${key}`);
    });

    const result = await incrementCheckUsageForUser('user-1');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('service_role_key_is_anon');
    }
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
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
