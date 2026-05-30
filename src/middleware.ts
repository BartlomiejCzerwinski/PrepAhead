import { defineMiddleware } from 'astro:middleware';

import { MissingEnvError } from './lib/server/env';
import { createSupabaseServerClient } from './lib/supabase/server';

function needsSessionRefresh(pathname: string): boolean {
  return (
    pathname.startsWith('/app') ||
    pathname === '/login' ||
    pathname.startsWith('/api/auth')
  );
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  context.locals.user = null;

  if (!needsSessionRefresh(pathname)) {
    return next();
  }

  // Middleware receives response.headers at request time (not during static prerender).
  const middlewareContext = context as typeof context & {
    response?: { headers: Headers };
  };
  const responseHeaders =
    middlewareContext.response?.headers instanceof Headers
      ? middlewareContext.response.headers
      : undefined;

  try {
    const supabase = createSupabaseServerClient(
      context.request,
      context.cookies,
      responseHeaders,
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    context.locals.user = user ?? null;

    if (pathname.startsWith('/app') && !user) {
      const returnPath = pathname + context.url.search;
      return context.redirect(`/login?next=${encodeURIComponent(returnPath)}`);
    }

    if (pathname === '/login' && user) {
      return context.redirect('/app');
    }
  } catch (err) {
    if (err instanceof MissingEnvError && pathname.startsWith('/app')) {
      return context.redirect('/login?error=configuration');
    }
  }

  return next();
});
