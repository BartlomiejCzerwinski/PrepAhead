import { describe, expect, it } from 'vitest';

import {
  createFakeSupabase,
  freeUserSummaryRow,
  proUserSummaryRow,
} from '../../../test/support/fake-supabase';
import { getUsageSummary } from './get-usage-summary';

// Deferred gap (test-plan §2 Risk #1, ref roadmap S-05): the PRO soft threshold
// (100) and daily cap (10/day UTC) are NOT enforced in code — only the hard cap
// (300 PRO / 1 FREE) and Check caps (5 / 500) are. These tests assert only what
// is enforced; the PRO `generation_count: 100` case below confirms the soft
// threshold does NOT block, which is current (intended-for-now) behavior.

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
  });

  it('PRO uses the hard cap (300), not the soft threshold (100)', async () => {
    const atSoft = await getUsageSummary(
      summaryClient(proUserSummaryRow({ generation_count: 100 })),
      'u1',
    );
    expect(atSoft.ok).toBe(true);
    if (!atSoft.ok) return;
    // Soft threshold is not enforced — 100 generations is NOT a block.
    expect(atSoft.data.isAtGenerationLimit).toBe(false);
    expect(atSoft.data.generationRemaining).toBe(200);

    const atHard = await getUsageSummary(
      summaryClient(proUserSummaryRow({ generation_count: 300 })),
      'u1',
    );
    expect(atHard.ok).toBe(true);
    if (!atHard.ok) return;
    expect(atHard.data.isAtGenerationLimit).toBe(true);
    expect(atHard.data.generationRemaining).toBe(0);
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
