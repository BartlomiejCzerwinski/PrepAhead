import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const seoQuizQuestionSchema = z
  .object({
    question: z.string(),
    options: z.array(z.string()).min(2),
    correctIndex: z.number().int().nonnegative(),
    answer: z.string(),
    explanation: z.string(),
    example: z.string().optional(),
    interviewNotes: z.string().optional(),
  })
  .refine((q) => q.correctIndex < q.options.length, {
    message: 'correctIndex must be within the options array',
    path: ['correctIndex'],
  });

/** Shared frontmatter for every blog post (open-ended and interactive-quiz). */
const basePostSchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  tags: z.array(z.string()).optional(),
  relatedSlugs: z.array(z.string()).optional(),
});

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: z.discriminatedUnion('type', [
    basePostSchema.extend({ type: z.literal('open-ended') }),
    basePostSchema.extend({
      type: z.literal('interactive-quiz'),
      quiz: z.array(seoQuizQuestionSchema).min(1),
    }),
  ]),
});

export const collections = { blog };
