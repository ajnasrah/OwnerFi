/**
 * Single source of truth for OwnerFi pricing — realtor credit packs +
 * the buyer deal-alert subscription. Previously triplicated across
 * `/api/stripe/checkout`, `/api/stripe/simple-checkout`, and
 * `/api/stripe/webhook`, with the deal-alert price hard-coded inline in
 * `/api/buyer/deal-alert-checkout`. Drift between sites was a real risk
 * (each could be edited without the others); this module is the only
 * place these values should live.
 *
 * All amounts are in **cents**, matching Stripe's `unit_amount` convention.
 */

/** A purchasable bundle of realtor lead credits (one-time or monthly). */
export interface CreditPackage {
  /** Number of lead credits the realtor receives. */
  credits: number;
  /** Price in USD cents. */
  price: number;
  /** Customer-facing pack name (shows up on Stripe Checkout). */
  name: string;
  /** `true` = monthly subscription; `false` = one-time purchase. */
  recurring: boolean;
}

/**
 * Canonical realtor credit packs. Keys are the IDs the Stripe checkout
 * + webhook routes branch on — do not rename without coordinating with
 * any in-flight Stripe customer subscriptions referencing them.
 */
export const CREDIT_PACKAGES: Record<string, CreditPackage> = {
  '1_credit': {
    credits: 1,
    price: 300,
    name: '1 Lead Credit',
    recurring: false,
  },
  '4_credits': {
    credits: 4,
    price: 500,
    name: '4 Lead Credits (Monthly)',
    recurring: true,
  },
  '10_credits': {
    credits: 10,
    price: 1000,
    name: '10 Lead Credits (Monthly)',
    recurring: true,
  },
  '60_credits': {
    credits: 60,
    price: 3000,
    name: '60 Lead Credits',
    recurring: false,
  },
};

/** Buyer-side $5/mo subscription that enables deal-alert delivery. */
export interface DealAlertPrice {
  /** Monthly price in USD cents. */
  amount: number;
  currency: 'usd';
  interval: 'month';
  /** Customer-facing product name (shows up on Stripe Checkout). */
  name: string;
  description: string;
}

export const DEAL_ALERT_PRICE: DealAlertPrice = {
  amount: 500,
  currency: 'usd',
  interval: 'month',
  name: 'Investor Deal Alerts',
  description:
    'SMS alerts for investment deals below your ARV threshold - $5/month',
};

/**
 * Snapshot returned by `GET /api/pricing` — the mobile app reads this
 * to render live prices on the buy / deal-alert page instead of
 * hard-coding (which would drift from the web). Both inner shapes are
 * the canonical types above; this is just the wire envelope.
 */
export interface PricingSnapshot {
  creditPackages: typeof CREDIT_PACKAGES;
  dealAlert: typeof DEAL_ALERT_PRICE;
}

export function getPricingSnapshot(): PricingSnapshot {
  return {
    creditPackages: CREDIT_PACKAGES,
    dealAlert: DEAL_ALERT_PRICE,
  };
}
