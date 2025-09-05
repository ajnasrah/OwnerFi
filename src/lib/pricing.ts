export interface PricingTier {
  id: string;
  name: string;
  monthlyPrice: number;
  creditsPerMonth: number;
  features: string[];
  maxLeadsPerMonth: number;
  supportLevel: 'basic' | 'priority' | 'dedicated';
  analyticsAccess: boolean;
  bulkExport: boolean;
  apiAccess: boolean;
  stripePrice?: string;
  stripePriceAnnual?: string;
  isPayPerLead?: boolean;
  isEnterprise?: boolean;
  isRecurringPrice?: boolean; // True for subscription prices, false for one-time
  isRecurringAnnual?: boolean; // True if annual is subscription
}

export const PRICING_TIERS: Record<string, PricingTier> = {
  payAsYouGo: {
    id: 'payAsYouGo',
    name: 'Pay-As-You-Go',
    monthlyPrice: 300,
    creditsPerMonth: 1,
    features: [
      '$300 per lead purchased',
      'No monthly commitment',
      'Perfect for testing',
      'Basic lead matching',
      'Pay only when you need leads'
    ],
    maxLeadsPerMonth: 999,
    supportLevel: 'basic',
    analyticsAccess: true,
    bulkExport: false,
    apiAccess: false,
    isPayPerLead: true,
    // NOTE: This Stripe price needs to be updated to $300, not $1,800
    stripePrice: 'price_1S1880Jkpg3x1io7XEPsakYx'
  },
  starter: {
    id: 'starter',
    name: 'Starter Package',
    monthlyPrice: 500,
    creditsPerMonth: 5,
    features: [
      '5 buyer leads per month',
      'Monthly: Receive 5 leads each month',
      'Annual: Get all 60 leads today'
    ],
    maxLeadsPerMonth: 5,
    supportLevel: 'basic',
    analyticsAccess: true,
    bulkExport: false,
    apiAccess: false,
    stripePrice: 'price_1S18FxJkpg3x1io78UbBSPVR',
    stripePriceAnnual: 'price_1S3j4dJkpg3x1io7azwHc6dq',
    isRecurringPrice: true, // Monthly is subscription
    isRecurringAnnual: false // Annual is one-time
  },
  professional: {
    id: 'professional',
    name: 'Professional Package',
    monthlyPrice: 1000,
    creditsPerMonth: 10,
    features: [
      '10 buyer leads per month',
      'Monthly: Receive 10 leads each month',
      'Annual: Get all 120 leads today'
    ],
    maxLeadsPerMonth: 10,
    supportLevel: 'priority',
    analyticsAccess: true,
    bulkExport: true,
    apiAccess: true,
    stripePrice: 'price_1S18NlJkpg3x1io7vUCoetwT',
    stripePriceAnnual: 'price_1S3j5zJkpg3x1io7jqGhYvo9',
    isRecurringPrice: true, // Monthly is subscription  
    isRecurringAnnual: false // Annual is one-time
  },
  customPropertyService: {
    id: 'customPropertyService',
    name: 'Custom Property Service',
    monthlyPrice: 0,
    creditsPerMonth: 0,
    features: [
      'We find owner-finance deals for your buyers',
      'Custom property sourcing service',
      'Dedicated property research team',
      'Tailored to specific buyer requirements',
      'One-time service per request'
    ],
    maxLeadsPerMonth: 0,
    supportLevel: 'dedicated',
    analyticsAccess: false,
    bulkExport: false,
    apiAccess: false,
    stripePrice: 'price_1RzNj5Jkpg3x1io7WG8SxLFG',
    isPayPerLead: true
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 0,
    creditsPerMonth: 999,
    features: [
      'Custom AI solutions tailored to you',
      'Unlimited leads & buyer profiles',
      'CRM + Text marketing included',
      'Owner-finance property sourcing included',
      'Dedicated account manager'
    ],
    maxLeadsPerMonth: 999,
    supportLevel: 'dedicated',
    analyticsAccess: true,
    bulkExport: true,
    apiAccess: true,
    isEnterprise: true
  }
};

export const getPricingTier = (planId: string): PricingTier | null => {
  return PRICING_TIERS[planId] || null;
};

export const getAllPricingTiers = (): PricingTier[] => {
  return Object.values(PRICING_TIERS);
};

export const validatePlanAccess = (userPlan: string, requiredFeature: keyof PricingTier): boolean => {
  const tier = getPricingTier(userPlan);
  if (!tier) return false;
  
  return tier[requiredFeature] as boolean;
};