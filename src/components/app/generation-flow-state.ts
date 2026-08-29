import type { UsageSummary } from '../../lib/plan';

export type GenerationPhase = 'idle' | 'running' | 'succeeded' | 'failed';

export function shouldWarnBeforeUnload(phase: GenerationPhase): boolean {
  return phase === 'running';
}

export function shouldBlockBeforeUnload(
  phase: GenerationPhase,
  suppressNavigationWarning: boolean,
): boolean {
  return shouldWarnBeforeUnload(phase) && !suppressNavigationWarning;
}

export function shouldShowProgressPanel(phase: GenerationPhase): boolean {
  return phase === 'running' || phase === 'succeeded';
}

export function decrementGenerationUsage(summary: UsageSummary): UsageSummary {
  const generationRemaining = Math.max(0, summary.generationRemaining - 1);
  const generationUsed = summary.generationUsed + 1;

  return {
    ...summary,
    generationUsed,
    generationRemaining,
    isAtGenerationLimit: generationRemaining === 0,
    generationLimitReason: generationRemaining === 0 ? 'period' : summary.generationLimitReason,
  };
}
