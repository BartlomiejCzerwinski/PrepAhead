import type { CollectionEntry } from 'astro:content';

export function resolveRelatedPosts(
  current: CollectionEntry<'blog'>,
  allPosts: CollectionEntry<'blog'>[],
  limit = 6,
): CollectionEntry<'blog'>[] {
  const explicit =
    'relatedSlugs' in current.data && current.data.relatedSlugs
      ? current.data.relatedSlugs
      : [];
  const bySlug = explicit
    .map((slug: string) => allPosts.find((post) => post.id === slug))
    .filter(
      (post): post is CollectionEntry<'blog'> =>
        post !== undefined && post.id !== current.id,
    );

  if (bySlug.length > 0) {
    return bySlug.slice(0, limit);
  }

  const currentTags = new Set(current.data.tags ?? []);
  if (currentTags.size === 0) {
    return allPosts.filter((post) => post.id !== current.id).slice(0, limit);
  }

  return allPosts
    .filter((post) => {
      if (post.id === current.id) return false;
      const tags = post.data.tags ?? [];
      return tags.some((tag) => currentTags.has(tag));
    })
    .slice(0, limit);
}
