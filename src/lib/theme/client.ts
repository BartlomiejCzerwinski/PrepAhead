/**
 * Shared theme contract + client-side helpers.
 *
 * The canonical resolution rule lives here. The anti-FOUC inline script in
 * `Layout.astro` mirrors `resolveEffective` in dependency-free inline JS so it
 * can run synchronously before first paint; all hydrated/runtime code should
 * import from this module instead of duplicating the logic.
 */

export const THEME_VALUES = ['light', 'dark', 'system'] as const;

export type Theme = (typeof THEME_VALUES)[number];

/** Resolved (non-`system`) theme actually applied to the document. */
export type ResolvedTheme = 'light' | 'dark';

export const THEME_COOKIE = 'theme';

/** ~1 year, in seconds. */
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEME_VALUES as readonly string[]).includes(value);
}

/** Read the current theme preference from the `theme` cookie. Defaults to `system`. */
export function readThemeCookie(): Theme {
  if (typeof document === 'undefined') {
    return 'system';
  }

  const match = document.cookie.match(/(?:^|;\s*)theme=(light|dark|system)/);
  return match && isTheme(match[1]) ? match[1] : 'system';
}

/** Persist the theme preference to the `theme` cookie (client-readable, non-sensitive). */
export function writeThemeCookie(value: Theme): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${THEME_COOKIE}=${value}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
}

function prefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/** Resolve a preference (possibly `system`) into the concrete light/dark theme. */
export function resolveEffective(value: Theme): ResolvedTheme {
  if (value === 'system') {
    return prefersDark() ? 'dark' : 'light';
  }

  return value;
}

/** Apply a preference to `<html>` by setting the `.dark`/`.light` class. */
export function applyTheme(value: Theme): void {
  if (typeof document === 'undefined') {
    return;
  }

  const resolved = resolveEffective(value);
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.classList.toggle('light', resolved === 'light');
}

/**
 * Subscribe to OS color-scheme changes. Used to keep the UI live while the
 * active preference is `system`. Returns an unsubscribe function.
 */
export function watchSystem(onChange: (resolved: ResolvedTheme) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }

  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (event: MediaQueryListEvent) => {
    onChange(event.matches ? 'dark' : 'light');
  };

  query.addEventListener('change', handler);
  return () => query.removeEventListener('change', handler);
}
