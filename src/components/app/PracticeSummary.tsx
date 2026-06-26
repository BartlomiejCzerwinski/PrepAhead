import { buildOpenEndedSummaryStub } from '../../lib/practice/score-abcd';

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

type Props = {
  title: string;
  abcdScore: AbcdScore;
  overviewUrl: string;
  generateUrl?: string;
  showBackLink?: boolean;
  openEndedSummary?: OpenEndedSummary;
  openEndedUrl?: string;
};

export default function PracticeSummary({
  title,
  abcdScore,
  overviewUrl,
  generateUrl = '/app/generate',
  showBackLink = true,
  openEndedSummary,
  openEndedUrl,
}: Props) {
  const openEndedStub = buildOpenEndedSummaryStub();

  return (
    <section className="space-y-6">
      {showBackLink ? (
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
      ) : null}

      <div className="practice-summary-panel rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-6 shadow-sm dark:shadow-none sm:px-8 sm:py-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Practice drill score
        </p>
        <p className="mt-3 text-3xl font-bold text-[var(--text)]">
          {abcdScore.correct} / {abcdScore.total} correct ({abcdScore.percent}%)
        </p>
        <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
          This score reflects multiple-choice practice only — not overall interview readiness.
        </p>

        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4 text-sm leading-6 text-[var(--text-muted)]">
          <p className="font-semibold text-[var(--text)]">Open-ended questions</p>
          {openEndedSummary ? (
            <p className="mt-2">
              {openEndedSummary.attempted} / {openEndedSummary.total} attempted —{' '}
              {openEndedSummary.checked} / {openEndedSummary.total} checked. Open-ended answers get
              critical feedback, not a pass/fail grade.
            </p>
          ) : (
            <p className="mt-2">
              {openEndedStub.attempted} / {openEndedStub.total} attempted — {openEndedStub.label}.
              Check feedback for open-ended answers ships in a later update.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href={overviewUrl}
          className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] no-underline transition hover:bg-[var(--surface-muted)]"
        >
          Back to overview
        </a>
        {openEndedUrl ? (
          <a
            href={openEndedUrl}
            className="btn-primary inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm no-underline"
          >
            Answer open-ended questions
          </a>
        ) : null}
        <a
          href={generateUrl}
          className={
            openEndedUrl
              ? 'inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] no-underline transition hover:bg-[var(--surface-muted)]'
              : 'btn-primary inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm no-underline'
          }
        >
          Generate another set
        </a>
      </div>
    </section>
  );
}
