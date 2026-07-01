import type { APIRoute } from 'astro';

import { generatePracticeSet } from '../../../lib/server/practice/generate-practice-set';
import { jsonResponse } from '../../../lib/server/response';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { summarizePracticeSet } from '../../../lib/practice/contracts';

export const prerender = false;
const STALE_RUNNING_MS = 65_000;

type GenerateWorkerRequestBody = {
  jobId?: unknown;
  simulateMalformed?: unknown;
};

function mergeHeaders(target: Headers, source: Headers): void {
  source.forEach((value, key) => {
    target.set(key, value);
  });
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
      { ok: false, error: 'unauthorized', message: 'You must be signed in to run generation.' },
      { status: 401, headers: responseHeaders },
    );
  }

  let body: GenerateWorkerRequestBody;

  try {
    body = (await request.json()) as GenerateWorkerRequestBody;
  } catch {
    return jsonResponse(
      { ok: false, error: 'invalid_request', message: 'Invalid generation worker payload.' },
      { status: 400, headers: responseHeaders },
    );
  }

  const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : '';
  const simulateMalformed = import.meta.env.DEV && body.simulateMalformed === true;

  if (!jobId) {
    return jsonResponse(
      { ok: false, error: 'missing_job_id', message: 'Generation job id is required.' },
      { status: 400, headers: responseHeaders },
    );
  }

  const { data: existingJob, error: existingJobError } = await supabase
    .from('generation_jobs')
    .select('id, practice_set_id, status, failure_code, failure_message, started_at')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingJobError || !existingJob) {
    return jsonResponse(
      { ok: false, error: 'job_not_found', message: 'Generation job not found.' },
      { status: 404, headers: responseHeaders },
    );
  }

  if (existingJob.status === 'succeeded') {
    return jsonResponse(
      {
        ok: true,
        jobId: existingJob.id,
        practiceSetId: existingJob.practice_set_id,
        status: existingJob.status,
      },
      { status: 200, headers: responseHeaders },
    );
  }

  if (existingJob.status === 'failed') {
    return jsonResponse(
      {
        ok: false,
        error: existingJob.failure_code ?? 'generation_failed',
        message: existingJob.failure_message ?? 'Generation failed.',
        jobId: existingJob.id,
        practiceSetId: existingJob.practice_set_id,
        status: existingJob.status,
      },
      { status: 422, headers: responseHeaders },
    );
  }

  const startedAt =
    typeof existingJob.started_at === 'string' ? new Date(existingJob.started_at) : null;
  const isStaleRunning =
    existingJob.status === 'running' &&
    startedAt instanceof Date &&
    !Number.isNaN(startedAt.valueOf()) &&
    Date.now() - startedAt.valueOf() > STALE_RUNNING_MS;

  if (existingJob.status === 'running' && !isStaleRunning) {
    return jsonResponse(
      {
        ok: true,
        jobId: existingJob.id,
        practiceSetId: existingJob.practice_set_id,
        status: existingJob.status,
      },
      { status: 200, headers: responseHeaders },
    );
  }

  const claimPayload = {
    status: 'running',
    claimed_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    failure_code: null,
    failure_message: null,
  };

  let claimQuery = supabase
    .from('generation_jobs')
    .update(claimPayload)
    .eq('id', jobId)
    .eq('user_id', user.id)
    .eq('status', existingJob.status);

  if (existingJob.status === 'running' && typeof existingJob.started_at === 'string') {
    claimQuery = claimQuery.eq('started_at', existingJob.started_at);
  }

  const { data: claimedJob, error: claimError } = await claimQuery
    .select('id, practice_set_id')
    .maybeSingle();

  if (claimError) {
    return jsonResponse(
      { ok: false, error: 'claim_failed', message: 'Could not claim the generation job.' },
      { status: 500, headers: responseHeaders },
    );
  }

  if (!claimedJob) {
    return jsonResponse(
      {
        ok: true,
        jobId: existingJob.id,
        practiceSetId: existingJob.practice_set_id,
        status: 'running',
      },
      { status: 200, headers: responseHeaders },
    );
  }

  const { data: practiceSet, error: practiceSetError } = await supabase
    .from('practice_sets')
    .select('id, job_description_text, cv_text')
    .eq('id', claimedJob.practice_set_id)
    .eq('user_id', user.id)
    .single();

  if (practiceSetError || !practiceSet) {
    await supabase.rpc('mark_generation_job_failed', {
      p_job_id: claimedJob.id,
      p_failure_code: 'practice_set_missing',
      p_failure_message: 'The draft practice set could not be loaded.',
    });

    return jsonResponse(
      {
        ok: false,
        error: 'practice_set_missing',
        message: 'The draft practice set could not be loaded.',
      },
      { status: 500, headers: responseHeaders },
    );
  }

  const generationResult = await generatePracticeSet({
    jobDescription: practiceSet.job_description_text,
    resumeText: practiceSet.cv_text,
    simulateMalformed,
  });

  if (!generationResult.ok) {
    await supabase.rpc('mark_generation_job_failed', {
      p_job_id: claimedJob.id,
      p_failure_code: generationResult.code,
      p_failure_message: generationResult.message,
    });

    return jsonResponse(
      {
        ok: false,
        error: generationResult.code,
        message: generationResult.message,
        jobId: claimedJob.id,
        practiceSetId: claimedJob.practice_set_id,
        status: 'failed',
      },
      {
        status: generationResult.code === 'configuration' ? 500 : 422,
        headers: responseHeaders,
      },
    );
  }

  const { data: finalizedJob, error: finalizeError } = await supabase.rpc(
    'finalize_generation_job',
    {
      p_job_id: claimedJob.id,
      p_title: generationResult.title,
      p_cv_text: practiceSet.cv_text,
      p_content: JSON.parse(JSON.stringify(generationResult.content)),
    },
  );

  if (finalizeError) {
    const failureDetail = finalizeError.message?.trim() || 'unknown finalize error';
    const isDailyLimit = failureDetail.includes('Daily generation limit reached');

    await supabase.rpc('mark_generation_job_failed', {
      p_job_id: claimedJob.id,
      p_failure_code: isDailyLimit
        ? 'daily_generation_limit_reached'
        : 'finalization_failed',
      p_failure_message: isDailyLimit
        ? "You have reached today's generation limit. Try again tomorrow (UTC)."
        : 'The generated set could not be saved.',
    });

    return jsonResponse(
      {
        ok: false,
        error: isDailyLimit
          ? 'daily_generation_limit_reached'
          : 'finalization_failed',
        message: isDailyLimit
          ? "You have reached today's generation limit. Try again tomorrow (UTC)."
          : import.meta.env.DEV
            ? `The generated set could not be saved (${failureDetail}).`
            : 'The generated set could not be saved.',
        rpcCode: finalizeError.code ?? null,
        detail: import.meta.env.DEV && !isDailyLimit ? failureDetail : undefined,
      },
      { status: isDailyLimit ? 403 : 500, headers: responseHeaders },
    );
  }

  const finalizedRow = Array.isArray(finalizedJob) ? finalizedJob[0] : finalizedJob;

  return jsonResponse(
    {
      ok: true,
      jobId: claimedJob.id,
      practiceSetId: finalizedRow?.practice_set_id ?? claimedJob.practice_set_id,
      status: 'succeeded',
      summary: summarizePracticeSet(generationResult.content),
    },
    { status: 200, headers: responseHeaders },
  );
};
