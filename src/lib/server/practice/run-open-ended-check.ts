import { MissingEnvError, requireEnv } from '../env';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4.1-mini';
const OPENAI_REQUEST_TIMEOUT_MS = 45_000;

type RunOpenEndedCheckParams = {
  questionPrompt: string;
  guidance: string;
  answerText: string;
  jobDescription: string;
  cvText?: string | null;
};

type RunOpenEndedCheckFailureCode =
  | 'configuration'
  | 'provider_error'
  | 'provider_timeout'
  | 'empty_feedback';

export type RunOpenEndedCheckResult =
  | { ok: true; feedback: string }
  | { ok: false; code: RunOpenEndedCheckFailureCode; message: string };

const SYSTEM_PROMPT =
  'You are a critical but constructive technical interview coach reviewing a candidate\'s free-text answer to an open-ended interview question. Give specific, honest feedback: what is strong, what is missing or weak, and concrete suggestions to improve. Ground every point in the question, the provided guidance, and the job description (and resume text if present). There is no single official "correct" answer — do not invent one. Never invent the candidate\'s experience, projects, or skills that are not present in their answer or the provided inputs; if the answer is thin, say so plainly. Respond in plain prose (short paragraphs or bullet-style lines), not JSON, and address the candidate directly.';

function buildMessages(params: RunOpenEndedCheckParams) {
  const inputContext = params.cvText?.trim()
    ? `Job description:\n${params.jobDescription.trim()}\n\nResume text:\n${params.cvText.trim()}`
    : `Job description:\n${params.jobDescription.trim()}\n\nNo resume text was provided. Stay grounded in the job description only and do not invent candidate history.`;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `${inputContext}

Open-ended question:
${params.questionPrompt.trim()}

What a strong answer should cover:
${params.guidance.trim()}

Candidate's answer:
${params.answerText.trim()}

Give critical feedback on the candidate's answer above.`,
    },
  ];
}

function parseChatCompletionPayload(payload: unknown): string {
  const root = payload as Record<string, unknown> | null;
  const choices = Array.isArray(root?.choices) ? root.choices : [];
  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  const message = firstChoice?.message as Record<string, unknown> | undefined;
  const content = message?.content;

  return typeof content === 'string' ? content.trim() : '';
}

export async function runOpenEndedCheck(
  params: RunOpenEndedCheckParams,
): Promise<RunOpenEndedCheckResult> {
  let apiKey = '';

  try {
    apiKey = requireEnv('OPENAI_API_KEY');
  } catch (error) {
    if (error instanceof MissingEnvError) {
      return {
        ok: false,
        code: 'configuration',
        message: 'Check is not configured yet. Please add the OpenAI API key.',
      };
    }

    throw error;
  }

  let response: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_REQUEST_TIMEOUT_MS);

  try {
    response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.4,
        messages: buildMessages(params),
      }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        ok: false,
        code: 'provider_timeout',
        message: 'Check took too long. Please try again.',
      };
    }

    return {
      ok: false,
      code: 'provider_error',
      message: 'The Check provider could not be reached. Please try again.',
    };
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    return {
      ok: false,
      code: 'provider_error',
      message: 'The Check provider returned an error. Please try again.',
    };
  }

  let feedback = '';
  try {
    feedback = parseChatCompletionPayload(await response.json());
  } catch {
    return {
      ok: false,
      code: 'provider_error',
      message: 'The Check provider returned an unreadable response. Please try again.',
    };
  }

  if (feedback.length === 0) {
    return {
      ok: false,
      code: 'empty_feedback',
      message: 'Check did not return any feedback. Please try again.',
    };
  }

  return { ok: true, feedback };
}
