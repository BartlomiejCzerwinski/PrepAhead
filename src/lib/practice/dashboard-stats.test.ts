import { describe, expect, it } from 'vitest';

import type { PracticeSetSummary } from './history';
import { deriveDashboardPracticeStats } from './dashboard-stats';

function set(overrides: Partial<PracticeSetSummary> = {}): PracticeSetSummary {
  return {
    id: 'set-1',
    title: 'Example set',
    createdAt: '2026-06-01T00:00:00.000Z',
    statusLabel: 'in_progress',
    contentReady: true,
    abcdAnswered: 0,
    abcdTotal: 15,
    openEndedChecked: 0,
    openEndedTotal: 5,
    abcdScorePercent: null,
    hasCv: false,
    ...overrides,
  };
}

describe('deriveDashboardPracticeStats', () => {
  it('counts totals and completion states', () => {
    const stats = deriveDashboardPracticeStats([
      set({ statusLabel: 'completed', abcdScorePercent: 80 }),
      set({ id: 'set-2', statusLabel: 'in_progress' }),
    ]);

    expect(stats.total).toBe(2);
    expect(stats.completed).toBe(1);
    expect(stats.inProgress).toBe(1);
    expect(stats.averageAbcdScore).toBe(80);
  });

  it('returns null average when no completed scores exist', () => {
    const stats = deriveDashboardPracticeStats([set()]);
    expect(stats.averageAbcdScore).toBeNull();
  });
});
