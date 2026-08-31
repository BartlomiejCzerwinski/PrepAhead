export type QuestionDotStatus = 'unanswered' | 'answered' | 'draft' | 'checked';

export function abcdDotStatus(question: { selectedOptionId?: string }): QuestionDotStatus {
  return question.selectedOptionId !== undefined ? 'answered' : 'unanswered';
}

export function openEndedDotStatus(question: {
  isChecked: boolean;
  answerText?: string;
}): QuestionDotStatus {
  if (question.isChecked) {
    return 'checked';
  }

  if (question.answerText?.trim()) {
    return 'draft';
  }

  return 'unanswered';
}

export function questionStatusLabel(status: QuestionDotStatus): string {
  switch (status) {
    case 'answered':
      return 'Answered';
    case 'checked':
      return 'Checked';
    case 'draft':
      return 'Draft saved';
    case 'unanswered':
    default:
      return 'Not started';
  }
}

export function questionCategoryShortLabel(category: 'abcd' | 'open_ended'): string {
  return category === 'abcd' ? 'Multiple choice' : 'Open-ended';
}

export function questionDotAriaLabel(
  index: number,
  status: QuestionDotStatus,
  category: 'abcd' | 'open_ended' = 'abcd',
): string {
  const number = index + 1;
  const typeLabel = category === 'abcd' ? 'multiple choice' : 'open-ended';

  switch (status) {
    case 'answered':
      return `Question ${number}, ${typeLabel}, answered`;
    case 'checked':
      return `Question ${number}, ${typeLabel}, checked`;
    case 'draft':
      return `Question ${number}, ${typeLabel}, draft saved`;
    case 'unanswered':
    default:
      return `Question ${number}, ${typeLabel}, not answered`;
  }
}
