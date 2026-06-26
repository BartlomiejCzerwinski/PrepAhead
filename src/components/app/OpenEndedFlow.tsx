import { useEffect, useRef, useState } from 'react';

import { MIN_ANSWER_CHARS } from '../../lib/practice/answer-limits';
import type { ClientOpenEndedQuestion } from '../../lib/practice/client-payload';
import PracticeSummary from './PracticeSummary';

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

type Props = {
  practiceSetId: string;
  title: string;
  overviewUrl: string;
  practiceUrl: string;
  initialQuestions: ClientOpenEndedQuestion[];
  initialProgress: OpenEndedProgress;
  initialUsage: Usage | null;
  abcdComplete: boolean;
  initialSummary: FullSummary | null;
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

async function parseApiResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export default function OpenEndedFlow({
  practiceSetId,
  title,
  overviewUrl,
  practiceUrl,
  initialQuestions,
  initialProgress,
  initialUsage,
  abcdComplete,
  initialSummary,
}: Props) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [progress, setProgress] = useState(initialProgress);
  const [currentIndex, setCurrentIndex] = useState(initialProgress.currentIndex);
  const [usage, setUsage] = useState<Usage | null>(initialUsage);
  const [summary, setSummary] = useState<FullSummary | null>(initialSummary);
  const [draft, setDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const currentQuestion = questions[currentIndex] ?? null;

  useEffect(() => {
    setDraft(currentQuestion?.answerText ?? '');
    setActionError(null);
    setSaveNotice(null);
  }, [currentIndex, currentQuestion?.answerText]);

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

  if (progress.isCheckedComplete) {
    return (
      <section className="space-y-6">
        <div className="space-y-2">
          <a
            href={overviewUrl}
            className="inline-flex items-center text-sm font-medium text-[var(--brand)] no-underline hover:underline"
          >
            Back to overview
          </a>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
            {title}
          </h1>
        </div>
        <div className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-6 shadow-sm dark:shadow-none sm:px-8 sm:py-8">
          <p className="text-base font-semibold text-[var(--text)]">
            All {progress.total} open-ended answers checked.
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
            Finish your multiple-choice questions to complete this set.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={practiceUrl}
              className="btn-primary inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold no-underline shadow-sm"
            >
              Go to multiple-choice
            </a>
            <a
              href={overviewUrl}
              className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] no-underline transition hover:bg-[var(--surface-muted)]"
            >
              Back to overview
            </a>
          </div>
        </div>
      </section>
    );
  }

  if (!currentQuestion) {
    return (
      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-6 text-sm leading-6 text-[var(--text-muted)]">
        No open-ended questions are available for this set.
      </section>
    );
  }

  const isChecked = currentQuestion.isChecked;
  const trimmedLength = draft.trim().length;
  const atLimit = usage?.isAtCheckLimit ?? false;
  const isBusy = isSaving || isChecking;
  const canSave = !isChecked && !isBusy && trimmedLength > 0;
  const canCheck = !isChecked && !isBusy && trimmedLength >= MIN_ANSWER_CHARS && !atLimit;

  function applyProgress(next: OpenEndedProgress): void {
    setProgress(next);
  }

  async function handleSaveDraft(): Promise<void> {
    if (!currentQuestion || !canSave || submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setIsSaving(true);
    setActionError(null);
    setSaveNotice(null);

    try {
      const response = await fetch(`/api/practice-sets/${practiceSetId}/save-answer`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: currentQuestion.id, answerText: draft.trim() }),
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
      setQuestions((previous) =>
        previous.map((question) =>
          question.id === currentQuestion.id ? { ...question, answerText: savedText } : question,
        ),
      );
      applyProgress(body.progress);
      setSaveNotice('Draft saved.');
    } catch {
      setActionError('Could not save your draft. Check your connection and try again.');
    } finally {
      submittingRef.current = false;
      setIsSaving(false);
    }
  }

  async function handleCheck(): Promise<void> {
    if (!currentQuestion || !canCheck || submittingRef.current) {
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
        body: JSON.stringify({ questionId: currentQuestion.id, answerText: draft.trim() }),
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
      setQuestions((previous) =>
        previous.map((question) =>
          question.id === currentQuestion.id
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
      applyProgress(body.progress);
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

  function goToIndex(nextIndex: number): void {
    if (nextIndex < 0 || nextIndex >= questions.length) {
      return;
    }
    setCurrentIndex(nextIndex);
  }

  const remainingLabel =
    usage && usage.planTier === 'FREE'
      ? `${usage.checkRemaining} of 5 Checks left this period`
      : usage
        ? `${usage.checkRemaining} Checks left this period`
        : null;

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <a
          href={overviewUrl}
          className="inline-flex items-center text-sm font-medium text-[var(--brand)] no-underline hover:underline"
        >
          Back to overview
        </a>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
          {title}
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Open-ended · {progress.checkedCount} / {progress.total} checked
          {remainingLabel ? ` · ${remainingLabel}` : ''}
        </p>
        {!abcdComplete ? (
          <p className="text-sm text-[var(--text-muted)]">
            Multiple-choice questions are still open —{' '}
            <a
              href={practiceUrl}
              className="font-medium text-[var(--brand)] no-underline hover:underline"
            >
              continue them here
            </a>
            .
          </p>
        ) : null}
      </div>

      <article className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-sm dark:shadow-none sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Question {currentIndex + 1} of {progress.total}
        </p>
        <p className="mt-3 text-base font-semibold leading-7 text-[var(--text)]">
          {currentQuestion.prompt}
        </p>
        <p className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--text)]">Strong answer should cover:</span>{' '}
          {currentQuestion.guidance}
        </p>

        <div className="mt-6">
          <label
            htmlFor={`answer-${currentQuestion.id}`}
            className="text-sm font-semibold text-[var(--text)]"
          >
            Your answer
          </label>
          <textarea
            id={`answer-${currentQuestion.id}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            readOnly={isChecked}
            rows={8}
            placeholder="Write your answer as you would explain it in an interview..."
            className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--text)] outline-none transition focus:border-[var(--brand)] disabled:opacity-60"
          />
          {!isChecked ? (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {trimmedLength < MIN_ANSWER_CHARS
                ? `Write at least ${MIN_ANSWER_CHARS} characters to request Check (${trimmedLength}/${MIN_ANSWER_CHARS}).`
                : 'Ready to Check. One Check locks this answer and uses one Check call.'}
            </p>
          ) : null}
        </div>

        {isChecked && currentQuestion.checkFeedback ? (
          <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4 text-sm leading-6 text-[var(--text-muted)]">
            <p className="font-semibold text-[var(--text)]">Check feedback</p>
            <p className="mt-2 whitespace-pre-wrap">{currentQuestion.checkFeedback}</p>
          </div>
        ) : null}

        {atLimit && !isChecked ? (
          <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4 text-sm leading-6 text-[var(--text-muted)]">
            <p className="font-semibold text-[var(--text)]">Check limit reached</p>
            <p className="mt-2">
              You can still save drafts.{' '}
              {usage?.planTier === 'FREE' ? (
                <a
                  href="/#plans"
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
          <p className="mt-4 text-sm font-medium text-[var(--brand)]">{saveNotice}</p>
        ) : null}

        {actionError ? (
          <p className="mt-4 text-sm font-medium text-red-600 dark:text-red-400" role="alert">
            {actionError}
          </p>
        ) : null}

        {!isChecked ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleSaveDraft()}
              disabled={!canSave}
              className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save draft'}
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
      </article>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => goToIndex(currentIndex - 1)}
          disabled={currentIndex === 0 || isBusy}
          className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => goToIndex(currentIndex + 1)}
          disabled={currentIndex >= questions.length - 1 || isBusy}
          className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </section>
  );
}
