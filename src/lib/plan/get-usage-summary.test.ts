import { describe, expect, it } from 'vitest';

import {
  createFakeSupabase,
  freeUserSummaryRow,
  proUserSummaryRow,
} from '../../../test/support/fake-supabase';
import { getUsageSummary } from './get-usage-summary';

function summaryClient(row: Record<string, unknown> | null, error?: unknown) {
  return createFakeSupabase({
    rpc: { get_current_usage_summary: { data: row, error: error ?? null } },
  }).client;
}

describe('getUsageSummary — gate derivation', () => {
  it('FREE at the generation limit → remaining 0, isAtGenerationLimit', async () => {
    const result = await getUsageSummary(
      summaryClient(freeUserSummaryRow({ generation_count: 1 })),
      'u1',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.generationRemaining).toBe(0);
    expect(result.data.isAtGenerationLimit).toBe(true);
    expect(result.data.generationLimitReason).toBe('period');
  });

  it('FREE at the Check limit → isAtCheckLimit', async () => {
    const result = await getUsageSummary(
      summaryClient(freeUserSummaryRow({ check_count: 5 })),
      'u1',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.checkRemaining).toBe(0);
    expect(result.data.isAtCheckLimit).toBe(true);
  });

  it('FREE below limits → not at limit, correct remaining', async () => {
    const result = await getUsageSummary(summaryClient(freeUserSummaryRow()), 'u1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.isAtGenerationLimit).toBe(false);
    expect(result.data.generationRemaining).toBe(1);
    expect(result.data.checkRemaining).toBe(5);
    expect(result.data.generationLimitReason).toBe('none');
  });

  it('PRO below soft threshold uses 100-generation UX hint', async () => {
    const result = await getUsageSummary(
      summaryClient(proUserSummaryRow({ generation_count: 50 })),
      'u1',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.isAtGenerationLimit).toBe(false);
    expect(result.data.generationLimit).toBe(100);
    expect(result.data.generationRemaining).toBe(50);
    expect(result.data.generationLimitReason).toBe('none');
  });

  it('PRO at soft threshold (100) with daily headroom is not blocked', async () => {
    const result = await getUsageSummary(
      summaryClient(
        proUserSummaryRow({ generation_count: 100, daily_generation_count: 9 }),
      ),
      'u1',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.isAtGenerationLimit).toBe(false);
    expect(result.data.generationLimit).toBe(10);
    expect(result.data.generationRemaining).toBe(1);
    expect(result.data.generationLimitReason).toBe('none');
  });

  it('PRO at period 100 with daily 10 → daily cap blocks', async () => {
    const result = await getUsageSummary(
      summaryClient(
        proUserSummaryRow({ generation_count: 100, daily_generation_count: 10 }),
      ),
      'u1',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.isAtGenerationLimit).toBe(true);
    expect(result.data.generationLimitReason).toBe('daily');
    expect(result.data.generationLimit).toBe(10);
    expect(result.data.generationRemaining).toBe(0);
  });

  it('PRO at hard cap (300) → period limit', async () => {
    const result = await getUsageSummary(
      summaryClient(proUserSummaryRow({ generation_count: 300 })),
      'u1',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.isAtGenerationLimit).toBe(true);
    expect(result.data.generationLimitReason).toBe('period');
    expect(result.data.generationRemaining).toBe(0);
  });

  it('remaining clamps at 0 when count exceeds the limit', async () => {
    const result = await getUsageSummary(
      summaryClient(freeUserSummaryRow({ generation_count: 5, check_count: 99 })),
      'u1',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.generationRemaining).toBe(0);
    expect(result.data.checkRemaining).toBe(0);
  });

  it('unknown tier is treated as FREE', async () => {
    const result = await getUsageSummary(
      summaryClient({ ...freeUserSummaryRow(), plan_tier: 'MYSTERY' }),
      'u1',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.planTier).toBe('FREE');
    expect(result.data.generationLimit).toBe(1);
  });

  it('maps RPC errors: P0002 → profile_missing, other → query_failed, null → profile_missing', async () => {
    const profileMissing = await getUsageSummary(
      summaryClient(null, { code: 'P0002' }),
      'u1',
    );
    expect(profileMissing).toEqual({ ok: false, error: 'profile_missing' });

    const queryFailed = await getUsageSummary(
      summaryClient(null, { code: 'XX999' }),
      'u1',
    );
    expect(queryFailed).toEqual({ ok: false, error: 'query_failed' });

    const nullData = await getUsageSummary(summaryClient(null), 'u1');
    expect(nullData).toEqual({ ok: false, error: 'profile_missing' });
  });
});
