import type { PracticeSetSummary } from './history';

export type DashboardPracticeStats = {
  total: number;
  completed: number;
  inProgress: number;
  averageAbcdScore: number | null;
};

export function deriveDashboardPracticeStats(
  summaries: PracticeSetSummary[],
): DashboardPracticeStats {
  const completed = summaries.filter((item) => item.statusLabel === 'completed').length;
  const inProgress = summaries.length - completed;
  const scored = summaries
    .map((item) => item.abcdScorePercent)
    .filter((score): score is number => score !== null);

  const averageAbcdScore =
    scored.length > 0
      ? Math.round(scored.reduce((sum, score) => sum + score, 0) / scored.length)
      : null;

  return {
    total: summaries.length,
    completed,
    inProgress,
    averageAbcdScore,
  };
}
