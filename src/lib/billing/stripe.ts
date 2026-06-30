import Stripe from 'stripe';

import { requireEnv } from '../server/env';

/** Pinned to the API version bundled with the installed `stripe` package. */
export const STRIPE_API_VERSION = '2026-06-24.dahlia' as const;

let stripeClient: Stripe | undefined;

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(requireEnv('STRIPE_SECRET_KEY'), {
      apiVersion: STRIPE_API_VERSION,
    });
  }
  return stripeClient;
}
