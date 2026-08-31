import { describe, expect, it } from 'vitest';

import {
  isAbcdUnifiedIndex,
  openEndedIndexFromUnified,
  questionCategoryAtIndex,
  resolveInitialQuestionIndex,
} from './practice-set-navigation';

describe('practice-set-navigation', () => {
  it('classifies question categories by index', () => {
    expect(questionCategoryAtIndex(0)).toBe('abcd');
    expect(questionCategoryAtIndex(14)).toBe('abcd');
    expect(questionCategoryAtIndex(15)).toBe('open_ended');
    expect(isAbcdUnifiedIndex(15)).toBe(false);
    expect(openEndedIndexFromUnified(16)).toBe(1);
  });

  it('uses query param when valid', () => {
    expect(
      resolveInitialQuestionIndex({
        queryQuestion: '18',
        abcdCurrentIndex: 0,
        abcdComplete: false,
        openEndedCurrentIndex: 0,
      }),
    ).toBe(17);
  });

  it('resumes ABCD progress before open-ended', () => {
    expect(
      resolveInitialQuestionIndex({
        queryQuestion: null,
        abcdCurrentIndex: 4,
        abcdComplete: false,
        openEndedCurrentIndex: 2,
      }),
    ).toBe(4);
  });

  it('resumes open-ended after ABCD is complete', () => {
    expect(
      resolveInitialQuestionIndex({
        queryQuestion: null,
        abcdCurrentIndex: 14,
        abcdComplete: true,
        openEndedCurrentIndex: 2,
      }),
    ).toBe(17);
  });
});
