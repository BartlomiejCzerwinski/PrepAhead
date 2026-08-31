import type { UsageSummary } from './get-usage-summary';

export type PlanBanner = {
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  tone: 'free' | 'pro' | 'blocked';
};

export type GenerationCta = {
  canGenerate: boolean;
  label: string;
  href: string;
  hint?: string;
};

export function getPlanBanner(summary: UsageSummary): PlanBanner {
  if (summary.planTier === 'FREE') {
    const atLimit = summary.isAtGenerationLimit || summary.isAtCheckLimit;
    return {
      tone: atLimit ? 'blocked' : 'free',
      title: atLimit ? 'Upgrade to keep practicing' : 'Upgrade to PRO',
      description: atLimit
        ? 'You’ve reached FREE plan limits for this period. Upgrade for generous fair-use generation and Check feedback.'
        : 'Unlock generous fair-use generation and more Check feedback on open-ended answers.',
      primaryLabel: 'Upgrade to PRO',
      primaryHref: '/api/billing/checkout-redirect',
    };
  }

  return {
    tone: 'pro',
    title: 'PrepAhead PRO',
    description: 'Manage billing or cancel anytime from the customer portal.',
    primaryLabel: 'Manage subscription',
    primaryHref: '/api/billing/portal',
  };
}

export function getGenerationCta(summary: UsageSummary): GenerationCta {
  if (!summary.isAtGenerationLimit) {
    return {
      canGenerate: true,
      label: 'Generate practice set',
      href: '/app/generate',
    };
  }

  if (summary.planTier === 'FREE') {
    return {
      canGenerate: false,
      label: 'Upgrade to generate',
      href: '/api/billing/checkout-redirect',
      hint: 'Your FREE plan generation allowance resets at the start of your next usage period.',
    };
  }

  if (summary.generationLimitReason === 'daily') {
    return {
      canGenerate: false,
      label: 'Generation paused today',
      href: '/app/generate',
      hint: 'You have hit today’s fair-use generation pace. Try again tomorrow (UTC) or wait for your next usage period.',
    };
  }

  return {
    canGenerate: false,
    label: 'Generation unavailable',
    href: '/app/generate',
    hint: 'You have reached the PRO period cap for this usage cycle. Your allowance resets at the next period boundary.',
  };
}

export function getProFairUseBlurb(summary: UsageSummary): string | null {
  if (summary.planTier !== 'PRO') {
    return null;
  }

  return 'PRO fair-use: generous generation at normal pace, with daily pacing if you generate heavily, and a clear period cap—limits are enforced automatically.';
}
