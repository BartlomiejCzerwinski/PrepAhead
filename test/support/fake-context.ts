import type { APIContext } from 'astro';

/**
 * Builds the minimal Astro `APIContext` an `APIRoute` handler reads
 * (`{ params, request, cookies }`), so tests can invoke `POST`/`GET` directly
 * without spinning a server.
 */

type MakeApiContextOptions = {
  params?: Record<string, string | undefined>;
  body?: unknown;
  cookies?: string;
  url?: string;
  method?: string;
};

/** No-op cookie jar sufficient for `@supabase/ssr`'s `setAll`. */
function makeCookieJar() {
  return {
    get: () => undefined,
    has: () => false,
    set: () => {},
    delete: () => {},
    merge: () => {},
    headers: () => [] as string[],
  };
}

export function makeApiContext(options: MakeApiContextOptions = {}): APIContext {
  const { params = {}, body, cookies, url = 'http://localhost:4321/api', method } =
    options;

  const hasBody = body !== undefined;
  const resolvedMethod = method ?? (hasBody ? 'POST' : 'GET');

  const headers = new Headers();
  if (hasBody) {
    headers.set('Content-Type', 'application/json');
  }
  if (cookies) {
    headers.set('Cookie', cookies);
  }

  const request = new Request(url, {
    method: resolvedMethod,
    headers,
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  });

  return {
    params,
    request,
    cookies: makeCookieJar(),
  } as unknown as APIContext;
}
