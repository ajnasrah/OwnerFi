/**
 * DEAL BADGE CONFIG — Single source of truth for deal type display
 *
 * All UI components (PropertyCard, InvestorPropertyCard) use this
 * to ensure consistent badge rendering across the app.
 *
 * Deal types:
 *   owner_finance — seller willing to finance directly
 *   cash_deal     — price < 80% of Zestimate (investor discount)
 *   both          — GHL outreach confirmed OF + meets cash deal numbers
 */

export type DealTypeBadge = 'owner_finance' | 'cash_deal';

export interface BadgeConfig {
  text: string;
  bg: string;           // Tailwind bg class
  textColor: string;    // Tailwind text class
  icon: string;         // emoji
}

// ── Badge styles ──

export const OWNER_FINANCE_BADGE: BadgeConfig = {
  text: 'Owner Finance',
  bg: 'bg-emerald-600',
  textColor: 'text-white',
  icon: '💰',
};

export const CASH_DEAL_BADGE: BadgeConfig = {
  text: 'Cash Deal',
  bg: 'bg-amber-600',
  textColor: 'text-white',
  icon: '💵',
};

// Extended financing type badges (buyer swiper uses these)
const FINANCING_BADGES: Record<string, BadgeConfig> = {
  'Owner Finance':      { text: 'Owner Finance',      bg: 'bg-emerald-600', textColor: 'text-white', icon: '💰' },
  'Seller Finance':     { text: 'Seller Finance',     bg: 'bg-blue-600',    textColor: 'text-white', icon: '🤝' },
  'Rent to Own':        { text: 'Rent to Own',        bg: 'bg-purple-600',  textColor: 'text-white', icon: '🏠' },
  'Contract for Deed':  { text: 'Contract for Deed',  bg: 'bg-orange-600',  textColor: 'text-white', icon: '📜' },
  'Assumable Loan':     { text: 'Assumable Loan',     bg: 'bg-teal-600',    textColor: 'text-white', icon: '🔄' },
  'Creative Financing': { text: 'Creative Financing', bg: 'bg-yellow-600',  textColor: 'text-white', icon: '💡' },
};

/**
 * Get badge config for a financing type label (buyer swiper).
 * Falls back to Owner Finance if unrecognized.
 */
export function getFinancingBadge(financingType: string): BadgeConfig {
  return FINANCING_BADGES[financingType] || OWNER_FINANCE_BADGE;
}

/**
 * Get the primary badge for a deal.
 *
 * For "both" deals, returns the badge matching the active filter context.
 * This prevents mixing — when viewing owner finance, "both" shows OF badge;
 * when viewing cash deals, "both" shows cash badge.
 */
export function getDealBadge(
  dealType: 'owner_finance' | 'cash_deal' | 'both' | string,
  filterContext?: 'owner_finance' | 'cash_deal' | 'all',
): BadgeConfig {
  if (dealType === 'both') {
    return filterContext === 'cash_deal' ? CASH_DEAL_BADGE : OWNER_FINANCE_BADGE;
  }
  if (dealType === 'cash_deal') return CASH_DEAL_BADGE;
  return OWNER_FINANCE_BADGE;
}

/**
 * Check if a raw Typesense dealType qualifies for both deal types.
 * Only true for GHL outreach deals where agent confirmed OF + cash numbers work.
 */
export function qualifiesForBoth(rawDealType: string): boolean {
  return rawDealType === 'both';
}

// ── Video pipeline badge (CSS values for Puppeteer HTML) ──

export function getVideoBadgeCSS(dealTypes: string[]): {
  text: string;
  bg: string;
  color: string;
  icon: string;
} {
  const isOwnerFinance = dealTypes.includes('owner_finance');
  const isCashDealOnly = !isOwnerFinance && dealTypes.includes('cash_deal');

  return isCashDealOnly
    ? { text: 'Cash Deal',     bg: 'background: #eab308;', color: 'color: #000;', icon: '💵' }
    : { text: 'Owner Finance', bg: 'background: #059669;', color: 'color: #fff;', icon: '💰' };
}
