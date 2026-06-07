import type { APIRoute } from 'astro';

import {
  buildOpenEndedSummaryStub,
  getAbcdProgress,
  getAbcdQuestions,
  parsePracticeSetWithProgress,
  PracticeSetContractError,
  scoreAbcdPractice,
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

type AnswerRequestBody = {
  questionId?: unknown;
  selectedOptionId?: unknown;
};

function mergeAnswerIntoContent(
  content: PracticeSetContentWithProgress,
  questionId: string,
  selectedOptionId: string,
  answeredAt: string,
): PracticeSetContentWithProgress {
  const updatedQuestions = content.questions.map((question) => {
    if (question.type !== 'abcd' || question.id !== questionId) {
      return question;
    }

    return {
      ...question,
      selectedOptionId,
      answeredAt,
    };
  });

  const interimContent: PracticeSetContentWithProgress = {
    ...content,
    questions: updatedQuestions,
  };
  const progress = getAbcdProgress(interimContent);

  return {
    ...interimContent,
    currentQuestionIndex: progress.currentIndex,
  };
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
        message: 'You must be signed in to submit an answer.',
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

  let body: AnswerRequestBody;
  try {
    body = (await request.json()) as AnswerRequestBody;
  } catch {
    return jsonResponse(
      { ok: false, error: 'invalid_json', message: 'Request body must be valid JSON.' },
      { status: 400, headers: responseHeaders },
    );
  }

  const questionId = typeof body.questionId === 'string' ? body.questionId.trim() : '';
  const selectedOptionId =
    typeof body.selectedOptionId === 'string' ? body.selectedOptionId.trim() : '';

  if (!questionId || !selectedOptionId) {
    return jsonResponse(
      {
        ok: false,
        error: 'invalid_request',
        message: 'questionId and selectedOptionId are required.',
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

  const abcdQuestions = getAbcdQuestions(content);
  const targetQuestion = abcdQuestions.find((question) => question.id === questionId);

  if (!targetQuestion) {
    const matchingQuestion = content.questions.find((question) => question.id === questionId);

    if (matchingQuestion?.type === 'open_ended') {
      return jsonResponse(
        {
          ok: false,
          error: 'not_abcd',
          message: 'Only multiple-choice questions can be answered here.',
        },
        { status: 400, headers: responseHeaders },
      );
    }

    return jsonResponse(
      { ok: false, error: 'question_not_found', message: 'Question not found.' },
      { status: 404, headers: responseHeaders },
    );
  }

  if (targetQuestion.selectedOptionId !== undefined) {
    return jsonResponse(
      {
        ok: false,
        error: 'already_answered',
        message: 'This question has already been answered.',
      },
      { status: 409, headers: responseHeaders },
    );
  }

  if (!targetQuestion.options.some((option) => option.id === selectedOptionId)) {
    return jsonResponse(
      {
        ok: false,
        error: 'invalid_option',
        message: 'Selected option is not valid for this question.',
      },
      { status: 400, headers: responseHeaders },
    );
  }

  const isCorrect = selectedOptionId === targetQuestion.correctOptionId;
  const answeredAt = new Date().toISOString();

  let updatedContent: PracticeSetContentWithProgress;
  try {
    updatedContent = parsePracticeSetWithProgress(
      mergeAnswerIntoContent(content, questionId, selectedOptionId, answeredAt),
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

  const progress = getAbcdProgress(updatedContent);
  const newStatus = progress.isComplete ? 'completed' : 'in_progress';

  const { data: updatedRows, error: updateError } = await supabase
    .from('practice_sets')
    .update({
      content: updatedContent,
      status: newStatus,
    })
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

  const responseBody: Record<string, unknown> = {
    ok: true,
    isCorrect,
    explanation: targetQuestion.explanation,
    correctOptionId: targetQuestion.correctOptionId,
    progress: {
      answeredCount: progress.answeredCount,
      total: progress.total,
      currentQuestionIndex: progress.currentIndex,
      isComplete: progress.isComplete,
    },
  };

  if (progress.isComplete) {
    responseBody.summary = {
      abcd: scoreAbcdPractice(updatedContent),
      openEnded: buildOpenEndedSummaryStub(),
    };
  }

  return jsonResponse(responseBody, { status: 200, headers: responseHeaders });
};
