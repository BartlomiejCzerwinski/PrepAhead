import type { APIRoute } from 'astro';

import { getUsageSummary } from '../../../lib/plan';
import { jsonResponse } from '../../../lib/server/response';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const prerender = false;

const MAX_JOB_DESCRIPTION_CHARS = 32_768;
const MAX_RESUME_TEXT_CHARS = 64_000;

type GenerateRequestBody = {
  jobDescription?: unknown;
  resumeText?: unknown;
  idempotencyKey?: unknown;
};

function mergeHeaders(target: Headers, source: Headers): void {
  source.forEach((value, key) => {
    target.set(key, value);
  });
}

function nudgeGenerationWorker(request: Request, jobId: string): void {
  const workerUrl = new URL('/api/practice-sets/generate-worker', request.url);
  const cookie = request.headers.get('cookie');

  void fetch(workerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ jobId }),
  }).catch(() => {
    // Client polling remains the recovery path if the background nudge fails.
  });
}

function normalizeTextInput(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const authHeaders = new Headers();
  const supabase = createSupabaseServerClient(request, cookies, authHeaders);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const responseHeaders = new Headers();
  mergeHeaders(responseHeaders, authHeaders);

  if (!user) {
    return jsonResponse(
      { ok: false, error: 'unauthorized', message: 'You must be signed in to generate a set.' },
      { status: 401, headers: responseHeaders },
    );
  }

  let body: GenerateRequestBody;

  try {
    body = (await request.json()) as GenerateRequestBody;
  } catch {
    return jsonResponse(
      { ok: false, error: 'invalid_request', message: 'Invalid generation request payload.' },
      { status: 400, headers: responseHeaders },
    );
  }

  const jobDescription = normalizeTextInput(body.jobDescription);
  const resumeText = normalizeTextInput(body.resumeText);
  const idempotencyKey =
    normalizeTextInput(body.idempotencyKey) ?? crypto.randomUUID();

  if (!jobDescription) {
    return jsonResponse(
      {
        ok: false,
        error: 'missing_job_description',
        message: 'Paste a job description before starting generation.',
      },
      { status: 400, headers: responseHeaders },
    );
  }

  if (jobDescription.length > MAX_JOB_DESCRIPTION_CHARS) {
    return jsonResponse(
      {
        ok: false,
        error: 'job_description_too_long',
        message: 'The job description is too long. Shorten it and try again.',
      },
      { status: 400, headers: responseHeaders },
    );
  }

  if (resumeText && resumeText.length > MAX_RESUME_TEXT_CHARS) {
    return jsonResponse(
      {
        ok: false,
        error: 'resume_text_too_long',
        message: 'The resume text is too long. Upload a shorter PDF and try again.',
      },
      { status: 400, headers: responseHeaders },
    );
  }

  const usageSummary = await getUsageSummary(supabase, user.id);
  if (!usageSummary.ok) {
    return jsonResponse(
      {
        ok: false,
        error: 'usage_unavailable',
        message: 'Could not load your current usage. Please refresh and try again.',
      },
      { status: 503, headers: responseHeaders },
    );
  }

  if (usageSummary.data.isAtGenerationLimit) {
    if (usageSummary.data.generationLimitReason === 'daily') {
      return jsonResponse(
        {
          ok: false,
          error: 'daily_generation_limit_reached',
          message:
            "You have reached today's generation limit. Try again tomorrow (UTC).",
        },
        { status: 403, headers: responseHeaders },
      );
    }

    return jsonResponse(
      {
        ok: false,
        error: 'generation_limit_reached',
        message:
          usageSummary.data.planTier === 'FREE'
            ? 'You have reached your FREE plan generation limit.'
            : 'You have reached your generation limit for this period.',
        upgradeUrl: usageSummary.data.planTier === 'FREE' ? '/api/billing/checkout-redirect' : null,
      },
      { status: 403, headers: responseHeaders },
    );
  }

  const { data: existingJob } = await supabase
    .from('generation_jobs')
    .select('id, practice_set_id')
    .eq('user_id', user.id)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (existingJob) {
    return jsonResponse(
      {
        ok: true,
        jobId: existingJob.id,
        practiceSetId: existingJob.practice_set_id,
      },
      { status: 200, headers: responseHeaders },
    );
  }

  const placeholderTitle = 'Generating practice set…';

  const { data: practiceSet, error: practiceSetError } = await supabase
    .from('practice_sets')
    .insert({
      user_id: user.id,
      title: placeholderTitle,
      job_description_text: jobDescription,
      cv_text: resumeText,
      content: {
        version: 1,
        generatedAt: new Date().toISOString(),
        questions: [],
      },
    })
    .select('id')
    .single();

  if (practiceSetError || !practiceSet) {
    return jsonResponse(
      {
        ok: false,
        error: 'job_creation_failed',
        message: 'Could not create the practice-set record. Please try again.',
      },
      { status: 500, headers: responseHeaders },
    );
  }

  const { data: generationJob, error: generationJobError } = await supabase
    .from('generation_jobs')
    .insert({
      user_id: user.id,
      practice_set_id: practiceSet.id,
      idempotency_key: idempotencyKey,
      status: 'queued',
    })
    .select('id, practice_set_id')
    .single();

  if (generationJobError) {
    await supabase
      .from('practice_sets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', practiceSet.id)
      .eq('user_id', user.id);

    return jsonResponse(
      {
        ok: false,
        error: 'job_creation_failed',
        message: 'Could not create the generation job. Please try again.',
      },
      { status: 500, headers: responseHeaders },
    );
  }

  nudgeGenerationWorker(request, generationJob.id);

  return jsonResponse(
    {
      ok: true,
      jobId: generationJob.id,
      practiceSetId: generationJob.practice_set_id,
    },
    { status: 202, headers: responseHeaders },
  );
};
