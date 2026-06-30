import { useRef, useState } from 'react';

type DeleteSuccessResponse = { ok: true };

type DeleteErrorResponse = { ok: false; error: string; message: string };

type Props = {
  practiceSetId: string;
};

type Phase = 'idle' | 'confirming' | 'deleting';

async function parseApiResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export default function DeletePracticeSetButton({ practiceSetId }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  async function handleDelete(): Promise<void> {
    if (submittingRef.current) {
      return;
    }
    submittingRef.current = true;
    setPhase('deleting');
    setError(null);

    try {
      const response = await fetch(`/api/practice-sets/${practiceSetId}/delete`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });

      const body = (await parseApiResponse(response)) as
        | DeleteSuccessResponse
        | DeleteErrorResponse
        | null;

      if (!response.ok || !body || body.ok !== true) {
        const message =
          body && 'message' in body && typeof body.message === 'string'
            ? body.message
            : 'Could not delete this practice set. Please try again.';
        setError(message);
        setPhase('confirming');
        submittingRef.current = false;
        return;
      }

      // Success — leave the page; no need to reset local state.
      window.location.assign('/app');
    } catch {
      setError('Could not delete this practice set. Check your connection and try again.');
      setPhase('confirming');
      submittingRef.current = false;
    }
  }

  if (phase === 'idle') {
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setPhase('confirming');
        }}
        className="inline-flex items-center justify-center rounded-xl border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
      >
        Delete this set
      </button>
    );
  }

  const deleting = phase === 'deleting';

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-[var(--text)]">
        Delete this set? You won’t be able to access it again.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
        <button
          type="button"
          onClick={() => {
            setPhase('idle');
            setError(null);
          }}
          disabled={deleting}
          className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
      {error ? (
        <p className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
