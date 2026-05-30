import type { APIRoute } from 'astro';

import { MissingEnvError } from '../../../lib/server/env';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const headers = new Headers();
  headers.set('Location', '/login');

  try {
    const supabase = createSupabaseServerClient(request, cookies, headers);
    await supabase.auth.signOut();
  } catch (err) {
    if (!(err instanceof MissingEnvError)) {
      // Still redirect to login; session may already be cleared.
    }
  }

  return new Response(null, { status: 303, headers });
};
