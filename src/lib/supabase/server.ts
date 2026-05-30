import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';

import { requireEnv } from '../server/env';

/** Sink for cache-control headers emitted by @supabase/ssr on token refresh. */
export type ResponseHeaderSink = Headers;

export function createSupabaseServerClient(
  request: Request,
  cookies: AstroCookies,
  responseHeaders?: ResponseHeaderSink,
): SupabaseClient {
  const cookieHeader = request.headers.get('Cookie') ?? '';

  return createServerClient(
    requireEnv('PUBLIC_SUPABASE_URL'),
    requireEnv('PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return parseCookieHeader(cookieHeader).map(({ name, value }) => ({
            name,
            value: value ?? '',
          }));
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookies.set(name, value, options);
          });
          if (responseHeaders) {
            for (const [key, value] of Object.entries(headers)) {
              responseHeaders.set(key, value);
            }
          }
        },
      },
    },
  );
}
