export const ABCD_QUESTION_COUNT = 15;
export const OPEN_ENDED_QUESTION_COUNT = 5;
export const PRACTICE_SET_QUESTION_COUNT =
  ABCD_QUESTION_COUNT + OPEN_ENDED_QUESTION_COUNT;

export type QuestionCategory = 'abcd' | 'open_ended';

export function questionCategoryAtIndex(index: number): QuestionCategory {
  return index < ABCD_QUESTION_COUNT ? 'abcd' : 'open_ended';
}

export function openEndedIndexFromUnified(unifiedIndex: number): number {
  return unifiedIndex - ABCD_QUESTION_COUNT;
}

export function isAbcdUnifiedIndex(index: number): boolean {
  return index < ABCD_QUESTION_COUNT;
}

export function resolveInitialQuestionIndex(params: {
  queryQuestion?: string | null;
  abcdCurrentIndex: number;
  abcdComplete: boolean;
  openEndedCurrentIndex: number;
}): number {
  const parsed = params.queryQuestion ? Number.parseInt(params.queryQuestion, 10) : Number.NaN;

  if (
    !Number.isNaN(parsed) &&
    parsed >= 1 &&
    parsed <= PRACTICE_SET_QUESTION_COUNT
  ) {
    return parsed - 1;
  }

  if (!params.abcdComplete) {
    return Math.min(
      Math.max(params.abcdCurrentIndex, 0),
      ABCD_QUESTION_COUNT - 1,
    );
  }

  return (
    ABCD_QUESTION_COUNT +
    Math.min(Math.max(params.openEndedCurrentIndex, 0), OPEN_ENDED_QUESTION_COUNT - 1)
  );
}
