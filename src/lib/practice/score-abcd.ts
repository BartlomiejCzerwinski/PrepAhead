import type { PracticeSetContentWithProgress } from './contracts';

export type AbcdProgress = {
  answeredCount: number;
  total: 15;
  currentIndex: number;
  isComplete: boolean;
};

export type AbcdScore = {
  correct: number;
  total: 15;
  percent: number;
};

export type OpenEndedSummaryStub = {
  attempted: 0;
  total: 5;
  label: 'Not attempted';
};

export function getAbcdQuestions(content: PracticeSetContentWithProgress) {
  return content.questions.filter((question) => question.type === 'abcd');
}

export function getAbcdProgress(content: PracticeSetContentWithProgress): AbcdProgress {
  const abcdQuestions = getAbcdQuestions(content);
  const answeredCount = abcdQuestions.filter((question) => question.selectedOptionId !== undefined)
    .length;
  const isComplete = answeredCount === 15;

  const firstUnansweredIndex = abcdQuestions.findIndex(
    (question) => question.selectedOptionId === undefined,
  );

  let currentIndex = content.currentQuestionIndex ?? 0;

  if (currentIndex < 0 || currentIndex > 14) {
    currentIndex = firstUnansweredIndex === -1 ? 14 : firstUnansweredIndex;
  } else {
    const questionAtIndex = abcdQuestions[currentIndex];
    if (questionAtIndex?.selectedOptionId !== undefined) {
      currentIndex = firstUnansweredIndex === -1 ? 14 : firstUnansweredIndex;
    }
  }

  return { answeredCount, total: 15, currentIndex, isComplete };
}

export function scoreAbcdPractice(content: PracticeSetContentWithProgress): AbcdScore {
  const abcdQuestions = getAbcdQuestions(content);
  let correct = 0;

  for (const question of abcdQuestions) {
    if (
      question.selectedOptionId !== undefined &&
      question.selectedOptionId === question.correctOptionId
    ) {
      correct += 1;
    }
  }

  const percent = Math.round((correct / 15) * 100);
  return { correct, total: 15, percent };
}

export function buildOpenEndedSummaryStub(): OpenEndedSummaryStub {
  return { attempted: 0, total: 5, label: 'Not attempted' };
}
