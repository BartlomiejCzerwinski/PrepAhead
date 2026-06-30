import type { APIRoute } from 'astro';

import { getUsageSummary } from '../../../../lib/plan';
import { MAX_ANSWER_CHARS, MIN_ANSWER_CHARS } from '../../../../lib/practice/answer-limits';
import {
  getOpenEndedProgress,
  getOpenEndedQuestions,
  isPracticeSetFullyComplete,
  parsePracticeSetWithProgress,
  PracticeSetContractError,
  scoreAbcdPractice,
  summarizeOpenEndedPractice,
  type PracticeSetContentWithProgress,
} from '../../../../lib/practice/contracts';
import { runOpenEndedCheck } from '../../../../lib/server/practice/run-open-ended-check';
import { jsonResponse } from '../../../../lib/server/response';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const prerender = false;

function mergeHeaders(target: Headers, source: Headers): void {
  source.forEach((value, key) => {
    target.set(key, value);
  });
}

type CheckRequestBody = {
  questionId?: unknown;
  answerText?: unknown;
};

function mergeCheckIntoContent(
  content: PracticeSetContentWithProgress,
  questionId: string,
  answerText: string,
  checkFeedback: string,
  checkedAt: string,
): PracticeSetContentWithProgress {
  const updatedQuestions = content.questions.map((question) => {
    if (question.type !== 'open_ended' || question.id !== questionId) {
      return question;
    }

    return {
      ...question,
      answerText,
      checkFeedback,
      checkedAt,
      savedAt: question.savedAt ?? checkedAt,
    };
  });

  const interimContent: PracticeSetContentWithProgress = {
    ...content,
    questions: updatedQuestions,
  };
  const progress = getOpenEndedProgress(interimContent);

  return { ...interimContent, openEndedCurrentIndex: progress.currentIndex };
}

export const POST: APIRoute = async ({ params, request, cookies }) => {
  const authHeaders = new Headers();
  const supabase = createSupabaseServerClient(request, cookies, authHeaders);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const responseHeaders = new Headers();
  mergeHeaders(responseHeaders, authHeaders);

  if (!user) {
    return jsonResponse(
      {
        ok: false,
        error: 'unauthorized',
        message: 'You must be signed in to check an answer.',
      },
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

  let body: CheckRequestBody;
  try {
    body = (await request.json()) as CheckRequestBody;
  } catch {
    return jsonResponse(
      { ok: false, error: 'invalid_json', message: 'Request body must be valid JSON.' },
      { status: 400, headers: responseHeaders },
    );
  }

  const questionId = typeof body.questionId === 'string' ? body.questionId.trim() : '';
  const answerText = typeof body.answerText === 'string' ? body.answerText.trim() : '';

  if (!questionId || answerText.length === 0) {
    return jsonResponse(
      {
        ok: false,
        error: 'invalid_request',
        message: 'questionId and a non-empty answerText are required.',
      },
      { status: 400, headers: responseHeaders },
    );
  }

  if (answerText.length < MIN_ANSWER_CHARS) {
    return jsonResponse(
      {
        ok: false,
        error: 'answer_too_short',
        message: `Write at least ${MIN_ANSWER_CHARS} characters before requesting Check.`,
      },
      { status: 400, headers: responseHeaders },
    );
  }

  if (answerText.length > MAX_ANSWER_CHARS) {
    return jsonResponse(
      {
        ok: false,
        error: 'answer_too_long',
        message: 'Your answer is too long. Please shorten it and try again.',
      },
      { status: 400, headers: responseHeaders },
    );
  }

  const { data: practiceSet, error: practiceSetError } = await supabase
    .from('practice_sets')
    .select('id, content, status, job_description_text, cv_text')
    .eq('id', practiceSetId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (practiceSetError || !practiceSet) {
    return jsonResponse(
      { ok: false, error: 'practice_set_not_found', message: 'Practice set not found.' },
      { status: 404, headers: responseHeaders },
    );
  }

  const { data: generationJob } = await supabase
    .from('generation_jobs')
    .select('status')
    .eq('practice_set_id', practiceSetId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (generationJob?.status !== 'succeeded' || !practiceSet.content) {
    return jsonResponse(
      {
        ok: false,
        error: 'content_not_ready',
        message: 'Practice set content is not ready for checking.',
      },
      { status: 422, headers: responseHeaders },
    );
  }

  let content: PracticeSetContentWithProgress;
  try {
    content = parsePracticeSetWithProgress(practiceSet.content);
  } catch (error) {
    if (error instanceof PracticeSetContractError) {
      return jsonResponse(
        { ok: false, error: 'invalid_content', message: 'Practice set content is invalid.' },
        { status: 422, headers: responseHeaders },
      );
    }

    throw error;
  }

  const openEndedQuestions = getOpenEndedQuestions(content);
  const targetQuestion = openEndedQuestions.find((question) => question.id === questionId);

  if (!targetQuestion) {
    const matchingQuestion = content.questions.find((question) => question.id === questionId);

    if (matchingQuestion && matchingQuestion.type !== 'open_ended') {
      return jsonResponse(
        {
          ok: false,
          error: 'not_open_ended',
          message: 'Only open-ended questions can be checked here.',
        },
        { status: 400, headers: responseHeaders },
      );
    }

    return jsonResponse(
      { ok: false, error: 'question_not_found', message: 'Question not found.' },
      { status: 404, headers: responseHeaders },
    );
  }

  if (targetQuestion.checkedAt !== undefined) {
    return jsonResponse(
      {
        ok: false,
        error: 'already_checked',
        message: 'This answer has already been checked.',
      },
      { status: 409, headers: responseHeaders },
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

  if (usageSummary.data.isAtCheckLimit) {
    return jsonResponse(
      {
        ok: false,
        error: 'check_limit_reached',
        message:
          usageSummary.data.planTier === 'FREE'
            ? 'You have used all your FREE plan Check calls for this period.'
            : 'You have reached your Check limit for this period.',
        checkRemaining: 0,
        upgradeUrl: usageSummary.data.planTier === 'FREE' ? '/api/billing/checkout-redirect' : null,
      },
      { status: 403, headers: responseHeaders },
    );
  }

  const checkResult = await runOpenEndedCheck({
    questionPrompt: targetQuestion.prompt,
    guidance: targetQuestion.guidance,
    answerText,
    jobDescription: practiceSet.job_description_text,
    cvText: practiceSet.cv_text,
  });

  if (!checkResult.ok) {
    return jsonResponse(
      { ok: false, error: checkResult.code, message: checkResult.message },
      {
        status: checkResult.code === 'configuration' ? 500 : 502,
        headers: responseHeaders,
      },
    );
  }

  const checkedAt = new Date().toISOString();

  // Re-read the current content before merging. The OpenAI call above takes
  // several seconds, during which the user may have saved a draft on another
  // question in a different tab. Merging into the original (stale) snapshot
  // would clobber that draft, so re-fetch and merge into the latest content.
  const { data: freshSet, error: freshError } = await supabase
    .from('practice_sets')
    .select('content, status')
    .eq('id', practiceSetId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (freshError || !freshSet?.content) {
    return jsonResponse(
      {
        ok: false,
        error: 'update_failed',
        message: 'Could not save your Check feedback. Please try again.',
      },
      { status: 500, headers: responseHeaders },
    );
  }

  let freshContent: PracticeSetContentWithProgress;
  try {
    freshContent = parsePracticeSetWithProgress(freshSet.content);
  } catch (error) {
    if (error instanceof PracticeSetContractError) {
      return jsonResponse(
        { ok: false, error: 'invalid_content', message: 'Practice set content is invalid.' },
        { status: 422, headers: responseHeaders },
      );
    }

    throw error;
  }

  // A concurrent Check on the same question may have landed during the AI call.
  // Bail before persisting (and before charging usage) if so.
  const freshTarget = getOpenEndedQuestions(freshContent).find(
    (question) => question.id === questionId,
  );
  if (freshTarget?.checkedAt !== undefined) {
    return jsonResponse(
      {
        ok: false,
        error: 'already_checked',
        message: 'This answer has already been checked.',
      },
      { status: 409, headers: responseHeaders },
    );
  }

  let updatedContent: PracticeSetContentWithProgress;
  try {
    updatedContent = parsePracticeSetWithProgress(
      mergeCheckIntoContent(freshContent, questionId, answerText, checkResult.feedback, checkedAt),
    );
  } catch (error) {
    if (error instanceof PracticeSetContractError) {
      return jsonResponse(
        { ok: false, error: 'invalid_content', message: 'Could not merge feedback into content.' },
        { status: 422, headers: responseHeaders },
      );
    }

    throw error;
  }

  const newStatus =
    isPracticeSetFullyComplete(updatedContent) || freshSet.status === 'completed'
      ? 'completed'
      : 'in_progress';

  const { data: updatedRows, error: updateError } = await supabase
    .from('practice_sets')
    .update({ content: updatedContent, status: newStatus })
    .eq('id', practiceSetId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .select('id');

  if (updateError || !updatedRows?.length) {
    return jsonResponse(
      {
        ok: false,
        error: 'update_failed',
        message: 'Could not save your Check feedback. Please try again.',
      },
      { status: 500, headers: responseHeaders },
    );
  }

  // Persist succeeded — only now consume a Check call. If this RPC fails, the
  // user keeps their feedback but is under-counted (accepted v1 edge case).
  const { error: incrementError } = await supabase.rpc('increment_check_usage');
  if (incrementError) {
    console.error('increment_check_usage failed after Check persisted', {
      practiceSetId,
      code: incrementError.code,
    });
  }

  const progress = getOpenEndedProgress(updatedContent);
  const checkRemaining = incrementError
    ? usageSummary.data.checkRemaining
    : Math.max(0, usageSummary.data.checkRemaining - 1);

  const responseBody: Record<string, unknown> = {
    ok: true,
    feedback: checkResult.feedback,
    checkedAt,
    checkRemaining,
    progress: {
      attemptedCount: progress.attemptedCount,
      checkedCount: progress.checkedCount,
      total: progress.total,
      currentIndex: progress.currentIndex,
      isCheckedComplete: progress.isCheckedComplete,
    },
  };

  if (isPracticeSetFullyComplete(updatedContent)) {
    responseBody.summary = {
      abcd: scoreAbcdPractice(updatedContent),
      openEnded: summarizeOpenEndedPractice(updatedContent),
    };
  }

  return jsonResponse(responseBody, { status: 200, headers: responseHeaders });
};
