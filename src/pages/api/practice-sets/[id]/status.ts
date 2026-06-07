import type { APIRoute } from 'astro';

import {
  normalizePracticeSetContent,
  PracticeSetContractError,
  summarizePracticeSet,
} from '../../../../lib/practice/contracts';
import { jsonResponse } from '../../../../lib/server/response';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const prerender = false;

function mergeHeaders(target: Headers, source: Headers): void {
  source.forEach((value, key) => {
    target.set(key, value);
  });
}

export const GET: APIRoute = async ({ params, request, cookies }) => {
  const authHeaders = new Headers();
  const supabase = createSupabaseServerClient(request, cookies, authHeaders);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const responseHeaders = new Headers();
  mergeHeaders(responseHeaders, authHeaders);

  if (!user) {
    return jsonResponse(
      { ok: false, error: 'unauthorized', message: 'You must be signed in to view generation status.' },
      { status: 401, headers: responseHeaders },
    );
  }

  const practiceSetId = typeof params.id === 'string' ? params.id.trim() : '';

  if (!practiceSetId) {
    return jsonResponse(
      { ok: false, error: 'missing_practice_set_id', message: 'Practice set id is required.' },
      { status: 400, headers: responseHeaders },
    );
  }

  const { data: generationJob, error: generationJobError } = await supabase
    .from('generation_jobs')
    .select('id, practice_set_id, status, failure_code, failure_message, finished_at')
    .eq('practice_set_id', practiceSetId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (generationJobError || !generationJob) {
    return jsonResponse(
      { ok: false, error: 'job_not_found', message: 'Generation job not found.' },
      { status: 404, headers: responseHeaders },
    );
  }

  const overviewUrl = `/app/sets/${generationJob.practice_set_id}`;

  if (generationJob.status === 'failed') {
    return jsonResponse(
      {
        ok: false,
        jobId: generationJob.id,
        practiceSetId: generationJob.practice_set_id,
        status: generationJob.status,
        error: generationJob.failure_code ?? 'generation_failed',
        message: generationJob.failure_message ?? 'Generation failed.',
        overviewUrl,
      },
      { status: 422, headers: responseHeaders },
    );
  }

  if (generationJob.status === 'succeeded') {
    const { data: practiceSet, error: practiceSetError } = await supabase
      .from('practice_sets')
      .select('content')
      .eq('id', generationJob.practice_set_id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    let summary = { abcdCount: 15, openEndedCount: 5 };

    if (!practiceSetError && practiceSet?.content) {
      try {
        const normalizedContent = normalizePracticeSetContent(practiceSet.content);
        summary = summarizePracticeSet(normalizedContent);
      } catch (error) {
        if (!(error instanceof PracticeSetContractError)) {
          throw error;
        }
      }
    }

    return jsonResponse(
      {
        ok: true,
        jobId: generationJob.id,
        practiceSetId: generationJob.practice_set_id,
        status: generationJob.status,
        overviewUrl,
        summary,
        finishedAt: generationJob.finished_at,
      },
      { status: 200, headers: responseHeaders },
    );
  }

  return jsonResponse(
    {
      ok: true,
      jobId: generationJob.id,
      practiceSetId: generationJob.practice_set_id,
      status: generationJob.status,
      overviewUrl,
    },
    { status: 200, headers: responseHeaders },
  );
};
