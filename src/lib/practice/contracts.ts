import { z } from 'astro/zod';

const abcdOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

const abcdQuestionSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('abcd'),
    prompt: z.string().min(1),
    options: z.array(abcdOptionSchema).length(4),
    correctOptionId: z.string().min(1),
    explanation: z.string().min(1),
  })
  .refine(
    (question) => question.options.some((option) => option.id === question.correctOptionId),
    {
      message: 'correctOptionId must match one of the option ids',
      path: ['correctOptionId'],
    },
  );

const abcdQuestionWithProgressSchema = abcdQuestionSchema
  .extend({
    selectedOptionId: z.string().min(1).optional(),
    answeredAt: z.string().min(1).optional(),
  })
  .refine(
    (question) => {
      if (question.selectedOptionId === undefined) {
        return true;
      }

      return question.options.some((option) => option.id === question.selectedOptionId);
    },
    {
      message: 'selectedOptionId must match one of the option ids',
      path: ['selectedOptionId'],
    },
  );

const openEndedQuestionSchema = z.object({
  id: z.string().min(1),
  type: z.literal('open_ended'),
  prompt: z.string().min(1),
  guidance: z.string().min(1),
});

export const practiceQuestionSchema = z.discriminatedUnion('type', [
  abcdQuestionSchema,
  openEndedQuestionSchema,
]);

export const practiceQuestionWithProgressSchema = z.discriminatedUnion('type', [
  abcdQuestionWithProgressSchema,
  openEndedQuestionSchema,
]);

function validateQuestionCounts(
  content: { questions: Array<{ type: string }> },
  ctx: z.RefinementCtx,
): void {
  const abcdCount = content.questions.filter((question) => question.type === 'abcd').length;
  const openEndedCount = content.questions.filter(
    (question) => question.type === 'open_ended',
  ).length;

  if (abcdCount !== 15) {
    ctx.addIssue({
      code: 'custom',
      message: 'Practice set must contain exactly 15 abcd questions',
      path: ['questions'],
    });
  }

  if (openEndedCount !== 5) {
    ctx.addIssue({
      code: 'custom',
      message: 'Practice set must contain exactly 5 open-ended questions',
      path: ['questions'],
    });
  }
}

export const practiceSetContentSchema = z
  .object({
    version: z.literal(1),
    generatedAt: z.string().min(1),
    questions: z.array(practiceQuestionSchema).length(20),
  })
  .superRefine(validateQuestionCounts);

export const practiceSetContentWithProgressSchema = z
  .object({
    version: z.literal(1),
    generatedAt: z.string().min(1),
    currentQuestionIndex: z.number().int().min(0).max(14).optional(),
    questions: z.array(practiceQuestionWithProgressSchema).length(20),
  })
  .superRefine(validateQuestionCounts);

export type PracticeQuestion = z.infer<typeof practiceQuestionSchema>;
export type PracticeSetContent = z.infer<typeof practiceSetContentSchema>;
export type AbcdQuestion = Extract<PracticeQuestion, { type: 'abcd' }>;
export type PracticeQuestionWithProgress = z.infer<typeof practiceQuestionWithProgressSchema>;
export type AbcdQuestionWithProgress = Extract<PracticeQuestionWithProgress, { type: 'abcd' }>;
export type PracticeSetContentWithProgress = z.infer<typeof practiceSetContentWithProgressSchema>;

export class PracticeSetContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PracticeSetContractError';
  }
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
}

function normalizeAbcdOptions(rawOptions: unknown[]): Array<{ id: string; text: string }> {
  return rawOptions.map((option, optionIndex) => {
    const text =
      typeof option === 'string'
        ? option
        : typeof option === 'object' && option && 'text' in option && typeof option.text === 'string'
          ? option.text
          : '';

    const providedId =
      typeof option === 'object' && option && 'id' in option && typeof option.id === 'string'
        ? option.id
        : '';

    return {
      id: providedId || String.fromCharCode(65 + optionIndex),
      text: normalizeWhitespace(text),
    };
  });
}

function resolveCorrectOptionId(
  question: Record<string, unknown>,
  options: Array<{ id: string; text: string }>,
): string {
  const rawCorrectOptionId = question.correctOptionId;
  const rawCorrectIndex = question.correctIndex;

  let correctOptionId = typeof rawCorrectOptionId === 'string' ? rawCorrectOptionId.trim() : '';

  if (!correctOptionId && Number.isInteger(rawCorrectIndex)) {
    const candidate = options[rawCorrectIndex as number];
    correctOptionId = candidate?.id ?? '';
  }

  return correctOptionId;
}

function normalizeQuestion(rawQuestion: unknown, index: number): PracticeQuestion {
  const question = rawQuestion as Record<string, unknown>;
  const rawType = question.type;

  if (rawType === 'abcd') {
    const rawOptions = Array.isArray(question.options) ? question.options : [];
    const options = normalizeAbcdOptions(rawOptions);

    return abcdQuestionSchema.parse({
      id:
        typeof question.id === 'string' && question.id.trim().length > 0
          ? question.id.trim()
          : `q-${index + 1}`,
      type: 'abcd',
      prompt: normalizeWhitespace(String(question.prompt ?? '')),
      options,
      correctOptionId: resolveCorrectOptionId(question, options),
      explanation: normalizeWhitespace(String(question.explanation ?? '')),
    });
  }

  if (rawType !== 'open_ended') {
    throw new PracticeSetContractError(`Question ${index + 1} has an invalid type.`);
  }

  return openEndedQuestionSchema.parse({
    id:
      typeof question.id === 'string' && question.id.trim().length > 0
        ? question.id.trim()
        : `q-${index + 1}`,
    type: 'open_ended',
    prompt: normalizeWhitespace(String(question.prompt ?? '')),
    guidance: normalizeWhitespace(String(question.guidance ?? question.referenceAnswer ?? '')),
  });
}

function normalizeQuestionWithProgress(
  rawQuestion: unknown,
  index: number,
): PracticeQuestionWithProgress {
  const question = rawQuestion as Record<string, unknown>;
  const rawType = question.type;

  if (rawType === 'abcd') {
    const rawOptions = Array.isArray(question.options) ? question.options : [];
    const options = normalizeAbcdOptions(rawOptions);
    const selectedOptionId =
      typeof question.selectedOptionId === 'string' && question.selectedOptionId.trim().length > 0
        ? question.selectedOptionId.trim()
        : undefined;
    const answeredAt =
      typeof question.answeredAt === 'string' && question.answeredAt.trim().length > 0
        ? question.answeredAt.trim()
        : undefined;

    return abcdQuestionWithProgressSchema.parse({
      id:
        typeof question.id === 'string' && question.id.trim().length > 0
          ? question.id.trim()
          : `q-${index + 1}`,
      type: 'abcd',
      prompt: normalizeWhitespace(String(question.prompt ?? '')),
      options,
      correctOptionId: resolveCorrectOptionId(question, options),
      explanation: normalizeWhitespace(String(question.explanation ?? '')),
      selectedOptionId,
      answeredAt,
    });
  }

  if (rawType !== 'open_ended') {
    throw new PracticeSetContractError(`Question ${index + 1} has an invalid type.`);
  }

  return openEndedQuestionSchema.parse({
    id:
      typeof question.id === 'string' && question.id.trim().length > 0
        ? question.id.trim()
        : `q-${index + 1}`,
    type: 'open_ended',
    prompt: normalizeWhitespace(String(question.prompt ?? '')),
    guidance: normalizeWhitespace(String(question.guidance ?? question.referenceAnswer ?? '')),
  });
}

export function normalizePracticeSetContent(raw: unknown): PracticeSetContent {
  const candidate = raw as Record<string, unknown>;
  const rawQuestions = Array.isArray(candidate.questions) ? candidate.questions : [];

  const normalized = {
    version: 1 as const,
    generatedAt:
      typeof candidate.generatedAt === 'string' && candidate.generatedAt.trim().length > 0
        ? candidate.generatedAt.trim()
        : new Date().toISOString(),
    questions: rawQuestions.map((question, index) => normalizeQuestion(question, index)),
  };

  const parsed = practiceSetContentSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new PracticeSetContractError(parsed.error.issues.map((issue) => issue.message).join('; '));
  }

  return parsed.data;
}

export function parsePracticeSetWithProgress(raw: unknown): PracticeSetContentWithProgress {
  const candidate = raw as Record<string, unknown>;
  const rawQuestions = Array.isArray(candidate.questions) ? candidate.questions : [];
  const rawCurrentQuestionIndex = candidate.currentQuestionIndex;

  const normalized = {
    version: 1 as const,
    generatedAt:
      typeof candidate.generatedAt === 'string' && candidate.generatedAt.trim().length > 0
        ? candidate.generatedAt.trim()
        : new Date().toISOString(),
    currentQuestionIndex:
      typeof rawCurrentQuestionIndex === 'number' &&
      Number.isInteger(rawCurrentQuestionIndex) &&
      rawCurrentQuestionIndex >= 0 &&
      rawCurrentQuestionIndex <= 14
        ? rawCurrentQuestionIndex
        : undefined,
    questions: rawQuestions.map((question, index) => normalizeQuestionWithProgress(question, index)),
  };

  const parsed = practiceSetContentWithProgressSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new PracticeSetContractError(parsed.error.issues.map((issue) => issue.message).join('; '));
  }

  return parsed.data;
}

export function summarizePracticeSet(content: PracticeSetContent): {
  abcdCount: number;
  openEndedCount: number;
} {
  return {
    abcdCount: content.questions.filter((question) => question.type === 'abcd').length,
    openEndedCount: content.questions.filter((question) => question.type === 'open_ended').length,
  };
}

export function derivePracticeSetTitle(jobDescription: string): string {
  const firstNonEmptyLine = jobDescription
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstNonEmptyLine) {
    return 'Generated practice set';
  }

  const compact = firstNonEmptyLine.replace(/\s+/g, ' ');
  const truncated = compact.length > 72 ? `${compact.slice(0, 69).trimEnd()}...` : compact;
  return `Practice set: ${truncated}`;
}

export {
  buildOpenEndedSummaryStub,
  getAbcdProgress,
  getAbcdQuestions,
  scoreAbcdPractice,
} from './score-abcd';

export type { AbcdProgress, AbcdScore, OpenEndedSummaryStub } from './score-abcd';
