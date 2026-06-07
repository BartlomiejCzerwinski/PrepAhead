import { useMemo, useState } from 'react';

import type { ClientAbcdQuestion } from '../../lib/practice/client-payload';
import PracticeSummary from './PracticeSummary';

type PracticeProgress = {
  answeredCount: number;
  total: 15;
  currentIndex: number;
  isComplete: boolean;
};

type AbcdScore = {
  correct: number;
  total: 15;
  percent: number;
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
    openEnded: { attempted: 0; total: 5; label: 'Not attempted' };
  };
};

type AnswerErrorResponse = {
  ok: false;
  error: string;
  message: string;
};

type Props = {
  practiceSetId: string;
  title: string;
  overviewUrl: string;
  initialQuestions: ClientAbcdQuestion[];
  initialProgress: PracticeProgress;
  initialSummary: AbcdScore | null;
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

export default function PracticeFlow({
  practiceSetId,
  title,
  overviewUrl,
  initialQuestions,
  initialProgress,
  initialSummary,
}: Props) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [progress, setProgress] = useState(initialProgress);
  const [currentIndex, setCurrentIndex] = useState(initialProgress.currentIndex);
  const [summary, setSummary] = useState<AbcdScore | null>(initialSummary);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [revealCorrectByQuestionId, setRevealCorrectByQuestionId] = useState<
    Record<string, string>
  >({});

  const showSummary = summary !== null || progress.isComplete;

  const currentQuestion = questions[currentIndex] ?? null;

  const isCurrentAnswered = currentQuestion?.selectedOptionId !== undefined;

  const progressLabel = useMemo(
    () => `${progress.answeredCount} / ${progress.total}`,
    [progress.answeredCount, progress.total],
  );

  async function submitAnswer(selectedOptionId: string): Promise<void> {
    if (!currentQuestion || isCurrentAnswered || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(`/api/practice-sets/${practiceSetId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion.id,
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
        setSaveError(message);
        return;
      }

      setQuestions((previous) =>
        previous.map((question) =>
          question.id === currentQuestion.id
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
          [currentQuestion.id]: body.correctOptionId,
        }));
      }

      setProgress({
        answeredCount: body.progress.answeredCount,
        total: body.progress.total,
        currentIndex: body.progress.currentQuestionIndex,
        isComplete: body.progress.isComplete,
      });

      if (body.progress.isComplete && body.summary) {
        setSummary(body.summary.abcd);
      }
    } catch {
      setSaveError('Could not save your answer. Check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleNext(): void {
    if (progress.isComplete) {
      setSummary((existing) => existing ?? { correct: 0, total: 15, percent: 0 });
      return;
    }

    setSaveError(null);
    setCurrentIndex(progress.currentIndex);
  }

  if (showSummary && summary) {
    return (
      <PracticeSummary title={title} abcdScore={summary} overviewUrl={overviewUrl} />
    );
  }

  if (!currentQuestion) {
    return (
      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-6 text-sm leading-6 text-[var(--text-muted)]">
        No practice questions are available for this set.
      </section>
    );
  }

  const revealCorrectOptionId = revealCorrectByQuestionId[currentQuestion.id];

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
          Multiple choice · {progressLabel} answered
        </p>
      </div>

      <article className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-sm dark:shadow-none sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Question {currentIndex + 1} of {progress.total}
        </p>
        <p className="mt-3 text-base font-semibold leading-7 text-[var(--text)]">
          {currentQuestion.prompt}
        </p>

        <fieldset className="mt-6 space-y-3" disabled={isSaving}>
          <legend className="sr-only">Choose one answer</legend>
          {currentQuestion.options.map((option) => {
            const stateClass = optionStateClass(
              option.id,
              currentQuestion,
              revealCorrectOptionId,
            );
            const isLocked = isCurrentAnswered || isSaving;

            return (
              <label
                key={option.id}
                className={`quiz-option-label block cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)] transition ${stateClass} ${isLocked ? 'cursor-default' : 'hover:border-[var(--brand)]'}`}
              >
                <span className="flex items-start gap-3">
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    value={option.id}
                    checked={currentQuestion.selectedOptionId === option.id}
                    disabled={isLocked}
                    onChange={() => {
                      void submitAnswer(option.id);
                    }}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-semibold">{option.id}.</span> {option.text}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>

        {isSaving ? (
          <p className="mt-4 text-sm text-[var(--text-muted)]">Saving your answer...</p>
        ) : null}

        {saveError ? (
          <p className="mt-4 text-sm font-medium text-red-600 dark:text-red-400" role="alert">
            {saveError}
          </p>
        ) : null}

        {isCurrentAnswered && currentQuestion.explanation ? (
          <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4 text-sm leading-6 text-[var(--text-muted)]">
            <p className="font-semibold text-[var(--text)]">
              {currentQuestion.isCorrect ? 'Correct' : 'Incorrect'}
            </p>
            <p className="mt-2">{currentQuestion.explanation}</p>
          </div>
        ) : null}

        {isCurrentAnswered ? (
          <div className="mt-6">
            <button
              type="button"
              onClick={handleNext}
              className="btn-primary inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm"
            >
              {progress.isComplete ? 'View score' : 'Next question'}
            </button>
          </div>
        ) : null}
      </article>
    </section>
  );
}
