import type { APIRoute } from 'astro';

import { generatePracticeSet } from '../../../lib/server/practice/generate-practice-set';
import { jsonResponse } from '../../../lib/server/response';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { summarizePracticeSet } from '../../../lib/practice/contracts';

export const prerender = false;

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

  const { data: claimedJob, error: claimError } = await supabase
    .from('generation_jobs')
    .update({
      status: 'running',
      claimed_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      failure_code: null,
      failure_message: null,
    })
    .eq('id', jobId)
    .eq('user_id', user.id)
    .eq('status', 'queued')
    .select('id, practice_set_id')
    .maybeSingle();

  if (claimError) {
    return jsonResponse(
      { ok: false, error: 'claim_failed', message: 'Could not claim the generation job.' },
      { status: 500, headers: responseHeaders },
    );
  }

  if (!claimedJob) {
    const { data: existingJob, error: existingJobError } = await supabase
      .from('generation_jobs')
      .select('id, practice_set_id, status, failure_code, failure_message')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingJobError || !existingJob) {
      return jsonResponse(
        { ok: false, error: 'job_not_found', message: 'Generation job not found.' },
        { status: 404, headers: responseHeaders },
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
      p_content: generationResult.content,
    },
  );

  if (finalizeError) {
    await supabase.rpc('mark_generation_job_failed', {
      p_job_id: claimedJob.id,
      p_failure_code: 'finalization_failed',
      p_failure_message: 'The generated set could not be saved.',
    });

    return jsonResponse(
      {
        ok: false,
        error: 'finalization_failed',
        message: 'The generated set could not be saved.',
      },
      { status: 500, headers: responseHeaders },
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
