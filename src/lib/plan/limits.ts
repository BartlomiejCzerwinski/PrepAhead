export type PlanTier = 'FREE' | 'PRO';

export type FreePlanLimits = {
  tier: 'FREE';
  generationLimit: 1;
  checkLimit: 5;
};

export type ProPlanLimits = {
  tier: 'PRO';
  generationHardCap: 300;
  generationSoftThreshold: 100;
  checkLimit: 500;
};

export type PlanLimits = FreePlanLimits | ProPlanLimits;

export function getPlanLimits(tier: PlanTier): PlanLimits {
  if (tier === 'PRO') {
    return {
      tier: 'PRO',
      generationHardCap: 300,
      generationSoftThreshold: 100,
      checkLimit: 500,
    };
  }

  return {
    tier: 'FREE',
    generationLimit: 1,
    checkLimit: 5,
  };
}
