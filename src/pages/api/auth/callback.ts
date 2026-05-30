import type { APIRoute } from 'astro';

import { OAUTH_NEXT_COOKIE, safeAuthRedirectPath } from '../../../lib/server/auth-redirect';
import { MissingEnvError } from '../../../lib/server/env';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

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
