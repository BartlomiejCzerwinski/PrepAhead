export type SubscriptionSnapshot = {
  status: string;
  cancel_at_period_end?: boolean;
  current_period_end?: number;
};

export function resolvePlanTierFromSubscription(
  subscription: SubscriptionSnapshot,
  graceEndsAt: Date | null,
  now: Date = new Date(),
): 'FREE' | 'PRO' {
  const status = subscription.status;

  if (
    graceEndsAt !== null &&
    graceEndsAt.getTime() <= now.getTime() &&
    (status === 'past_due' || status === 'unpaid')
  ) {
    return 'FREE';
  }

  if (status === 'active' || status === 'trialing') {
    return 'PRO';
  }

  if (status === 'past_due' || status === 'unpaid') {
    if (graceEndsAt !== null && graceEndsAt.getTime() > now.getTime()) {
      return 'PRO';
    }
    return 'FREE';
  }

  if (status === 'canceled') {
    return 'FREE';
  }

  return 'FREE';
}

export function validateCheckoutBinding(
  userId: string | null | undefined,
  sessionEmail: string | null | undefined,
  profileEmail: string | null | undefined,
): boolean {
  if (!userId || !sessionEmail || !profileEmail) {
    return false;
  }
  return (
    sessionEmail.trim().toLowerCase() === profileEmail.trim().toLowerCase()
  );
}
