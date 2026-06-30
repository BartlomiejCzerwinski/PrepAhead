import type { APIRoute } from 'astro';

import { OAUTH_NEXT_COOKIE, safeAuthRedirectPath } from '../../../lib/server/auth-redirect';
import { MissingEnvError } from '../../../lib/server/env';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { isTheme, THEME_COOKIE } from '../../../lib/theme/client';
import { THEME_COOKIE_OPTIONS } from '../../../lib/theme/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';

/**
 * Reconcile the account theme preference with any anonymous cookie at sign-in,
 * then seed the `theme` cookie so the next render restores the saved theme
 * (covers cross-device restore, since a new device must sign in). Best-effort:
 * never throws — a settings failure must not break the sign-in redirect.
 */
async function reconcileThemePreference(
  supabase: SupabaseClient,
  cookies: AstroCookies,
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    const { data: settings } = await supabase
      .from('user_settings')
      .select('theme')
      .eq('user_id', user.id)
      .maybeSingle();

    const accountTheme = settings?.theme;

    if (isTheme(accountTheme)) {
      cookies.set(THEME_COOKIE, accountTheme, THEME_COOKIE_OPTIONS);
      return;
    }

    const cookieTheme = cookies.get(THEME_COOKIE)?.value;
    if (isTheme(cookieTheme)) {
      await supabase
        .from('user_settings')
        .upsert({ user_id: user.id, theme: cookieTheme }, { onConflict: 'user_id' });
    }
  } catch {
    // Best-effort: theme reconciliation must never block sign-in.
  }
}

export const prerender = false;

function redirectToLogin(error: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: `/login?error=${encodeURIComponent(error)}` },
  });
}

export const GET: APIRoute = async ({ request, cookies, url }) => {
  const providerError = url.searchParams.get('error');
  if (providerError) {
    return redirectToLogin('provider_denied');
  }

  const code = url.searchParams.get('code');
  if (!code) {
    return redirectToLogin('missing_code');
  }

  const headers = new Headers();

  try {
    const supabase = createSupabaseServerClient(request, cookies, headers);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return redirectToLogin('exchange_failed');
    }

    await reconcileThemePreference(supabase, cookies);

    const oauthNext = cookies.get(OAUTH_NEXT_COOKIE)?.value;
    cookies.delete(OAUTH_NEXT_COOKIE, { path: '/' });

    const nextFromQuery = url.searchParams.get('next');
    const destination = oauthNext
      ? safeAuthRedirectPath(oauthNext)
      : safeAuthRedirectPath(nextFromQuery);

    headers.set('Location', destination);
    return new Response(null, { status: 303, headers });
  } catch (err) {
    if (err instanceof MissingEnvError) {
      return redirectToLogin('configuration');
    }
    return redirectToLogin('exchange_failed');
  }
};
