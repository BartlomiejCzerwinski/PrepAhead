import type { APIRoute } from 'astro';
import type Stripe from 'stripe';

import {
  isHandledStripeEventType,
  isStripeEventProcessed,
  markStripeEventProcessed,
  processStripeWebhookEvent,
} from '../../../lib/billing/process-stripe-webhook';
import { getStripeClient } from '../../../lib/billing/stripe';
import { requireEnv } from '../../../lib/server/env';
import { jsonResponse } from '../../../lib/server/response';
import { createSupabaseAdminClient } from '../../../lib/supabase/admin';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return jsonResponse({ error: 'Missing signature' }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = getStripeClient().webhooks.constructEvent(
      body,
      signature,
      requireEnv('STRIPE_WEBHOOK_SECRET'),
    );
  } catch {
    return jsonResponse({ error: 'Invalid signature' }, { status: 400 });
  }

  if (!isHandledStripeEventType(event.type)) {
    return jsonResponse({ received: true });
  }

  const admin = createSupabaseAdminClient();

  try {
    if (await isStripeEventProcessed(admin, event.id)) {
      return jsonResponse({ received: true });
    }

    await processStripeWebhookEvent(admin, event);

    const insertResult = await markStripeEventProcessed(admin, event);
    if (insertResult === 'duplicate') {
      return jsonResponse({ received: true });
    }

    return jsonResponse({ received: true });
  } catch (err) {
    console.error('stripe webhook processing failed', {
      eventId: event.id,
      type: event.type,
      ...(err && typeof err === 'object'
        ? {
            code: (err as { code?: string }).code,
            message: (err as { message?: string }).message,
            details: (err as { details?: string }).details,
            hint: (err as { hint?: string }).hint,
          }
        : { error: err }),
    });
    return jsonResponse({ error: 'Processing failed' }, { status: 500 });
  }
};
