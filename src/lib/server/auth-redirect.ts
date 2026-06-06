import { requireEnv } from './env';

const DEFAULT_AUTH_REDIRECT = '/app';

/**
 * Origin used in OAuth redirectTo. In dev, prefer the request origin so port
 * matches the server you are actually using (e.g. preview on 4322).
 */
export function getOAuthSiteUrl(request: Request): string {
  const configured = requireEnv('PUBLIC_SITE_URL').replace(/\/$/, '');

  if (import.meta.env.DEV) {
    try {
      const origin = new URL(request.url).origin;
      if (
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        return origin;
      }
    } catch {
      /* use configured URL */
    }
  }

  return configured;
}

/**
 * Validates a post-auth redirect path. Rejects open redirects and absolute URLs.
 */
export function safeAuthRedirectPath(input: string | null | undefined): string {
  if (input == null || typeof input !== 'string') {
    return DEFAULT_AUTH_REDIRECT;
  }

  const trimmed = input.trim();
  // Reject encoded path tricks and non-path characters.
  if (
    /%/i.test(trimmed) ||
    trimmed.includes('\\') ||
    /[\u0000-\u001F\u007F]/.test(trimmed)
  ) {
    return DEFAULT_AUTH_REDIRECT;
  }
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return DEFAULT_AUTH_REDIRECT;
  }

  if (trimmed.includes('://')) {
    return DEFAULT_AUTH_REDIRECT;
  }

  return trimmed;
}

export const OAUTH_NEXT_COOKIE = 'oauth_next';
