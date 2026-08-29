import type { PostgrestError } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseAdminClient } from '../../supabase/admin';
import { validateServiceRoleKey } from '../../supabase/validate-service-role';

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

type IncrementRow = {
  check_count: number;
};

function parseIncrementRow(data: unknown): IncrementRow | null {
  const row = Array.isArray(data) ? data[0] : data;

  if (
    row &&
    typeof row === 'object' &&
    'check_count' in row &&
    typeof row.check_count === 'number'
  ) {
    return { check_count: row.check_count };
  }

  return null;
}

function logIncrementRpcError(userId: string, error: PostgrestError): void {
  console.error('increment_check_usage_for_user RPC error', {
    userId,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

export async function incrementCheckUsageForUser(
  userId: string,
): Promise<IncrementCheckUsageResult> {
  const keyValidation = validateServiceRoleKey();
  if (!keyValidation.ok) {
    console.error('Check usage increment blocked by service-role env validation', {
      userId,
      code: keyValidation.code,
      message: keyValidation.message,
    });
    return keyValidation;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('increment_check_usage_for_user', {
    p_user_id: userId,
  });

  if (error) {
    logIncrementRpcError(userId, error);
    return {
      ok: false,
      code: error.code ?? 'increment_failed',
      message: error.message ?? 'Could not increment Check usage.',
    };
  }

  const row = parseIncrementRow(data);
  if (!row) {
    console.error('increment_check_usage_for_user returned unexpected payload', {
      userId,
      data,
    });
    return {
      ok: false,
      code: 'increment_missing_row',
      message: 'Check usage increment returned no row.',
    };
  }

  return { ok: true, checkCount: row.check_count };
}

/** @internal Test hook to assert the admin RPC is invoked. */
export function getCheckIncrementRpcName(): string {
  return 'increment_check_usage_for_user';
}

export async function readCheckRemaining(
  supabase: SupabaseClient,
  userId: string,
): Promise<number | null> {
  const { getUsageSummary } = await import('../../plan');
  const summary = await getUsageSummary(supabase, userId);
  return summary.ok ? summary.data.checkRemaining : null;
}
