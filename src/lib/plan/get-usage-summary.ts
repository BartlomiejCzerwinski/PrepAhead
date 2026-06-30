import type { SupabaseClient } from '@supabase/supabase-js';

import { getPlanLimits, type PlanTier } from './limits';

export type UsageSummary = {
  planTier: PlanTier;
  generationUsed: number;
  generationLimit: number;
  generationRemaining: number;
  checkUsed: number;
  checkLimit: number;
  checkRemaining: number;
  periodStart: string;
  periodEnd: string;
  isAtGenerationLimit: boolean;
  isAtCheckLimit: boolean;
  proFairUseNote?: string;
};

type RpcRow = {
  plan_tier: string;
  period_start: string;
  period_end: string;
  generation_count: number;
  check_count: number;
  daily_generation_count: number;
  period_generation_count: number;
};

const PRO_FAIR_USE_NOTE =
  'PRO fair-use: up to 100 generations per period at normal pace; above that, max 10 per calendar day (UTC) until the 300-generation hard cap.';

export async function getUsageSummary(
  supabase: SupabaseClient,
  _userId: string,
): Promise<
  | { ok: true; data: UsageSummary }
  | { ok: false; error: 'profile_missing' | 'query_failed' }
> {
  const { data, error } = await supabase
    .rpc('get_current_usage_summary')
    .maybeSingle();

  if (error) {
    if (error.code === 'P0002') {
      return { ok: false, error: 'profile_missing' };
    }
    return { ok: false, error: 'query_failed' };
  }

  if (!data) {
    return { ok: false, error: 'profile_missing' };
  }

  const row = data as RpcRow;
  const planTier: PlanTier = row.plan_tier === 'PRO' ? 'PRO' : 'FREE';
  const limits = getPlanLimits(planTier);

  const generationUsed = row.period_generation_count ?? row.generation_count;
  const checkUsed = row.check_count;

  const generationLimit =
    limits.tier === 'PRO' ? limits.generationHardCap : limits.generationLimit;
  const checkLimit = limits.checkLimit;

  const generationRemaining = Math.max(0, generationLimit - generationUsed);
  const checkRemaining = Math.max(0, checkLimit - checkUsed);

  return {
    ok: true,
    data: {
      planTier,
      generationUsed,
      generationLimit,
      generationRemaining,
      checkUsed,
      checkLimit,
      checkRemaining,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      isAtGenerationLimit: generationRemaining === 0,
      isAtCheckLimit: checkRemaining === 0,
      ...(planTier === 'PRO' && { proFairUseNote: PRO_FAIR_USE_NOTE }),
    },
  };
}
