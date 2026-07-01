import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';

import { getStripeClient } from './stripe';
import {
  resolvePlanTierFromSubscription,
  validateCheckoutBinding,
} from './sync-subscription';

const HANDLED_EVENT_TYPES = new Set([
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
  'invoice.paid',
]);

type ProfileBillingRow = {
  id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_grace_ends_at: string | null;
};

export function isHandledStripeEventType(type: string): boolean {
  return HANDLED_EVENT_TYPES.has(type);
}

function stripeId(
  value: string | { id: string } | null | undefined,
): string | null {
  if (!value) {
    return null;
  }
  return typeof value === 'string' ? value : value.id;
}

function parseGraceEndsAt(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const subscription = invoice.parent?.subscription_details?.subscription;
  return stripeId(subscription ?? null);
}

function graceEndsAtIso(daysFromNow: number, from: Date = new Date()): string {
  const end = new Date(from);
  end.setUTCDate(end.getUTCDate() + daysFromNow);
  return end.toISOString();
}

function logBillingWebhookError(
  eventId: string,
  eventType: string,
  error: unknown,
): void {
  if (error && typeof error === 'object') {
    const record = error as {
      code?: string;
      message?: string;
      details?: string;
      hint?: string;
    };
    console.error('stripe webhook processing failed', {
      eventId,
      type: eventType,
      code: record.code,
      message: record.message,
      details: record.details,
      hint: record.hint,
    });
    return;
  }

  console.error('stripe webhook processing failed', {
    eventId,
    type: eventType,
    error,
  });
}

async function callSetPlanTier(
  admin: SupabaseClient,
  params: {
    userId: string;
    planTier: 'FREE' | 'PRO';
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    graceEndsAt: string | null;
  },
): Promise<void> {
  const { error } = await admin.rpc('set_plan_tier_from_billing', {
    p_user_id: params.userId,
    p_plan_tier: params.planTier,
    p_stripe_customer_id: params.stripeCustomerId,
    p_stripe_subscription_id: params.stripeSubscriptionId,
    p_grace_ends_at: params.graceEndsAt,
  });

  if (error) {
    logBillingWebhookError(params.userId, 'set_plan_tier_from_billing', error);
    throw error;
  }
}

async function getProfileByCustomerId(
  admin: SupabaseClient,
  customerId: string,
): Promise<ProfileBillingRow | null> {
  const { data, error } = await admin
    .from('profiles')
    .select(
      'id, stripe_customer_id, stripe_subscription_id, subscription_grace_ends_at',
    )
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function getProfileBySubscriptionId(
  admin: SupabaseClient,
  subscriptionId: string,
): Promise<ProfileBillingRow | null> {
  const { data, error } = await admin
    .from('profiles')
    .select(
      'id, stripe_customer_id, stripe_subscription_id, subscription_grace_ends_at',
    )
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function syncSubscriptionTier(
  admin: SupabaseClient,
  subscription: Stripe.Subscription,
  profile: ProfileBillingRow,
  graceEndsAtOverride?: string | null,
): Promise<void> {
  const graceEndsAt =
    graceEndsAtOverride !== undefined
      ? parseGraceEndsAt(graceEndsAtOverride)
      : parseGraceEndsAt(profile.subscription_grace_ends_at);

  const planTier = resolvePlanTierFromSubscription(
    {
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    graceEndsAt,
  );

  const graceEndsAtValue =
    graceEndsAtOverride !== undefined
      ? graceEndsAtOverride
      : profile.subscription_grace_ends_at;

  await callSetPlanTier(admin, {
    userId: profile.id,
    planTier,
    stripeCustomerId:
      stripeId(subscription.customer) ?? profile.stripe_customer_id,
    stripeSubscriptionId: planTier === 'PRO' ? subscription.id : null,
    graceEndsAt: graceEndsAtValue,
  });
}

async function handleCheckoutCompleted(
  admin: SupabaseClient,
  session: Stripe.Checkout.Session,
  eventId: string,
): Promise<void> {
  const userId = session.client_reference_id;
  const sessionEmail =
    session.customer_details?.email ?? session.customer_email ?? null;

  if (!userId) {
    console.warn('stripe webhook: missing client_reference_id', { eventId });
    return;
  }

  const { data: authData, error: authError } =
    await admin.auth.admin.getUserById(userId);

  if (authError || !authData.user) {
    console.warn('stripe webhook: auth user not found', { eventId });
    return;
  }

  if (
    !validateCheckoutBinding(userId, sessionEmail, authData.user.email ?? null)
  ) {
    console.warn('stripe webhook: checkout binding rejected', { eventId });
    return;
  }

  const stripe = getStripeClient();
  let stripeCustomerId = stripeId(session.customer);
  let stripeSubscriptionId = stripeId(session.subscription);

  if ((!stripeCustomerId || !stripeSubscriptionId) && session.id) {
    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['customer', 'subscription'],
    });
    stripeCustomerId = stripeCustomerId ?? stripeId(fullSession.customer);
    stripeSubscriptionId =
      stripeSubscriptionId ?? stripeId(fullSession.subscription);
  }

  if (!stripeSubscriptionId) {
    console.warn('stripe webhook: missing subscription on checkout', { eventId });
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const planTier = resolvePlanTierFromSubscription(
    {
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    null,
  );

  await callSetPlanTier(admin, {
    userId,
    planTier,
    stripeCustomerId,
    stripeSubscriptionId: planTier === 'PRO' ? stripeSubscriptionId : null,
    graceEndsAt: null,
  });
}

async function handleSubscriptionUpdated(
  admin: SupabaseClient,
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId = stripeId(subscription.customer);
  const profile =
    (await getProfileBySubscriptionId(admin, subscription.id)) ??
    (customerId ? await getProfileByCustomerId(admin, customerId) : null);

  if (!profile) {
    return;
  }

  await syncSubscriptionTier(admin, subscription, profile);
}

async function handleSubscriptionDeleted(
  admin: SupabaseClient,
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId = stripeId(subscription.customer);
  const profile =
    (await getProfileBySubscriptionId(admin, subscription.id)) ??
    (customerId ? await getProfileByCustomerId(admin, customerId) : null);

  if (!profile) {
    return;
  }

  await callSetPlanTier(admin, {
    userId: profile.id,
    planTier: 'FREE',
    stripeCustomerId: customerId ?? profile.stripe_customer_id,
    stripeSubscriptionId: null,
    graceEndsAt: null,
  });
}

async function handleInvoicePaymentFailed(
  admin: SupabaseClient,
  invoice: Stripe.Invoice,
): Promise<void> {
  const customerId = stripeId(invoice.customer);
  if (!customerId) {
    return;
  }

  const profile = await getProfileByCustomerId(admin, customerId);
  if (!profile) {
    return;
  }

  await callSetPlanTier(admin, {
    userId: profile.id,
    planTier: 'PRO',
    stripeCustomerId: profile.stripe_customer_id ?? customerId,
    stripeSubscriptionId: profile.stripe_subscription_id,
    graceEndsAt: graceEndsAtIso(3),
  });
}

async function handleInvoicePaid(
  admin: SupabaseClient,
  invoice: Stripe.Invoice,
): Promise<void> {
  const customerId = stripeId(invoice.customer);
  if (!customerId) {
    return;
  }

  const profile = await getProfileByCustomerId(admin, customerId);
  if (!profile) {
    return;
  }

  const subscriptionId =
    invoiceSubscriptionId(invoice) ?? profile.stripe_subscription_id;

  if (!subscriptionId) {
    return;
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const planTier = resolvePlanTierFromSubscription(
    {
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    parseGraceEndsAt(profile.subscription_grace_ends_at),
  );

  await callSetPlanTier(admin, {
    userId: profile.id,
    planTier,
    stripeCustomerId: profile.stripe_customer_id ?? customerId,
    stripeSubscriptionId: planTier === 'PRO' ? subscriptionId : null,
    graceEndsAt: null,
  });
}

/** Insert-first claim so concurrent deliveries cannot double-process the same event. */
export async function claimStripeEvent(
  admin: SupabaseClient,
  event: Stripe.Event,
): Promise<'claimed' | 'duplicate'> {
  const { error } = await admin.from('stripe_webhook_events').insert({
    event_id: event.id,
    event_type: event.type,
  });

  if (error) {
    if (error.code === '23505') {
      return 'duplicate';
    }
    throw error;
  }

  return 'claimed';
}

/** Release claim after a processing failure so Stripe retries can re-run handlers. */
export async function releaseStripeEventClaim(
  admin: SupabaseClient,
  eventId: string,
): Promise<void> {
  const { error } = await admin
    .from('stripe_webhook_events')
    .delete()
    .eq('event_id', eventId);

  if (error) {
    throw error;
  }
}

export async function processStripeWebhookEvent(
  admin: SupabaseClient,
  event: Stripe.Event,
): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(
        admin,
        event.data.object as Stripe.Checkout.Session,
        event.id,
      );
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(
        admin,
        event.data.object as Stripe.Subscription,
      );
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(
        admin,
        event.data.object as Stripe.Subscription,
      );
      break;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(
        admin,
        event.data.object as Stripe.Invoice,
      );
      break;
    case 'invoice.paid':
      await handleInvoicePaid(admin, event.data.object as Stripe.Invoice);
      break;
    default:
      break;
  }
}
