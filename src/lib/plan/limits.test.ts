import { describe, expect, it } from 'vitest';

import { getPlanLimits } from './limits';

// Oracle discipline (test-plan §2): the expected numbers are the PRD limits
// (FR-014..021), written as literals here — never imported from limits.ts — so a
// silent edit to a limit value fails this test instead of being self-confirming.
describe('getPlanLimits — PRD plan limits', () => {
  it('FREE: 1 generation, 5 Checks', () => {
    expect(getPlanLimits('FREE')).toEqual({
      tier: 'FREE',
      generationLimit: 1,
      checkLimit: 5,
    });
  });

  it('PRO: 300 hard cap, 100 soft threshold, 500 Checks', () => {
    expect(getPlanLimits('PRO')).toEqual({
      tier: 'PRO',
      generationHardCap: 300,
      generationSoftThreshold: 100,
      checkLimit: 500,
    });
  });
});
