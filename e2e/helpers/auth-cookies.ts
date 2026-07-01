import type { Session } from '@supabase/supabase-js';
import type { Cookie } from '@playwright/test';
import { createChunks } from '@supabase/ssr/dist/module/utils/chunker.js';
import { stringToBase64URL } from '@supabase/ssr/dist/module/utils/base64url.js';

const BASE64_PREFIX = 'base64-';

function getStorageKey(supabaseUrl: string): string {
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  return `sb-${projectRef}-auth-token`;
}

const DEFAULT_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

export function sessionToPlaywrightCookies(
  session: Session,
  supabaseUrl: string,
  domain = 'localhost',
): Cookie[] {
  const key = getStorageKey(supabaseUrl);
  const serialized = JSON.stringify(session);
  const encoded = `${BASE64_PREFIX}${stringToBase64URL(serialized)}`;
  const chunks = createChunks(key, encoded);

  const expires =
    session.expires_at ?? Math.floor(Date.now() / 1000) + DEFAULT_MAX_AGE_SECONDS;

  return chunks.map(({ name, value }) => ({
    name,
    value,
    domain,
    path: '/',
    httpOnly: false,
    secure: false,
    sameSite: 'Lax' as const,
    expires,
  }));
}
