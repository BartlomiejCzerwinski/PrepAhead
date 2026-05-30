import type { APIRoute } from 'astro';

import { OAUTH_NEXT_COOKIE, safeAuthRedirectPath } from '../../../lib/server/auth-redirect';
import { MissingEnvError, requireEnv } from '../../../lib/server/env';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const prerender = false;

function redirectToLogin(error: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: `/login?error=${encodeURIComponent(error)}` },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const headers = new Headers();

  try {
    const supabase = createSupabaseServerClient(request, cookies, headers);
    const formData = await request.formData();
    const nextRaw = formData.get('next');
    if (typeof nextRaw === 'string' && nextRaw.length > 0) {
      const nextPath = safeAuthRedirectPath(nextRaw);
      cookies.set(OAUTH_NEXT_COOKIE, nextPath, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 10,
        secure: import.meta.env.PROD,
      });
    }


    const siteUrl = requireEnv('PUBLIC_SITE_URL');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${siteUrl}/api/auth/callback`,
      },
    });

    if (error || !data.url) {
      return redirectToLogin('sign_in_failed');
    }

    headers.set('Location', data.url);
    return new Response(null, { status: 303, headers });
  } catch (err) {
    if (err instanceof MissingEnvError) {
      return redirectToLogin('configuration');
    }
    return redirectToLogin('sign_in_failed');
  }
};
