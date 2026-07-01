import type { APIRoute } from 'astro';

import { getStripeClient } from '../../../lib/billing/stripe';
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

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile?.stripe_customer_id) {
    return jsonResponse(
      {
        error: 'billing_not_available',
        message:
          'Subscription management is not available yet. Complete checkout first or contact support.',
      },
      { status: 404 },
    );
  }

  const session = await getStripeClient().billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${requireEnv('PUBLIC_SITE_URL').replace(/\/$/, '')}/app`,
  });

  return new Response(null, {
    status: 302,
    headers: { Location: session.url },
  });
};
