import { useEffect, useMemo, useRef, useState } from 'react';

import { MIN_ANSWER_CHARS } from '../../lib/practice/answer-limits';
import type {
  ClientAbcdQuestion,
  ClientOpenEndedQuestion,
} from '../../lib/practice/client-payload';
import {
  ABCD_QUESTION_COUNT,
  isAbcdUnifiedIndex,
  openEndedIndexFromUnified,
  PRACTICE_SET_QUESTION_COUNT,
} from '../../lib/practice/practice-set-navigation';
import { abcdDotStatus, openEndedDotStatus } from '../../lib/practice/question-dot-status';
import PracticeSummary from './PracticeSummary';
import QuestionSidebar, { type QuestionSidebarItem } from './QuestionSidebar';

type AbcdProgress = {
  answeredCount: number;
  total: 15;
  currentIndex: number;
  isComplete: boolean;
};

type OpenEndedProgress = {
  attemptedCount: number;
  checkedCount: number;
  total: 5;
  currentIndex: number;
  isCheckedComplete: boolean;
};

type AbcdScore = {
  correct: number;
  total: 15;
  percent: number;
};

type OpenEndedSummary = {
  attempted: number;
  checked: number;
  total: 5;
};

type FullSummary = {
  abcd: AbcdScore;
  openEnded: OpenEndedSummary;
};

type Usage = {
  planTier: 'FREE' | 'PRO';
  checkRemaining: number;
  isAtCheckLimit: boolean;
};

type AnswerSuccessResponse = {
  ok: true;
  isCorrect: boolean;
  explanation: string;
  correctOptionId: string;
  progress: {
    answeredCount: number;
    total: 15;
    currentQuestionIndex: number;
    isComplete: boolean;
  };
  summary?: {
    abcd: AbcdScore;
    openEnded: OpenEndedSummary;
  };
};

type AnswerErrorResponse = {
  ok: false;
  error: string;
  message: string;
};

type SaveSuccessResponse = {
  ok: true;
  progress: OpenEndedProgress;
};

type CheckSuccessResponse = {
  ok: true;
  feedback: string;
  checkedAt: string;
  checkRemaining: number;
  progress: OpenEndedProgress;
  summary?: FullSummary;
};

type ApiErrorResponse = {
  ok: false;
  error: string;
  message: string;
  checkRemaining?: number;
  upgradeUrl?: string | null;
};

type Props = {
  practiceSetId: string;
  title: string;
  overviewUrl: string;
  initialAbcdQuestions: ClientAbcdQuestion[];
  initialOpenEndedQuestions: ClientOpenEndedQuestion[];
  initialAbcdProgress: AbcdProgress;
  initialOpenEndedProgress: OpenEndedProgress;
  initialUsage: Usage | null;
  initialSummary: FullSummary | null;
  initialQuestionIndex: number;
};

async function parseApiResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function optionStateClass(
  optionId: string,
  question: ClientAbcdQuestion,
  revealCorrectOptionId?: string,
): string {
  if (question.selectedOptionId === undefined) {
    return '';
  }

  if (optionId === question.selectedOptionId) {
    return question.isCorrect ? 'quiz-option--correct' : 'quiz-option--incorrect';
  }

  if (
    !question.isCorrect &&
    revealCorrectOptionId &&
    optionId === revealCorrectOptionId
  ) {
    return 'quiz-option--reveal-correct';
  }

  return '';
}

export default function PracticeSetFlow({
  practiceSetId,
  title,
  overviewUrl,
  initialAbcdQuestions,
  initialOpenEndedQuestions,
  initialAbcdProgress,
  initialOpenEndedProgress,
  initialUsage,
  initialSummary,
  initialQuestionIndex,
}: Props) {
  const [abcdQuestions, setAbcdQuestions] = useState(initialAbcdQuestions);
  const [openEndedQuestions, setOpenEndedQuestions] = useState(initialOpenEndedQuestions);
  const [abcdProgress, setAbcdProgress] = useState(initialAbcdProgress);
  const [openEndedProgress, setOpenEndedProgress] = useState(initialOpenEndedProgress);
  const [currentIndex, setCurrentIndex] = useState(initialQuestionIndex);
  const [usage, setUsage] = useState<Usage | null>(initialUsage);
  const [summary, setSummary] = useState<FullSummary | null>(initialSummary);
  const [draft, setDraft] = useState('');
  const [isSavingAbcd, setIsSavingAbcd] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [abcdError, setAbcdError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [revealCorrectByQuestionId, setRevealCorrectByQuestionId] = useState<
    Record<string, string>
  >({});
  const submittingRef = useRef(false);

  const isAbcdView = isAbcdUnifiedIndex(currentIndex);
  const abcdQuestion = isAbcdView ? (abcdQuestions[currentIndex] ?? null) : null;
  const openEndedQuestion = !isAbcdView
    ? (openEndedQuestions[openEndedIndexFromUnified(currentIndex)] ?? null)
    : null;

  useEffect(() => {
    setDraft(openEndedQuestion?.answerText ?? '');
    setActionError(null);
    setSaveNotice(null);
    setAbcdError(null);
  }, [currentIndex, openEndedQuestion?.answerText]);

  const isBusy = isSavingAbcd || isSavingDraft || isChecking;
  const isCurrentAbcdAnswered = abcdQuestion?.selectedOptionId !== undefined;
  const isChecked = openEndedQuestion?.isChecked ?? false;
  const trimmedLength = draft.trim().length;
  const atLimit = usage?.isAtCheckLimit ?? false;
  const canSave = !isChecked && !isBusy && trimmedLength > 0;
  const canCheck = !isChecked && !isBusy && trimmedLength >= MIN_ANSWER_CHARS && !atLimit;

  const sidebarItems = useMemo<QuestionSidebarItem[]>(
    () => [
      ...abcdQuestions.map((question) => ({
        prompt: question.prompt,
        status: abcdDotStatus(question),
        category: 'abcd' as const,
      })),
      ...openEndedQuestions.map((question) => ({
        prompt: question.prompt,
        status: openEndedDotStatus(question),
        category: 'open_ended' as const,
      })),
    ],
    [abcdQuestions, openEndedQuestions],
  );

  const progressLabel = useMemo(
    () =>
      `${abcdProgress.answeredCount} / ${abcdProgress.total} multiple-choice answered · ${openEndedProgress.checkedCount} / ${openEndedProgress.total} open-ended checked`,
    [
      abcdProgress.answeredCount,
      abcdProgress.total,
      openEndedProgress.checkedCount,
      openEndedProgress.total,
    ],
  );

  function goToIndex(nextIndex: number): void {
    if (nextIndex < 0 || nextIndex >= PRACTICE_SET_QUESTION_COUNT || isBusy) {
      return;
    }

    setAbcdError(null);
    setActionError(null);
    setCurrentIndex(nextIndex);
  }

  async function submitAnswer(selectedOptionId: string): Promise<void> {
    if (!abcdQuestion || isCurrentAbcdAnswered || isSavingAbcd || submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setIsSavingAbcd(true);
    setAbcdError(null);

    try {
      const response = await fetch(`/api/practice-sets/${practiceSetId}/answer`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: abcdQuestion.id,
          selectedOptionId,
        }),
      });

      const body = (await parseApiResponse(response)) as
        | AnswerSuccessResponse
        | AnswerErrorResponse
        | null;

      if (!response.ok || !body || body.ok !== true) {
        const message =
          body && 'message' in body && typeof body.message === 'string'
            ? body.message
            : 'Could not save your answer. Please try again.';
        setAbcdError(message);
        return;
      }

      setAbcdQuestions((previous) =>
        previous.map((question) =>
          question.id === abcdQuestion.id
            ? {
                ...question,
                selectedOptionId,
                isCorrect: body.isCorrect,
                explanation: body.explanation,
                answeredAt: new Date().toISOString(),
              }
            : question,
        ),
      );

      if (!body.isCorrect) {
        setRevealCorrectByQuestionId((previous) => ({
          ...previous,
          [abcdQuestion.id]: body.correctOptionId,
        }));
      }

      setAbcdProgress({
        answeredCount: body.progress.answeredCount,
        total: body.progress.total,
        currentIndex: body.progress.currentQuestionIndex,
        isComplete: body.progress.isComplete,
      });
    } catch {
      setAbcdError('Could not save your answer. Check your connection and try again.');
    } finally {
      submittingRef.current = false;
      setIsSavingAbcd(false);
    }
  }

  function handleAbcdNext(): void {
    if (abcdProgress.isComplete) {
      goToIndex(ABCD_QUESTION_COUNT);
      return;
    }

    const nextUnanswered = abcdProgress.currentIndex;
    if (nextUnanswered !== currentIndex) {
      goToIndex(nextUnanswered);
      return;
    }

    goToIndex(currentIndex + 1);
  }

  async function handleSaveDraft(): Promise<void> {
    if (!openEndedQuestion || !canSave || submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setIsSavingDraft(true);
    setActionError(null);
    setSaveNotice(null);

    try {
      const response = await fetch(`/api/practice-sets/${practiceSetId}/save-answer`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: openEndedQuestion.id,
          answerText: draft.trim(),
        }),
      });

      const body = (await parseApiResponse(response)) as
        | SaveSuccessResponse
        | ApiErrorResponse
        | null;

      if (!response.ok || !body || body.ok !== true) {
        setActionError(
          body && 'message' in body ? body.message : 'Could not save your draft. Please try again.',
        );
        return;
      }

      const savedText = draft.trim();
      setOpenEndedQuestions((previous) =>
        previous.map((question) =>
          question.id === openEndedQuestion.id
            ? { ...question, answerText: savedText }
            : question,
        ),
      );
      setOpenEndedProgress(body.progress);
      setSaveNotice('Draft saved.');
    } catch {
      setActionError('Could not save your draft. Check your connection and try again.');
    } finally {
      submittingRef.current = false;
      setIsSavingDraft(false);
    }
  }

  async function handleCheck(): Promise<void> {
    if (!openEndedQuestion || !canCheck || submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setIsChecking(true);
    setActionError(null);
    setSaveNotice(null);

    try {
      const response = await fetch(`/api/practice-sets/${practiceSetId}/check`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: openEndedQuestion.id,
          answerText: draft.trim(),
        }),
      });

      const body = (await parseApiResponse(response)) as
        | CheckSuccessResponse
        | ApiErrorResponse
        | null;

      if (!response.ok || !body || body.ok !== true) {
        if (body && body.ok === false && body.error === 'check_limit_reached') {
          setUsage((previous) =>
            previous ? { ...previous, checkRemaining: 0, isAtCheckLimit: true } : previous,
          );
        }
        setActionError(
          body && 'message' in body ? body.message : 'Could not check your answer. Please try again.',
        );
        return;
      }

      const checkedText = draft.trim();
      setOpenEndedQuestions((previous) =>
        previous.map((question) =>
          question.id === openEndedQuestion.id
            ? {
                ...question,
                answerText: checkedText,
                checkFeedback: body.feedback,
                checkedAt: body.checkedAt,
                isChecked: true,
              }
            : question,
        ),
      );
      setOpenEndedProgress(body.progress);
      setUsage((previous) =>
        previous
          ? {
              ...previous,
              checkRemaining: body.checkRemaining,
              isAtCheckLimit: body.checkRemaining <= 0,
            }
          : previous,
      );

      if (body.summary) {
        setSummary(body.summary);
      }
    } catch {
      setActionError('Could not check your answer. Check your connection and try again.');
    } finally {
      submittingRef.current = false;
      setIsChecking(false);
    }
  }

  if (summary) {
    return (
      <PracticeSummary
        title={title}
        abcdScore={summary.abcd}
        openEndedSummary={summary.openEnded}
        overviewUrl={overviewUrl}
      />
    );
  }

  if (!abcdQuestion && !openEndedQuestion) {
    return (
      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-6 text-sm leading-6 text-[var(--text-muted)]">
        No practice questions are available for this set.
      </section>
    );
  }

  const categoryLabel = isAbcdView ? 'Multiple choice' : 'Open-ended';
  const revealCorrectOptionId = abcdQuestion
    ? revealCorrectByQuestionId[abcdQuestion.id]
    : undefined;

  return (
    <section className="practice-session">
      <header className="practice-session__header">
        <a
          href={overviewUrl}
          className="inline-flex items-center text-sm font-medium text-[var(--brand)] no-underline hover:underline"
        >
          ← Back to overview
        </a>
        <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <h1 className="truncate text-lg font-bold tracking-tight text-[var(--text)] sm:text-xl">
            {title}
          </h1>
          <p className="shrink-0 text-xs leading-5 text-[var(--text-muted)] sm:text-sm">
            {progressLabel}
          </p>
        </div>
      </header>

      <div className="practice-session__body">
        <div className="practice-session__main">
          <article className="practice-question-card practice-session__card p-4 sm:p-5">
            <div className="shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Question {currentIndex + 1} of {PRACTICE_SET_QUESTION_COUNT}
                </p>
                <span
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.06em] ${
                    isAbcdView
                      ? 'bg-[var(--surface-muted)] text-[var(--text-muted)]'
                      : 'bg-[var(--brand-soft)] text-[var(--brand)]'
                  }`}
                >
                  {categoryLabel}
                </span>
              </div>

              {isAbcdView && abcdQuestion ? (
                <p className="mt-3 text-base font-semibold leading-7 text-[var(--text)] sm:text-lg sm:leading-8">
                  {abcdQuestion.prompt}
                </p>
              ) : null}

              {!isAbcdView && openEndedQuestion ? (
                <>
                  <p className="mt-3 text-base font-semibold leading-7 text-[var(--text)] sm:text-lg sm:leading-8">
                    {openEndedQuestion.prompt}
                  </p>
                  <div className="practice-guidance mt-3 px-3.5 py-2.5 text-sm leading-6 text-[var(--text-muted)]">
                    <p className="font-semibold text-[var(--brand)]">
                      Strong answer should cover:
                    </p>
                    <p className="mt-1">{openEndedQuestion.guidance}</p>
                  </div>
                </>
              ) : null}
            </div>

            <div className="practice-session__card-scroll mt-3">
              {isAbcdView && abcdQuestion ? (
                <>
                  <fieldset className="space-y-2" disabled={isSavingAbcd}>
                    <legend className="sr-only">Choose one answer</legend>
                    {abcdQuestion.options.map((option) => {
                      const stateClass = optionStateClass(
                        option.id,
                        abcdQuestion,
                        revealCorrectOptionId,
                      );
                      const isLocked = isCurrentAbcdAnswered || isSavingAbcd;

                      return (
                        <label
                          key={option.id}
                          className={`quiz-option-label ${stateClass} ${isLocked ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          <span className="quiz-option-letter">{option.id}</span>
                          <span className="quiz-option-text">{option.text}</span>
                          <input
                            type="radio"
                            name={`question-${abcdQuestion.id}`}
                            value={option.id}
                            checked={abcdQuestion.selectedOptionId === option.id}
                            disabled={isLocked}
                            onChange={() => {
                              void submitAnswer(option.id);
                            }}
                            className="quiz-option-radio"
                          />
                        </label>
                      );
                    })}
                  </fieldset>

                  {isSavingAbcd ? (
                    <p className="mt-3 text-sm text-[var(--text-muted)]">Saving your answer...</p>
                  ) : null}

                  {abcdError ? (
                    <p
                      className="mt-3 text-sm font-medium text-red-600 dark:text-red-400"
                      role="alert"
                    >
                      {abcdError}
                    </p>
                  ) : null}

                  {isCurrentAbcdAnswered && abcdQuestion.explanation ? (
                    <div
                      className={`practice-feedback mt-3 ${
                        abcdQuestion.isCorrect
                          ? 'practice-feedback--correct'
                          : 'practice-feedback--incorrect'
                      }`}
                    >
                      <p className="font-semibold text-[var(--text)]">
                        {abcdQuestion.isCorrect ? 'Correct' : 'Incorrect'}
                      </p>
                      <p className="mt-2">{abcdQuestion.explanation}</p>
                    </div>
                  ) : null}
                </>
              ) : null}

              {!isAbcdView && openEndedQuestion ? (
                <>
                  <div className="flex h-full min-h-[10rem] flex-col">
                    <label
                      htmlFor={`answer-${openEndedQuestion.id}`}
                      className="text-sm font-semibold text-[var(--text)]"
                    >
                      Your answer
                    </label>
                    <textarea
                      id={`answer-${openEndedQuestion.id}`}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      readOnly={isChecked}
                      placeholder="Write your answer as you would explain it in an interview..."
                      className="mt-2 min-h-[8rem] flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--text)] outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/15 disabled:opacity-60"
                    />
                    {!isChecked ? (
                      <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                        {trimmedLength < MIN_ANSWER_CHARS
                          ? `Write at least ${MIN_ANSWER_CHARS} characters to request Check (${trimmedLength}/${MIN_ANSWER_CHARS}).`
                          : 'Ready to Check. One Check locks this answer and uses one Check call.'}
                      </p>
                    ) : null}
                  </div>

                  {isChecked && openEndedQuestion.checkFeedback ? (
                    <div className="practice-feedback mt-3 border-[var(--border)] bg-[var(--surface-muted)]">
                      <p className="font-semibold text-[var(--text)]">Check feedback</p>
                      <p className="mt-2 whitespace-pre-wrap text-[var(--text-muted)]">
                        {openEndedQuestion.checkFeedback}
                      </p>
                    </div>
                  ) : null}

                  {atLimit && !isChecked ? (
                    <div className="practice-feedback mt-3 border-[var(--border)] bg-[var(--surface-muted)]">
                      <p className="font-semibold text-[var(--text)]">Check limit reached</p>
                      <p className="mt-2 text-[var(--text-muted)]">
                        You can still save drafts.{' '}
                        {usage?.planTier === 'FREE' ? (
                          <a
                            href="/api/billing/checkout-redirect"
                            className="font-medium text-[var(--brand)] no-underline hover:underline"
                          >
                            Upgrade to PRO
                          </a>
                        ) : (
                          'Your Check allowance resets at the next usage period.'
                        )}
                      </p>
                    </div>
                  ) : null}

                  {saveNotice ? (
                    <p className="mt-3 text-sm font-medium text-[var(--brand)]">{saveNotice}</p>
                  ) : null}

                  {actionError ? (
                    <p
                      className="mt-3 text-sm font-medium text-red-600 dark:text-red-400"
                      role="alert"
                    >
                      {actionError}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="mt-3 shrink-0">
              {isAbcdView && isCurrentAbcdAnswered ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAbcdNext}
                    className="btn-primary inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm"
                  >
                    {abcdProgress.isComplete ? 'Continue to open-ended' : 'Next question'}
                  </button>
                </div>
              ) : null}

              {!isAbcdView && openEndedQuestion && !isChecked ? (
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSaveDraft()}
                    disabled={!canSave}
                    className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSavingDraft ? 'Saving...' : 'Save draft'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCheck()}
                    disabled={!canCheck}
                    className="btn-primary inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isChecking ? 'Checking...' : 'Check'}
                  </button>
                </div>
              ) : null}
            </div>
          </article>

          <div className="mt-2 flex shrink-0 items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => goToIndex(currentIndex - 1)}
              disabled={currentIndex === 0 || isBusy}
              className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => goToIndex(currentIndex + 1)}
              disabled={currentIndex >= PRACTICE_SET_QUESTION_COUNT - 1 || isBusy}
              className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        <aside className="practice-session__aside">
          <div className="practice-nav-card practice-session__nav p-3 sm:p-4">
            <p className="mb-2 shrink-0 text-sm font-semibold text-[var(--text)]">Questions</p>
            <div className="practice-session__nav-scroll">
              <QuestionSidebar
                items={sidebarItems}
                currentIndex={currentIndex}
                onSelect={goToIndex}
                disabled={isBusy}
                abcdProgress={{
                  completed: abcdProgress.answeredCount,
                  total: abcdProgress.total,
                }}
                openEndedProgress={{
                  completed: openEndedProgress.checkedCount,
                  total: openEndedProgress.total,
                }}
              />
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
