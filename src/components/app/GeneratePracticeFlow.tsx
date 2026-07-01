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
  jobId?: string;
  practiceSetId?: string;
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

type GenerationSummary = {
  abcdCount: number;
  openEndedCount: number;
};

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

class GenerationStillRunningError extends Error {
  constructor() {
    super(
      'Generation is still running in the background. Return to /app/generate to recover the result.',
    );
    this.name = 'GenerationStillRunningError';
  }
}

async function parseApiResponse(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function redirectToOverview(practiceSetId: string): void {
  window.location.assign(`/app/sets/${practiceSetId}`);
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
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activePracticeSetId, setActivePracticeSetId] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const recoveryStartedRef = useRef(false);

  const isAtGenerationLimit = usageSummary?.isAtGenerationLimit ?? false;
  const showUpgradePath = usageSummary?.planTier === 'FREE' && isAtGenerationLimit;
  const hasRecoverableJob = isGenerating || Boolean(activeJobId);
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

  useEffect(() => {
    if (!hasRecoverableJob) {
      return undefined;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasRecoverableJob]);

  async function nudgeGenerationWorker(jobId: string): Promise<void> {
    try {
      await fetch('/api/practice-sets/generate-worker', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId }),
      });
    } catch {
      // Recovery continues through status polling even if the worker request is interrupted.
    }
  }

  async function pollGenerationUntilTerminal(
    jobId: string,
    practiceSetId: string,
  ): Promise<GenerationSummary> {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (attempt % 3 === 0) {
        await nudgeGenerationWorker(jobId);
      }

      const statusResponse = await fetch(`/api/practice-sets/${practiceSetId}/status`, {
        method: 'GET',
        credentials: 'same-origin',
      });
      const statusPayload = await parseApiResponse(statusResponse);

      if (statusResponse.ok && statusPayload?.status === 'succeeded') {
        return statusPayload.summary ?? { abcdCount: 15, openEndedCount: 5 };
      }

      if (statusPayload?.status === 'failed') {
        throw new Error(statusPayload?.message ?? 'Generation failed. Please try again.');
      }

      if (statusResponse.status >= 500 || statusResponse.status === 504) {
        await sleep(2500);
        continue;
      }

      if (!statusResponse.ok && statusResponse.status !== 422) {
        throw new Error(statusPayload?.message ?? 'Could not load generation status.');
      }

      await sleep(1500);
    }

    throw new GenerationStillRunningError();
  }

  async function startTrackedGeneration(jobId: string, practiceSetId: string): Promise<void> {
    setGenerationError(null);
    setStageIndex(0);
    setIsGenerating(true);
    setActiveJobId(jobId);
    setActivePracticeSetId(practiceSetId);

    try {
      await pollGenerationUntilTerminal(jobId, practiceSetId);
      idempotencyKeyRef.current = null;
      redirectToOverview(practiceSetId);
    } catch (error) {
      if (error instanceof GenerationStillRunningError) {
        setGenerationError(error.message);
      } else {
        setGenerationError(
          error instanceof Error ? error.message : 'Generation failed. Please try again.',
        );
        setActiveJobId(null);
        setActivePracticeSetId(null);
      }
    } finally {
      setIsGenerating(false);
    }
  }

  useEffect(() => {
    if (recoveryStartedRef.current || !initialRecoveryState) {
      return;
    }

    if (initialRecoveryState.status === 'failed') {
      recoveryStartedRef.current = true;
      setGenerationError(
        initialRecoveryState.message ?? 'Generation failed. You can start a new request.',
      );
      return;
    }

    if (
      initialRecoveryState.status === 'running' &&
      initialRecoveryState.jobId &&
      initialRecoveryState.practiceSetId
    ) {
      recoveryStartedRef.current = true;
      void startTrackedGeneration(
        initialRecoveryState.jobId,
        initialRecoveryState.practiceSetId,
      );
    }
  }, [initialRecoveryState]);

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
              href="/api/billing/checkout-redirect"
              className="btn-primary mt-4 inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm no-underline"
            >
              Upgrade to PRO
            </a>
          )}
        </div>
      )}

      {latestReadySetId && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm leading-6 text-green-800 dark:text-green-300">
          <p>
            Your latest practice set is ready.{' '}
            <a
              href={`/app/sets/${latestReadySetId}`}
              className="font-semibold text-green-800 underline underline-offset-2 dark:text-green-300"
            >
              View overview
            </a>{' '}
            or start a new generation below.
          </p>
        </div>
      )}

      {hasRecoverableJob && (
        <div
          className="rounded-xl border border-brand-500/20 bg-[var(--brand-soft)] px-4 py-3 text-sm leading-6 text-[var(--text)]"
          role="status"
        >
          Generation is running in the background. You can leave this page and return to
          <span className="font-semibold"> /app/generate </span>
          to recover the result. Closing the tab may show a browser warning while the job is active.
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
          {activePracticeSetId && (
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Recoverable job linked to practice set{' '}
              <span className="font-semibold text-[var(--text)]">{activePracticeSetId}</span>.
            </p>
          )}

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
      ) : (
        <form
          onSubmit={async (event) => {
            event.preventDefault();

            if (submitDisabled) {
              return;
            }

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
                typeof generatePayload.jobId !== 'string' ||
                typeof generatePayload.practiceSetId !== 'string'
              ) {
                throw new Error(
                  generatePayload?.message ?? 'Could not start generation. Please try again.',
                );
              }

              await startTrackedGeneration(
                generatePayload.jobId,
                generatePayload.practiceSetId,
              );
            } catch (error) {
              setGenerationError(
                error instanceof Error ? error.message : 'Generation failed. Please try again.',
              );
              setIsGenerating(false);
              setActiveJobId(null);
              setActivePracticeSetId(null);
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
