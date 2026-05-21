/**
 * Pin the pricing constants and the snapshot envelope. These values
 * drive Stripe checkout sessions + webhook reconciliation + the mobile
 * deal-alert page — silent drift = real-money bug.
 */

import { describe, it, expect } from '@jest/globals';
import {
  CREDIT_PACKAGES,
  DEAL_ALERT_PRICE,
  getPricingSnapshot,
} from '@/lib/pricing';

describe('CREDIT_PACKAGES', () => {
  it('exposes exactly the four canonical credit pack IDs', () => {
    expect(Object.keys(CREDIT_PACKAGES).sort()).toEqual(
      ['10_credits', '1_credit', '4_credits', '60_credits'].sort()
    );
  });

  it('keeps prices in cents (Stripe convention)', () => {
    expect(CREDIT_PACKAGES['1_credit'].price).toBe(300);
    expect(CREDIT_PACKAGES['4_credits'].price).toBe(500);
    expect(CREDIT_PACKAGES['10_credits'].price).toBe(1000);
    expect(CREDIT_PACKAGES['60_credits'].price).toBe(3000);
  });

  it('flags monthly packs as recurring and one-shots as non-recurring', () => {
    expect(CREDIT_PACKAGES['1_credit'].recurring).toBe(false);
    expect(CREDIT_PACKAGES['4_credits'].recurring).toBe(true);
    expect(CREDIT_PACKAGES['10_credits'].recurring).toBe(true);
    expect(CREDIT_PACKAGES['60_credits'].recurring).toBe(false);
  });

  it('matches credits count to the pack ID semantics', () => {
    expect(CREDIT_PACKAGES['1_credit'].credits).toBe(1);
    expect(CREDIT_PACKAGES['4_credits'].credits).toBe(4);
    expect(CREDIT_PACKAGES['10_credits'].credits).toBe(10);
    expect(CREDIT_PACKAGES['60_credits'].credits).toBe(60);
  });
});

describe('DEAL_ALERT_PRICE', () => {
  it('charges 500 cents per month in USD', () => {
    expect(DEAL_ALERT_PRICE.amount).toBe(500);
    expect(DEAL_ALERT_PRICE.currency).toBe('usd');
    expect(DEAL_ALERT_PRICE.interval).toBe('month');
  });

  it('carries the customer-facing product name + description', () => {
    expect(DEAL_ALERT_PRICE.name).toBe('Investor Deal Alerts');
    expect(DEAL_ALERT_PRICE.description).toContain('ARV threshold');
  });
});

describe('getPricingSnapshot()', () => {
  it('returns both shapes under the wire envelope', () => {
    const snap = getPricingSnapshot();
    expect(snap.creditPackages).toBe(CREDIT_PACKAGES);
    expect(snap.dealAlert).toBe(DEAL_ALERT_PRICE);
  });
});
