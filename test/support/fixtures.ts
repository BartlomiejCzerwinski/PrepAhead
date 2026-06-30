/**
 * Valid practice-set content fixtures (exactly 15 abcd + 5 open-ended), used by
 * route tests that parse/summarize content. Markers like JD_MARKER / CV_MARKER
 * stand in for sensitive JD/CV text so IDOR tests can assert their absence
 * without ever embedding realistic user content (AGENTS.md privacy rule).
 */

export const JD_MARKER = 'JD_MARKER_do_not_leak';
export const CV_MARKER = 'CV_MARKER_do_not_leak';
export const ANSWER_MARKER = 'ANSWER_MARKER_do_not_leak';

type OpenEndedOverride = {
  answerText?: string;
  checkFeedback?: string;
  checkedAt?: string;
  savedAt?: string;
};

function makeAbcdQuestion(index: number): Record<string, unknown> {
  return {
    id: `q-${index}`,
    type: 'abcd',
    prompt: `ABCD question ${index}`,
    options: [
      { id: 'A', text: 'Option A' },
      { id: 'B', text: 'Option B' },
      { id: 'C', text: 'Option C' },
      { id: 'D', text: 'Option D' },
    ],
    correctOptionId: 'A',
    explanation: `Explanation ${index}`,
  };
}

function makeOpenEndedQuestion(
  index: number,
  override: OpenEndedOverride = {},
): Record<string, unknown> {
  return {
    id: `oe-${index}`,
    type: 'open_ended',
    prompt: `Open-ended question ${index}`,
    guidance: `Guidance ${index}`,
    ...override,
  };
}

/**
 * Build a valid 20-question content object. `openEndedOverrides[i]` is applied
 * to `oe-${i+1}` — e.g. to mark a question already checked.
 */
export function makePracticeContent(
  openEndedOverrides: OpenEndedOverride[] = [],
): Record<string, unknown> {
  const abcd = Array.from({ length: 15 }, (_, i) => makeAbcdQuestion(i + 1));
  const openEnded = Array.from({ length: 5 }, (_, i) =>
    makeOpenEndedQuestion(i + 1, openEndedOverrides[i] ?? {}),
  );

  return {
    version: 1,
    generatedAt: '2026-06-01T00:00:00.000Z',
    questions: [...abcd, ...openEnded],
  };
}
