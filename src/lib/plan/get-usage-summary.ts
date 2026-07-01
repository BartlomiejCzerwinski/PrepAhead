import type { SupabaseClient } from '@supabase/supabase-js';

import { getPlanLimits, type PlanTier } from './limits';

export type GenerationLimitReason = 'none' | 'period' | 'daily';

export type UsageSummary = {
  planTier: PlanTier;
  generationUsed: number;
  generationLimit: number;
  generationRemaining: number;
  generationLimitReason: GenerationLimitReason;
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

const PRO_SOFT_THRESHOLD = 100;
const PRO_DAILY_CAP = 10;
const PRO_HARD_CAP = 300;

function deriveProGenerationGate(
  periodUsed: number,
  dailyUsed: number,
): Pick<
  UsageSummary,
  | 'isAtGenerationLimit'
  | 'generationLimitReason'
  | 'generationLimit'
  | 'generationRemaining'
> {
  const periodRemaining = Math.max(0, PRO_HARD_CAP - periodUsed);

  if (periodRemaining === 0) {
    return {
      isAtGenerationLimit: true,
      generationLimitReason: 'period',
      generationLimit: PRO_HARD_CAP,
      generationRemaining: 0,
    };
  }

  if (periodUsed >= PRO_SOFT_THRESHOLD && dailyUsed >= PRO_DAILY_CAP) {
    return {
      isAtGenerationLimit: true,
      generationLimitReason: 'daily',
      generationLimit: PRO_DAILY_CAP,
      generationRemaining: 0,
    };
  }

  if (periodUsed < PRO_SOFT_THRESHOLD) {
    const remaining = Math.min(
      PRO_SOFT_THRESHOLD - periodUsed,
      periodRemaining,
    );
    return {
      isAtGenerationLimit: false,
      generationLimitReason: 'none',
      generationLimit: PRO_SOFT_THRESHOLD,
      generationRemaining: remaining,
    };
  }

  const dailyRemaining = Math.max(0, PRO_DAILY_CAP - dailyUsed);
  const remaining = Math.min(dailyRemaining, periodRemaining);
  return {
    isAtGenerationLimit: false,
    generationLimitReason: 'none',
    generationLimit: PRO_DAILY_CAP,
    generationRemaining: remaining,
  };
}

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
  const dailyUsed = row.daily_generation_count ?? 0;
  const checkUsed = row.check_count;
  const checkLimit = limits.checkLimit;
  const checkRemaining = Math.max(0, checkLimit - checkUsed);

  if (planTier === 'PRO') {
    const gate = deriveProGenerationGate(generationUsed, dailyUsed);
    return {
      ok: true,
      data: {
        planTier,
        generationUsed,
        checkUsed,
        checkLimit,
        checkRemaining,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        isAtCheckLimit: checkRemaining === 0,
        proFairUseNote: PRO_FAIR_USE_NOTE,
        ...gate,
      },
    };
  }

  const freeLimits = getPlanLimits('FREE');
  const generationLimit = freeLimits.generationLimit;
  const generationRemaining = Math.max(0, generationLimit - generationUsed);
  const isAtGenerationLimit = generationRemaining === 0;

  return {
    ok: true,
    data: {
      planTier,
      generationUsed,
      generationLimit,
      generationRemaining,
      generationLimitReason: isAtGenerationLimit ? 'period' : 'none',
      checkUsed,
      checkLimit,
      checkRemaining,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      isAtGenerationLimit,
      isAtCheckLimit: checkRemaining === 0,
    },
  };
}
