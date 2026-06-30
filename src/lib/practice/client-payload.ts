import type { AbcdQuestionWithProgress, OpenEndedQuestionWithProgress } from './contracts';

export type ClientAbcdQuestion = {
  id: string;
  type: 'abcd';
  prompt: string;
  options: { id: string; text: string }[];
  selectedOptionId?: string;
  isCorrect?: boolean;
  explanation?: string;
  answeredAt?: string;
};

export function projectClientAbcdQuestion(question: AbcdQuestionWithProgress): ClientAbcdQuestion {
  const base = {
    id: question.id,
    type: 'abcd' as const,
    prompt: question.prompt,
    options: question.options,
  };

  if (question.selectedOptionId === undefined) {
    return base;
  }

  return {
    ...base,
    selectedOptionId: question.selectedOptionId,
    isCorrect: question.selectedOptionId === question.correctOptionId,
    explanation: question.explanation,
    answeredAt: question.answeredAt,
  };
}

export function projectClientAbcdQuestions(
  questions: AbcdQuestionWithProgress[],
): ClientAbcdQuestion[] {
  return questions.map(projectClientAbcdQuestion);
}

export type ClientOpenEndedQuestion = {
  id: string;
  type: 'open_ended';
  prompt: string;
  guidance: string;
  answerText?: string;
  checkFeedback?: string;
  checkedAt?: string;
  isChecked: boolean;
};

export function projectClientOpenEndedQuestion(
  question: OpenEndedQuestionWithProgress,
): ClientOpenEndedQuestion {
  const isChecked = question.checkedAt !== undefined;

  return {
    id: question.id,
    type: 'open_ended',
    prompt: question.prompt,
    guidance: question.guidance,
    answerText: question.answerText,
    checkFeedback: isChecked ? question.checkFeedback : undefined,
    checkedAt: question.checkedAt,
    isChecked,
  };
}

export function projectClientOpenEndedQuestions(
  questions: OpenEndedQuestionWithProgress[],
): ClientOpenEndedQuestion[] {
  return questions.map(projectClientOpenEndedQuestion);
}
