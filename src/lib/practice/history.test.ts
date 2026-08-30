import { describe, expect, it } from 'vitest';

import { makePracticeContent } from '../../../test/support/fixtures';
import { toPracticeSetSummary } from './history';

/**
 * Oracle discipline (test-plan §2): expected counts/labels are inline literals,
 * never re-derived from the helpers under test. Fixtures build valid 20-question
 * content via `makePracticeContent`; abcd answers are layered on after the fact
 * (`selectedOptionId: 'A'` is correct since the fixture's `correctOptionId` is
 * 'A', so picking 'B' is a deliberate wrong answer).
 */

const CHECKED = { answerText: 'a saved answer', checkedAt: '2026-06-02T00:00:00.000Z' };

function buildContent(opts: {
  abcdAnswered?: number;
  abcdCorrect?: number;
  openEndedChecked?: number;
}): Record<string, unknown> {
  const { abcdAnswered = 0, abcdCorrect = abcdAnswered, openEndedChecked = 0 } = opts;

  const openEndedOverrides = Array.from({ length: 5 }, (_, i) =>
    i < openEndedChecked ? CHECKED : {},
  );
  const content = makePracticeContent(openEndedOverrides);

  let abcdSeen = 0;
  content.questions = (content.questions as Array<Record<string, unknown>>).map((question) => {
    if (question.type !== 'abcd') {
      return question;
    }
    const index = abcdSeen++;
    if (index >= abcdAnswered) {
      return question;
    }
    return {
      ...question,
      selectedOptionId: index < abcdCorrect ? 'A' : 'B',
      answeredAt: '2026-06-02T00:00:00.000Z',
    };
  });

  return content;
}

function row(overrides: Partial<{ status: string; content: unknown; cv_text: string | null }>) {
  return {
    id: 'set-1',
    title: 'Practice set: Senior Engineer',
    status: 'in_progress',
    content: {},
    created_at: '2026-06-01T00:00:00.000Z',
    cv_text: null,
    ...overrides,
  };
}

describe('toPracticeSetSummary', () => {
  it('(a) fully-complete set → completed badge, concrete score, full counts', () => {
    const summary = toPracticeSetSummary(
      row({ content: buildContent({ abcdAnswered: 15, abcdCorrect: 12, openEndedChecked: 5 }) }),
    );

    expect(summary.contentReady).toBe(true);
    expect(summary.statusLabel).toBe('completed');
    expect(summary.abcdAnswered).toBe(15);
    expect(summary.openEndedChecked).toBe(5);
    expect(summary.abcdScorePercent).toBe(80);
  });

  it('(b) in-progress set → in_progress badge, null score until ABCD complete', () => {
    const summary = toPracticeSetSummary(
      row({ content: buildContent({ abcdAnswered: 7, abcdCorrect: 7, openEndedChecked: 2 }) }),
    );

    expect(summary.contentReady).toBe(true);
    expect(summary.statusLabel).toBe('in_progress');
    expect(summary.abcdAnswered).toBe(7);
    expect(summary.openEndedChecked).toBe(2);
    expect(summary.abcdScorePercent).toBeNull();
  });

  it('scores ABCD when multiple-choice is complete even if open-ended is not', () => {
    const summary = toPracticeSetSummary(
      row({ content: buildContent({ abcdAnswered: 15, abcdCorrect: 12, openEndedChecked: 2 }) }),
    );

    expect(summary.statusLabel).toBe('in_progress');
    expect(summary.abcdScorePercent).toBe(80);
  });

  it('(c) grandfathered: row status completed but partial content → still completed, null score', () => {
    const summary = toPracticeSetSummary(
      row({
        status: 'completed',
        content: buildContent({ abcdAnswered: 3, abcdCorrect: 3, openEndedChecked: 0 }),
      }),
    );

    expect(summary.contentReady).toBe(true);
    expect(summary.statusLabel).toBe('completed');
    expect(summary.abcdScorePercent).toBeNull();
  });

  it('(d) unparseable/empty content → contentReady false, zeroed counts, status from row', () => {
    const summary = toPracticeSetSummary(row({ status: 'in_progress', content: {} }));

    expect(summary.contentReady).toBe(false);
    expect(summary.statusLabel).toBe('in_progress');
    expect(summary.abcdAnswered).toBe(0);
    expect(summary.openEndedChecked).toBe(0);
    expect(summary.abcdScorePercent).toBeNull();
  });

  it('(e) content that throws a non-PracticeSetContractError (empty prompt → ZodError) degrades, never throws', () => {
    const content = buildContent({ abcdAnswered: 0, openEndedChecked: 0 });
    (content.questions as Array<Record<string, unknown>>)[0].prompt = '';

    const summary = toPracticeSetSummary(row({ status: 'completed', content }));

    expect(summary.contentReady).toBe(false);
    expect(summary.statusLabel).toBe('completed');
    expect(summary.abcdAnswered).toBe(0);
    expect(summary.abcdScorePercent).toBeNull();
  });

  it('derives hasCv from cv_text presence', () => {
    expect(toPracticeSetSummary(row({ cv_text: null })).hasCv).toBe(false);
    expect(toPracticeSetSummary(row({ cv_text: '' })).hasCv).toBe(false);
    expect(toPracticeSetSummary(row({ cv_text: 'some cv text' })).hasCv).toBe(true);
  });
});
