import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const quizQuestionSchema = z
  .object({
    question: z.string(),
    options: z.array(z.string()).min(2),
    correctIndex: z.number().int().nonnegative(),
  })
  .refine((q) => q.correctIndex < q.options.length, {
    message: 'correctIndex must be within the options array',
    path: ['correctIndex'],
  });

const basePostSchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  tags: z.array(z.string()).optional(),
});

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: z.discriminatedUnion('type', [
    basePostSchema.extend({ type: z.literal('static-quiz') }),
    basePostSchema.extend({ type: z.literal('open-ended') }),
    basePostSchema.extend({
      type: z.literal('interactive-quiz'),
      quiz: z.array(quizQuestionSchema).min(1),
    }),
  ]),
});

export const collections = { blog };
