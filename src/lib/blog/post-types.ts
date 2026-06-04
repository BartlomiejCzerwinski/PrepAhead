export const BLOG_POST_TYPE_LABELS = {
  'open-ended': 'Open-ended',
  'interactive-quiz': 'Interactive quiz',
} as const;

export type BlogPostType = keyof typeof BLOG_POST_TYPE_LABELS;
