import { describe, expect, it } from 'vitest';

import type { UsageSummary } from '../../lib/plan';
import {
  decrementGenerationUsage,
  shouldBlockBeforeUnload,
  shouldShowProgressPanel,
  shouldWarnBeforeUnload,
} from './generation-flow-state';

function proUsageSummary(overrides: Partial<UsageSummary> = {}): UsageSummary {
  return {
    planTier: 'PRO',
    generationUsed: 1,
    generationLimit: 100,
    generationRemaining: 99,
    generationLimitReason: 'none',
    checkUsed: 0,
    checkLimit: 500,
    checkRemaining: 500,
    periodStart: '2026-06-01T00:00:00.000Z',
    periodEnd: '2026-07-01T00:00:00.000Z',
    isAtGenerationLimit: false,
    isAtCheckLimit: false,
    proFairUseNote: 'PRO fair-use note',
    ...overrides,
  };
}

describe('generation-flow-state', () => {
  it('arms beforeunload only while generation is actively running', () => {
    expect(shouldWarnBeforeUnload('running')).toBe(true);
    expect(shouldWarnBeforeUnload('idle')).toBe(false);
    expect(shouldWarnBeforeUnload('succeeded')).toBe(false);
    expect(shouldWarnBeforeUnload('failed')).toBe(false);
  });

  it('suppresses beforeunload during programmatic success navigation', () => {
    expect(shouldBlockBeforeUnload('running', true)).toBe(false);
    expect(shouldBlockBeforeUnload('running', false)).toBe(true);
    expect(shouldBlockBeforeUnload('succeeded', false)).toBe(false);
  });

  it('keeps the progress panel visible through success redirect', () => {
    expect(shouldShowProgressPanel('running')).toBe(true);
    expect(shouldShowProgressPanel('succeeded')).toBe(true);
    expect(shouldShowProgressPanel('idle')).toBe(false);
    expect(shouldShowProgressPanel('failed')).toBe(false);
  });

  it('decrements local generation usage after a successful generation', () => {
    const updated = decrementGenerationUsage(proUsageSummary());

    expect(updated.generationRemaining).toBe(98);
    expect(updated.generationUsed).toBe(2);
    expect(updated.isAtGenerationLimit).toBe(false);
  });

  it('marks generation unavailable when the last allowance is consumed', () => {
    const updated = decrementGenerationUsage(
      proUsageSummary({
        generationUsed: 99,
        generationRemaining: 1,
      }),
    );

    expect(updated.generationRemaining).toBe(0);
    expect(updated.generationUsed).toBe(100);
    expect(updated.isAtGenerationLimit).toBe(true);
    expect(updated.generationLimitReason).toBe('period');
  });
});
