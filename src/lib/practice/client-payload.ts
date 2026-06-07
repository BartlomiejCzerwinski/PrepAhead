import type { AbcdQuestionWithProgress } from './contracts';

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
