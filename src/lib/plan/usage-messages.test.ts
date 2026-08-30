import { describe, expect, it } from 'vitest';

import type { UsageSummary } from './get-usage-summary';
import { getGenerationCta, getPlanBanner, getProFairUseBlurb } from './usage-messages';

function summary(overrides: Partial<UsageSummary> = {}): UsageSummary {
  return {
    planTier: 'FREE',
    generationUsed: 0,
    generationLimit: 1,
    generationRemaining: 1,
    generationLimitReason: 'none',
    checkUsed: 0,
    checkLimit: 5,
    checkRemaining: 5,
    periodStart: '2026-06-01T00:00:00.000Z',
    periodEnd: '2026-07-01T00:00:00.000Z',
    isAtGenerationLimit: false,
    isAtCheckLimit: false,
    ...overrides,
  };
}

describe('usage-messages', () => {
  it('FREE users always get an upgrade banner', () => {
    const banner = getPlanBanner(summary());
    expect(banner.tone).toBe('free');
    expect(banner.primaryHref).toBe('/api/billing/checkout-redirect');
  });

  it('FREE at limit uses blocked tone', () => {
    const banner = getPlanBanner(summary({ isAtGenerationLimit: true, generationRemaining: 0 }));
    expect(banner.tone).toBe('blocked');
  });

  it('PRO users get manage subscription banner', () => {
    const banner = getPlanBanner(summary({ planTier: 'PRO', generationLimit: 100 }));
    expect(banner.tone).toBe('pro');
    expect(banner.primaryHref).toBe('/api/billing/portal');
  });

  it('generation CTA allows generate when under limit', () => {
    const cta = getGenerationCta(summary());
    expect(cta.canGenerate).toBe(true);
    expect(cta.href).toBe('/app/generate');
  });

  it('PRO daily cap shows pacing hint without numeric limits', () => {
    const cta = getGenerationCta(
      summary({
        planTier: 'PRO',
        isAtGenerationLimit: true,
        generationLimitReason: 'daily',
      }),
    );
    expect(cta.canGenerate).toBe(false);
    expect(cta.hint).toMatch(/tomorrow/i);
    expect(cta.hint).not.toMatch(/\d+\s*\/\s*\d+/);
  });

  it('PRO fair-use blurb omits raw counters', () => {
    const blurb = getProFairUseBlurb(summary({ planTier: 'PRO' }));
    expect(blurb).toBeTruthy();
    expect(blurb).not.toMatch(/100|300|500/);
  });
});
