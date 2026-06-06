import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';

import type { UsageSummary } from '../../lib/plan';

type RecoveryState = {
  status: 'idle' | 'running' | 'failed' | 'ready';
  message?: string;
};

type Props = {
  usageSummary: UsageSummary | null;
  usageError?: boolean;
  initialRecoveryState?: RecoveryState | null;
  latestReadySetId?: string | null;
};

type UploadState =
  | { status: 'idle' }
  | { status: 'parsing'; fileName: string }
  | { status: 'ready'; fileName: string; message: string }
  | { status: 'error'; message: string };

const GENERATION_STAGES = [
  'Reviewing the job description',
  'Preparing optional CV context',
  'Generating interview questions',
  'Validating and saving the practice set',
] as const;

type GenerationSuccess = {
  jobId: string;
  practiceSetId: string;
  summary: {
    abcdCount: number;
    openEndedCount: number;
  };
};

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function parseApiResponse(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export default function GeneratePracticeFlow({
  usageSummary,
  usageError = false,
  initialRecoveryState,
  latestReadySetId,
}: Props) {
  const [jobDescription, setJobDescription] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' });
  const [isGenerating, setIsGenerating] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const stageTimerRef = useRef<number | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState<GenerationSuccess | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const isAtGenerationLimit = usageSummary?.isAtGenerationLimit ?? false;
  const showUpgradePath = usageSummary?.planTier === 'FREE' && isAtGenerationLimit;
  const submitDisabled =
    usageError ||
    !usageSummary ||
    isAtGenerationLimit ||
    isGenerating ||
    uploadState.status === 'parsing' ||
    jobDescription.trim().length === 0;

  const helperCopy = useMemo(() => {
    if (usageSummary) {
      return `${usageSummary.generationRemaining} of ${usageSummary.generationLimit} generations remaining this period.`;
    }

    return 'Load your usage summary to see remaining generations before you submit.';
  }, [usageSummary]);

  useEffect(() => {
    if (!isGenerating) {
      if (stageTimerRef.current) {
        window.clearTimeout(stageTimerRef.current);
        stageTimerRef.current = null;
      }
      return undefined;
    }

    if (stageIndex >= GENERATION_STAGES.length - 1) {
      return undefined;
    }

    stageTimerRef.current = window.setTimeout(() => {
      setStageIndex((current) => Math.min(current + 1, GENERATION_STAGES.length - 1));
    }, 1100);

    return () => {
      if (stageTimerRef.current) {
        window.clearTimeout(stageTimerRef.current);
        stageTimerRef.current = null;
      }
    };
  }, [isGenerating, stageIndex]);

  async function handlePdfChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setUploadState({ status: 'idle' });
      setResumeText('');
      return;
    }

    setUploadState({ status: 'parsing', fileName: file.name });
    setGenerationError(null);

    try {
      const formData = new FormData();
      formData.set('file', file);

      const response = await fetch('/api/resume/parse', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      });

      const payload = await parseApiResponse(response);

      if (!response.ok || !payload?.ok || typeof payload.resumeText !== 'string') {
        throw new Error(payload?.message ?? 'We could not accept that PDF. Try another file.');
      }

      const parsedResumeText = payload.resumeText;
      setResumeText(parsedResumeText);
      setUploadState({
        status: 'ready',
        fileName: file.name,
        message: 'PDF accepted for generation. Parsed resume text stays hidden in this flow.',
      });
    } catch (error) {
      setResumeText('');
      setUploadState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'We could not accept that PDF. Try another file.',
      });
    } finally {
      event.target.value = '';
    }
  }

  function resetDraft(keepInputs = false) {
    setIsGenerating(false);
    setStageIndex(0);
    setGenerationError(null);
    setGenerationSuccess(null);
    idempotencyKeyRef.current = null;

    if (!keepInputs) {
      setJobDescription('');
      setResumeText('');
      setUploadState({ status: 'idle' });
    }
  }

  async function runGenerationWorker(jobId: string): Promise<GenerationSuccess> {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const workerResponse = await fetch('/api/practice-sets/generate-worker', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ jobId }),
        });

        const workerPayload = await parseApiResponse(workerResponse);

        if (workerResponse.ok && workerPayload?.status === 'succeeded') {
          return {
            jobId,
            practiceSetId: String(workerPayload.practiceSetId),
            summary: workerPayload.summary ?? { abcdCount: 15, openEndedCount: 5 },
          };
        }

        if (workerResponse.ok && workerPayload?.status === 'running') {
          await sleep(1500);
          continue;
        }

        if (workerResponse.status >= 500 || workerResponse.status === 504) {
          await sleep(2500);
          continue;
        }

        throw new Error(workerPayload?.message ?? 'Generation failed. Please try again.');
      } catch {
        await sleep(1500);
        continue;
      }
    }

    throw new Error('Generation is taking longer than expected. Try again in a moment.');
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <a
          href="/app"
          className="inline-flex items-center text-sm font-medium text-[var(--brand)] no-underline hover:underline"
        >
          Back to dashboard
        </a>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
          Generate a practice set
        </h1>
        <p className="text-sm leading-6 text-[var(--text-muted)]">
          Paste the job description, optionally add a PDF CV, and PrepAhead will use that context
          for the generation flow. If you skip the CV, the request stays JD-only.
        </p>
      </div>

      {usageError && (
        <div
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-700 dark:text-red-300"
          role="alert"
        >
          Could not load your usage summary. Refresh before starting a generation.
        </div>
      )}

      {isAtGenerationLimit && (
        <div
          className="rounded-[1.75rem] border border-brand-500/30 bg-[var(--brand-soft)] px-5 py-4 text-sm leading-6 text-[var(--text)]"
          role="status"
        >
          <p className="font-semibold">
            {showUpgradePath
              ? 'You have reached your FREE plan generation limit.'
              : 'You have reached your generation limit for this period.'}
          </p>
          <p className="mt-2 text-[var(--text-muted)]">
            {showUpgradePath
              ? 'Upgrade to PRO to start another practice set before the next reset.'
              : 'Wait for the next usage reset before starting another practice set.'}
          </p>
          {showUpgradePath && (
            <a
              href="/#plans"
              className="btn-primary mt-4 inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm no-underline"
            >
              Upgrade to PRO
            </a>
          )}
        </div>
      )}

      {initialRecoveryState && initialRecoveryState.status !== 'idle' && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">
          Recovery state: {initialRecoveryState.status}
          {initialRecoveryState.message ? ` - ${initialRecoveryState.message}` : ''}
        </div>
      )}

      {latestReadySetId && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">
          Latest completed set is ready. The overview handoff will connect in a later phase.
        </div>
      )}

      {generationError && (
        <div
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-700 dark:text-red-300"
          role="alert"
        >
          {generationError}
        </div>
      )}

      {isGenerating ? (
        <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-sm dark:shadow-none sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--brand)]">
            <span>In progress</span>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-[var(--text)]">Generating your practice set</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            PrepAhead is parsing any uploaded CV context, generating questions, and validating the
            exact 20-question contract before saving the result.
          </p>

          <ol className="mt-6 space-y-3">
            {GENERATION_STAGES.map((stage, index) => {
              const isDone = index < stageIndex;
              const isCurrent = index === stageIndex;

              return (
                <li
                  key={stage}
                  className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3"
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      isDone || isCurrent
                        ? 'bg-[var(--brand)] text-white'
                        : 'bg-[var(--surface-strong)] text-[var(--text-muted)]'
                    }`}
                    aria-hidden="true"
                  >
                    {isDone ? '✓' : index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">{stage}</p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      {isCurrent
                        ? 'Current step'
                        : isDone
                          ? 'Completed'
                          : 'Waiting'}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : generationSuccess ? (
        <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-sm dark:shadow-none sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-green-700 dark:text-green-300">
            <span>Generation saved</span>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-[var(--text)]">Practice set created successfully</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            The exact-20 payload was validated and saved through the durable generation job path.
            The overview redirect arrives in Phase 3.
          </p>
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4 text-sm leading-6 text-[var(--text-muted)]">
            <p>
              <span className="font-semibold text-[var(--text)]">Practice set id:</span>{' '}
              {generationSuccess.practiceSetId}
            </p>
            <p className="mt-2">
              <span className="font-semibold text-[var(--text)]">Question mix:</span>{' '}
              {generationSuccess.summary.abcdCount} abcd / {generationSuccess.summary.openEndedCount}{' '}
              open-ended
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => resetDraft()}
              className="btn-primary inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm"
            >
              Start another generation
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={async (event) => {
            event.preventDefault();

            if (submitDisabled) {
              return;
            }

            setGenerationError(null);
            setGenerationSuccess(null);
            setStageIndex(0);
            setIsGenerating(true);

            const idempotencyKey = idempotencyKeyRef.current ?? crypto.randomUUID();
            idempotencyKeyRef.current = idempotencyKey;

            try {
              const generateResponse = await fetch('/api/practice-sets/generate', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  jobDescription,
                  resumeText,
                  idempotencyKey,
                }),
              });

              const generatePayload = await parseApiResponse(generateResponse);

              if (
                !generateResponse.ok ||
                !generatePayload?.ok ||
                typeof generatePayload.jobId !== 'string'
              ) {
                throw new Error(
                  generatePayload?.message ?? 'Could not start generation. Please try again.',
                );
              }

              const result = await runGenerationWorker(generatePayload.jobId);
              setGenerationSuccess(result);
              idempotencyKeyRef.current = null;
            } catch (error) {
              setGenerationError(
                error instanceof Error ? error.message : 'Generation failed. Please try again.',
              );
            } finally {
              setIsGenerating(false);
            }
          }}
          className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-sm dark:shadow-none sm:p-8"
        >
          <div className="space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="job-description"
                className="block text-sm font-semibold text-[var(--text)]"
              >
                Job description
              </label>
              <p className="text-sm leading-6 text-[var(--text-muted)]">
                Paste the role description you want PrepAhead to ground the practice set on.
              </p>
              <textarea
                id="job-description"
                name="jobDescription"
                rows={12}
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                placeholder="Paste the job description here..."
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--text)] outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <label htmlFor="resume-upload" className="block text-sm font-semibold text-[var(--text)]">
                  Optional PDF CV
                </label>
                <p className="text-sm leading-6 text-[var(--text-muted)]">
                  PDF only. No DOCX, no OCR promise, and no editable parsed text in this flow.
                </p>
              </div>

              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-5 py-6 text-center transition hover:border-brand-500/50">
                <span className="text-sm font-semibold text-[var(--text)]">Choose a PDF</span>
                <span className="mt-2 text-sm text-[var(--text-muted)]">
                  Keep files under 5 MB for the current upload flow.
                </span>
                <input
                  id="resume-upload"
                  name="resumeUpload"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handlePdfChange}
                  className="sr-only"
                />
              </label>

              {uploadState.status === 'parsing' && (
                <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">
                  Parsing {uploadState.fileName}...
                </p>
              )}

              {uploadState.status === 'ready' && (
                <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm leading-6 text-green-700 dark:text-green-300">
                  <p>
                    {uploadState.fileName}: {uploadState.message}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setResumeText('');
                      setUploadState({ status: 'idle' });
                    }}
                    className="mt-3 inline-flex text-sm font-semibold text-green-700 underline underline-offset-2 dark:text-green-300"
                  >
                    Remove CV and continue with JD only
                  </button>
                </div>
              )}

              {uploadState.status === 'error' && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-700 dark:text-red-300">
                  {uploadState.message}
                </p>
              )}
            </div>

            <input type="hidden" name="resumeText" value={resumeText} />

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4">
              <p className="text-sm font-semibold text-[var(--text)]">Usage</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{helperCopy}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={submitDisabled}
                className="btn-primary inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploadState.status === 'parsing'
                  ? 'Parsing CV...'
                  : showUpgradePath
                    ? 'Upgrade to continue'
                    : isAtGenerationLimit
                      ? 'Generation unavailable'
                    : 'Generate practice set'}
              </button>
              <p className="text-sm leading-6 text-[var(--text-muted)]">
                Submit stays disabled while parsing or once generation starts.
              </p>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}
