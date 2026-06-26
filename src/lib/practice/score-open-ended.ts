import type { PracticeSetContentWithProgress } from './contracts';
import { getAbcdProgress } from './score-abcd';

export type OpenEndedProgress = {
  attemptedCount: number;
  checkedCount: number;
  total: 5;
  currentIndex: number;
  isCheckedComplete: boolean;
};

export type OpenEndedSummary = {
  attempted: number;
  checked: number;
  total: 5;
};

export function getOpenEndedQuestions(content: PracticeSetContentWithProgress) {
  return content.questions.filter((question) => question.type === 'open_ended');
}

export function getOpenEndedProgress(content: PracticeSetContentWithProgress): OpenEndedProgress {
  const openEndedQuestions = getOpenEndedQuestions(content);
  const attemptedCount = openEndedQuestions.filter(
    (question) => typeof question.answerText === 'string' && question.answerText.length > 0,
  ).length;
  const checkedCount = openEndedQuestions.filter(
    (question) => question.checkedAt !== undefined,
  ).length;
  const isCheckedComplete = checkedCount === 5;

  const firstUncheckedIndex = openEndedQuestions.findIndex(
    (question) => question.checkedAt === undefined,
  );

  let currentIndex = content.openEndedCurrentIndex ?? 0;

  if (currentIndex < 0 || currentIndex > 4) {
    currentIndex = firstUncheckedIndex === -1 ? 4 : firstUncheckedIndex;
  } else {
    const questionAtIndex = openEndedQuestions[currentIndex];
    if (questionAtIndex?.checkedAt !== undefined) {
      currentIndex = firstUncheckedIndex === -1 ? 4 : firstUncheckedIndex;
    }
  }

  return { attemptedCount, checkedCount, total: 5, currentIndex, isCheckedComplete };
}

export function summarizeOpenEndedPractice(
  content: PracticeSetContentWithProgress,
): OpenEndedSummary {
  const progress = getOpenEndedProgress(content);
  return { attempted: progress.attemptedCount, checked: progress.checkedCount, total: 5 };
}

export function isPracticeSetFullyComplete(content: PracticeSetContentWithProgress): boolean {
  return getAbcdProgress(content).isComplete && getOpenEndedProgress(content).isCheckedComplete;
}
