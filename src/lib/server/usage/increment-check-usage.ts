import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseAdminClient } from '../../supabase/admin';

export type IncrementCheckUsageResult =
  | {
      ok: true;
      checkCount: number;
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

export async function incrementCheckUsageForUser(
  userId: string,
): Promise<IncrementCheckUsageResult> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .rpc('increment_check_usage_for_user', { p_user_id: userId })
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: error.code ?? 'increment_failed',
      message: error.message ?? 'Could not increment Check usage.',
    };
  }

  if (
    !data ||
    typeof data !== 'object' ||
    !('check_count' in data) ||
    typeof data.check_count !== 'number'
  ) {
    return {
      ok: false,
      code: 'increment_missing_row',
      message: 'Check usage increment returned no row.',
    };
  }

  return { ok: true, checkCount: data.check_count };
}

/** @internal Test hook to assert the admin RPC is invoked. */
export function getCheckIncrementRpcName(): string {
  return 'increment_check_usage_for_user';
}

/** @internal Allows tests to substitute the admin client boundary. */
export type CheckUsageIncrementer = typeof incrementCheckUsageForUser;

export async function readCheckRemaining(
  supabase: SupabaseClient,
  userId: string,
): Promise<number | null> {
  const { getUsageSummary } = await import('../../plan');
  const summary = await getUsageSummary(supabase, userId);
  return summary.ok ? summary.data.checkRemaining : null;
}
