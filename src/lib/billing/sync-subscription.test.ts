import { describe, expect, it } from 'vitest';

import {
  resolvePlanTierFromSubscription,
  validateCheckoutBinding,
  type SubscriptionSnapshot,
} from './sync-subscription';

const NOW = new Date('2026-06-15T12:00:00.000Z');

function sub(overrides: Partial<SubscriptionSnapshot> = {}): SubscriptionSnapshot {
  return {
    status: 'active',
    cancel_at_period_end: false,
    current_period_end: Math.floor(new Date('2026-07-15T12:00:00.000Z').getTime() / 1000),
    ...overrides,
  };
}

describe('resolvePlanTierFromSubscription', () => {
  it('active subscription → PRO', () => {
    expect(resolvePlanTierFromSubscription(sub(), null, NOW)).toBe('PRO');
  });

  it('active with cancel_at_period_end → PRO until period end', () => {
    expect(
      resolvePlanTierFromSubscription(
        sub({ cancel_at_period_end: true }),
        null,
        NOW,
      ),
    ).toBe('PRO');
  });

  it('trialing → PRO', () => {
    expect(resolvePlanTierFromSubscription(sub({ status: 'trialing' }), null, NOW)).toBe(
      'PRO',
    );
  });

  it('past_due within grace → PRO', () => {
    const grace = new Date('2026-06-20T12:00:00.000Z');
    expect(
      resolvePlanTierFromSubscription(sub({ status: 'past_due' }), grace, NOW),
    ).toBe('PRO');
  });

  it('past_due after grace expired → FREE', () => {
    const grace = new Date('2026-06-10T12:00:00.000Z');
    expect(
      resolvePlanTierFromSubscription(sub({ status: 'past_due' }), grace, NOW),
    ).toBe('FREE');
  });

  it('unpaid after grace expired → FREE', () => {
    const grace = new Date('2026-06-10T12:00:00.000Z');
    expect(
      resolvePlanTierFromSubscription(sub({ status: 'unpaid' }), grace, NOW),
    ).toBe('FREE');
  });

  it('past_due without grace → FREE', () => {
    expect(resolvePlanTierFromSubscription(sub({ status: 'past_due' }), null, NOW)).toBe(
      'FREE',
    );
  });

  it('canceled → FREE', () => {
    expect(resolvePlanTierFromSubscription(sub({ status: 'canceled' }), null, NOW)).toBe(
      'FREE',
    );
  });
});

describe('validateCheckoutBinding', () => {
  it('matches emails case-insensitively', () => {
    expect(
      validateCheckoutBinding('user-1', 'Test@Example.com', 'test@example.com'),
    ).toBe(true);
  });

  it('rejects email mismatch', () => {
    expect(validateCheckoutBinding('user-1', 'a@example.com', 'b@example.com')).toBe(
      false,
    );
  });

  it('rejects missing user id', () => {
    expect(validateCheckoutBinding(null, 'a@example.com', 'a@example.com')).toBe(false);
  });

  it('rejects missing session email', () => {
    expect(validateCheckoutBinding('user-1', null, 'a@example.com')).toBe(false);
  });
});
