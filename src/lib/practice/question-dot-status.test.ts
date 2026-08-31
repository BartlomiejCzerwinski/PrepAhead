import { describe, expect, it } from 'vitest';

import {
  abcdDotStatus,
  openEndedDotStatus,
  questionDotAriaLabel,
} from './question-dot-status';

describe('abcdDotStatus', () => {
  it('marks unanswered when no selection', () => {
    expect(abcdDotStatus({})).toBe('unanswered');
  });

  it('marks answered when option selected', () => {
    expect(abcdDotStatus({ selectedOptionId: 'a' })).toBe('answered');
  });
});

describe('openEndedDotStatus', () => {
  it('marks checked questions', () => {
    expect(openEndedDotStatus({ isChecked: true, answerText: 'done' })).toBe('checked');
  });

  it('marks draft when text saved but not checked', () => {
    expect(openEndedDotStatus({ isChecked: false, answerText: ' draft ' })).toBe('draft');
  });

  it('marks unanswered when empty', () => {
    expect(openEndedDotStatus({ isChecked: false, answerText: '   ' })).toBe('unanswered');
  });
});

describe('questionDotAriaLabel', () => {
  it('describes status for screen readers', () => {
    expect(questionDotAriaLabel(0, 'unanswered', 'abcd')).toBe(
      'Question 1, multiple choice, not answered',
    );
    expect(questionDotAriaLabel(2, 'draft', 'open_ended')).toBe(
      'Question 3, open-ended, draft saved',
    );
  });
});
