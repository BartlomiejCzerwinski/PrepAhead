import type { APIRoute } from 'astro';

import { requireEnv } from '../../../lib/server/env';
import { jsonResponse } from '../../../lib/server/response';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return jsonResponse({ error: 'unauthorized' }, { status: 401 });
  }

  const paymentLink = new URL(requireEnv('STRIPE_PAYMENT_LINK_URL'));
  paymentLink.searchParams.set('client_reference_id', user.id);
  if (user.email) {
    paymentLink.searchParams.set('prefilled_email', user.email);
  }

  return new Response(null, {
    status: 302,
    headers: { Location: paymentLink.toString() },
  });
};
