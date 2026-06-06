import { defineMiddleware } from 'astro:middleware';

import { MissingEnvError } from './lib/server/env';
import { safeAuthRedirectPath } from './lib/server/auth-redirect';
import { createSupabaseServerClient } from './lib/supabase/server';

function needsSessionRefresh(pathname: string): boolean {
  return (
    pathname.startsWith('/app') ||
    pathname === '/login' ||
    pathname.startsWith('/api/auth')
  );
}

function mergeHeaders(target: Headers, source: Headers): void {
  source.forEach((value, key) => {
    target.set(key, value);
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  context.locals.user = null;

  if (!needsSessionRefresh(pathname)) {
    return next();
  }

  const authResponseHeaders = new Headers();

  try {
    const supabase = createSupabaseServerClient(
      context.request,
      context.cookies,
      authResponseHeaders,
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    context.locals.user = user ?? null;

    if (pathname.startsWith('/app') && !user) {
      const returnPath = safeAuthRedirectPath(pathname + context.url.search);
      const redirect = context.redirect(
        `/login?next=${encodeURIComponent(returnPath)}`,
      );
      mergeHeaders(redirect.headers, authResponseHeaders);
      return redirect;
    }

    if (pathname === '/login' && user) {
      const redirect = context.redirect('/app');
      mergeHeaders(redirect.headers, authResponseHeaders);
      return redirect;
    }
  } catch (err) {
    if (err instanceof MissingEnvError && pathname.startsWith('/app')) {
      const redirect = context.redirect('/login?error=configuration');
      mergeHeaders(redirect.headers, authResponseHeaders);
      return redirect;
    }

    if (pathname.startsWith('/app')) {
      const redirect = context.redirect('/login?error=session');
      mergeHeaders(redirect.headers, authResponseHeaders);
      return redirect;
    }
  }

  const response = await next();
  mergeHeaders(response.headers, authResponseHeaders);
  return response;
});
