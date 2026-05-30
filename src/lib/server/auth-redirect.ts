const DEFAULT_AUTH_REDIRECT = '/app';

/**
 * Validates a post-auth redirect path. Rejects open redirects and absolute URLs.
 */
export function safeAuthRedirectPath(input: string | null | undefined): string {
  if (input == null || typeof input !== 'string') {
    return DEFAULT_AUTH_REDIRECT;
  }

  const trimmed = input.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return DEFAULT_AUTH_REDIRECT;
  }

  if (trimmed.includes('://')) {
    return DEFAULT_AUTH_REDIRECT;
  }

  return trimmed;
}

export const OAUTH_NEXT_COOKIE = 'oauth_next';
