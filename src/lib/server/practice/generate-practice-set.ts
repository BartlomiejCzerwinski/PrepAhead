import { MissingEnvError, requireEnv } from '../env';
import {
  derivePracticeSetTitle,
  normalizePracticeSetContent,
  PracticeSetContractError,
  type PracticeSetContent,
} from '../../practice/contracts';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4.1-mini';
const OPENAI_REQUEST_TIMEOUT_MS = 45_000;

type GeneratePracticeSetParams = {
  jobDescription: string;
  resumeText?: string | null;
  simulateMalformed?: boolean;
};

type GeneratePracticeSetSuccess = {
  ok: true;
  title: string;
  content: PracticeSetContent;
};

type GeneratePracticeSetFailureCode =
  | 'configuration'
  | 'provider_error'
  | 'provider_timeout'
  | 'malformed_output';

type GeneratePracticeSetFailure = {
  ok: false;
  code: GeneratePracticeSetFailureCode;
  message: string;
};

export type GeneratePracticeSetResult =
  | GeneratePracticeSetSuccess
  | GeneratePracticeSetFailure;

function buildMessages(params: { jobDescription: string; resumeText?: string | null }) {
  const inputContext = params.resumeText?.trim()
    ? `Job description:\n${params.jobDescription.trim()}\n\nResume text:\n${params.resumeText.trim()}`
    : `Job description:\n${params.jobDescription.trim()}\n\nNo resume text was provided. Stay grounded in the job description only and do not invent candidate history.`;

  return [
    {
      role: 'system',
      content:
        'You generate interview practice sets for software engineering candidates. Return JSON only. Produce exactly 20 questions: 15 abcd and 5 open_ended. For abcd questions, include exactly 4 options with ids A, B, C, and D, a correctOptionId that matches one option id, and a concise explanation. Vary correctOptionId across abcd questions — spread correct answers across A, B, C, and D; do not default every question to A. For open-ended questions, include guidance that explains what a strong answer should cover. Never mention experience or projects unless they are present in the provided inputs.',
    },
    {
      role: 'user',
      content: `${inputContext}

Return JSON with this exact top-level shape (abcd examples show varied correctOptionId — follow that pattern):
{
  "questions": [
    {
      "id": "q-1",
      "type": "abcd",
      "prompt": "...",
      "options": [
        { "id": "A", "text": "..." },
        { "id": "B", "text": "..." },
        { "id": "C", "text": "..." },
        { "id": "D", "text": "..." }
      ],
      "correctOptionId": "C",
      "explanation": "..."
    },
    {
      "id": "q-2",
      "type": "abcd",
      "prompt": "...",
      "options": [
        { "id": "A", "text": "..." },
        { "id": "B", "text": "..." },
        { "id": "C", "text": "..." },
        { "id": "D", "text": "..." }
      ],
      "correctOptionId": "B",
      "explanation": "..."
    },
    {
      "id": "q-16",
      "type": "open_ended",
      "prompt": "...",
      "guidance": "..."
    }
  ]
}`,
    },
  ];
}

function parseChatCompletionPayload(payload: unknown): unknown {
  const root = payload as Record<string, unknown>;
  const choices = Array.isArray(root.choices) ? root.choices : [];
  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  const message = firstChoice?.message as Record<string, unknown> | undefined;
  const content = message?.content;

  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new PracticeSetContractError('Provider returned an empty response.');
  }

  return JSON.parse(content);
}

export async function generatePracticeSet(
  params: GeneratePracticeSetParams,
): Promise<GeneratePracticeSetResult> {
  if (params.simulateMalformed) {
    return {
      ok: false,
      code: 'malformed_output',
      message: 'The generated practice set did not match the required exact-20 format.',
    };
  }

  let apiKey = '';

  try {
    apiKey = requireEnv('OPENAI_API_KEY');
  } catch (error) {
    if (error instanceof MissingEnvError) {
      return {
        ok: false,
        code: 'configuration',
        message: 'Generation is not configured yet. Please add the OpenAI API key.',
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
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: buildMessages(params),
      }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        ok: false,
        code: 'provider_timeout',
        message: 'Generation took too long. Please try again.',
      };
    }

    return {
      ok: false,
      code: 'provider_error',
      message: 'The generation provider could not be reached. Please try again.',
    };
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    return {
      ok: false,
      code: 'provider_error',
      message: 'The generation provider returned an error. Please try again.',
    };
  }

  try {
    const rawPayload = await response.json();
    const normalizedContent = normalizePracticeSetContent(parseChatCompletionPayload(rawPayload));

    return {
      ok: true,
      title: derivePracticeSetTitle(params.jobDescription),
      content: normalizedContent,
    };
  } catch (error) {
    if (error instanceof PracticeSetContractError || error instanceof SyntaxError) {
      return {
        ok: false,
        code: 'malformed_output',
        message: 'The generated practice set did not match the required exact-20 format.',
      };
    }

    return {
      ok: false,
      code: 'provider_error',
      message: 'The generation provider returned an unreadable response. Please try again.',
    };
  }
}
