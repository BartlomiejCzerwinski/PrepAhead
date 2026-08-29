import { loadE2EEnv, requireServiceRoleKey } from './env';
import { createAdminClient, signInE2EUser } from './supabase';

export async function setPlanTierViaAdmin(
  userId: string,
  planTier: 'FREE' | 'PRO',
  stripeCustomerId: string | null = null,
): Promise<void> {
  const env = loadE2EEnv();
  requireServiceRoleKey(env);
  const admin = createAdminClient();

  const { error } = await admin.rpc('set_plan_tier_from_billing', {
    p_user_id: userId,
    p_plan_tier: planTier,
    p_stripe_customer_id: stripeCustomerId,
    p_stripe_subscription_id: planTier === 'PRO' ? 'sub_e2e_fixture' : null,
    p_grace_ends_at: null,
  });

  if (error) {
    throw error;
  }
}

export async function seedFreeUserAtGenerationLimit(userId: string): Promise<void> {
  await setPlanTierViaAdmin(userId, 'FREE', null);

  const { client } = await signInE2EUser();
  const { data: summary, error: summaryError } = await client
    .rpc('get_current_usage_summary')
    .maybeSingle();

  if (summaryError || !summary) {
    throw summaryError ?? new Error('Could not read usage summary for billing seed');
  }

  const period = summary as { period_start: string; period_end: string };

  const admin = createAdminClient();
  const { error } = await admin.from('usage_periods').upsert(
    {
      user_id: userId,
      period_start: period.period_start,
      period_end: period.period_end,
      generation_count: 1,
      check_count: 0,
    },
    { onConflict: 'user_id,period_start' },
  );

  if (error) {
    throw error;
  }
}

export async function resetBillingTestUser(userId: string): Promise<void> {
  await setPlanTierViaAdmin(userId, 'FREE', null);

  const admin = createAdminClient();
  const { data: periods } = await admin
    .from('usage_periods')
    .select('period_start')
    .eq('user_id', userId);

  if (periods?.length) {
    for (const period of periods) {
      await admin
        .from('usage_periods')
        .update({ generation_count: 0, check_count: 0 })
        .eq('user_id', userId)
        .eq('period_start', period.period_start);
    }
  }
}

export async function seedProUserWithStripeCustomer(userId: string): Promise<void> {
  await setPlanTierViaAdmin(userId, 'PRO', 'cus_e2e_fixture');
}
