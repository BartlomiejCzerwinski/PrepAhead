import { defineMiddleware } from 'astro:middleware';

import { MissingEnvError } from './lib/server/env';
import { safeAuthRedirectPath } from './lib/server/auth-redirect';
import { createSupabaseServerClient } from './lib/supabase/server';
import { isTheme, THEME_COOKIE } from './lib/theme/client';

const THEME_COOKIE_OPTIONS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
} as const;

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

    // Cross-device restore: when a signed-in user hits the app without a theme
    // cookie (e.g. cleared, or a fresh device), seed it from their saved
    // preference. Gated on the cookie being absent so steady-state requests
    // add no extra query.
    if (pathname.startsWith('/app') && user && !context.cookies.get(THEME_COOKIE)) {
      const { data: settings } = await supabase
        .from('user_settings')
        .select('theme')
        .eq('user_id', user.id)
        .maybeSingle();

      if (isTheme(settings?.theme)) {
        context.cookies.set(THEME_COOKIE, settings.theme, THEME_COOKIE_OPTIONS);
      }
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
