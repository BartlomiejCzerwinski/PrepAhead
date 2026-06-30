import type { APIRoute } from 'astro';

import { MAX_ANSWER_CHARS } from '../../../../lib/practice/answer-limits';
import {
  getOpenEndedProgress,
  getOpenEndedQuestions,
  parsePracticeSetWithProgress,
  PracticeSetContractError,
  type PracticeSetContentWithProgress,
} from '../../../../lib/practice/contracts';
import { jsonResponse } from '../../../../lib/server/response';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const prerender = false;

function mergeHeaders(target: Headers, source: Headers): void {
  source.forEach((value, key) => {
    target.set(key, value);
  });
}

type SaveAnswerRequestBody = {
  questionId?: unknown;
  answerText?: unknown;
};

function mergeDraftIntoContent(
  content: PracticeSetContentWithProgress,
  questionId: string,
  answerText: string,
  savedAt: string,
): PracticeSetContentWithProgress {
  const updatedQuestions = content.questions.map((question) => {
    if (question.type !== 'open_ended' || question.id !== questionId) {
      return question;
    }

    return {
      ...question,
      answerText,
      savedAt,
    };
  });

  return { ...content, questions: updatedQuestions };
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
        message: 'You must be signed in to save an answer.',
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

  let body: SaveAnswerRequestBody;
  try {
    body = (await request.json()) as SaveAnswerRequestBody;
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
    .select('id, content, status')
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
        message: 'Practice set content is not ready for answering.',
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
          message: 'Only open-ended questions can be saved here.',
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
        message: 'This answer has already been checked and can no longer be edited.',
      },
      { status: 409, headers: responseHeaders },
    );
  }

  const savedAt = new Date().toISOString();

  let updatedContent: PracticeSetContentWithProgress;
  try {
    updatedContent = parsePracticeSetWithProgress(
      mergeDraftIntoContent(content, questionId, answerText, savedAt),
    );
  } catch (error) {
    if (error instanceof PracticeSetContractError) {
      return jsonResponse(
        { ok: false, error: 'invalid_content', message: 'Could not merge answer into content.' },
        { status: 422, headers: responseHeaders },
      );
    }

    throw error;
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from('practice_sets')
    .update({ content: updatedContent })
    .eq('id', practiceSetId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .select('id');

  if (updateError || !updatedRows?.length) {
    return jsonResponse(
      {
        ok: false,
        error: 'update_failed',
        message: 'Could not save your answer. Please try again.',
      },
      { status: 500, headers: responseHeaders },
    );
  }

  const progress = getOpenEndedProgress(updatedContent);

  return jsonResponse(
    {
      ok: true,
      progress: {
        attemptedCount: progress.attemptedCount,
        checkedCount: progress.checkedCount,
        total: progress.total,
        currentIndex: progress.currentIndex,
        isCheckedComplete: progress.isCheckedComplete,
      },
    },
    { status: 200, headers: responseHeaders },
  );
};
