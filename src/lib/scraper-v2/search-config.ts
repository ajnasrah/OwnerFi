/**
 * Unified Search Configuration v2
 *
 * TWO SEARCHES - Run daily at 12 PM CST (18:00 UTC):
 * 1. Owner Finance Search (nationwide with STRICT keyword filters)
 * 2. Cash Deals Search (regional AR/TN, no keywords)
 *
 * ALL properties from BOTH searches run through:
 * - Owner finance filter → properties collection with isOwnerFinance=true
 * - Cash deals filter (< 80% ARV) → properties collection with isCashDeal=true
 *
 * ONLY Search 2 (Cash Deals Regional) sends to GHL webhook
 *
 * UPDATED (Jan 7, 2026):
 * - Changed doz from 3 to 1 day (fresh daily listings only)
 * - Removed $50K minimum price (now $0)
 * - Removed 55plus filter
 * - Keywords match owner-financing-filter-strict.ts patterns exactly
 */

export interface SearchConfig {
  id: string;
  name: string;
  description: string;
  url: string;
  maxItems: number;
  type: 'owner_finance' | 'cash_deals';
  sendToGHL: boolean;
}

/**
 * GHL Webhook for Cash Deals Regional properties
 */
export const GHL_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/U2B5lSlWrVBgVxHNq5AH/webhook-trigger/f13ea8d2-a22c-4365-9156-759d18147d4a';

/**
 * ALL SEARCH CONFIGURATIONS
 *
 * Search 1 URL keywords (STRICT - matches owner-financing-filter-strict.ts):
 * - "owner financing", "seller financing"
 * - "owner carry", "seller carry"
 * - "owner terms", "seller terms"
 * - "rent to own", "lease option"
 * - "contract for deed", "land contract"
 * - "assumable loan", "no bank needed"
 *
 * REMOVED (caused false positives):
 * - "creative financing" - too broad
 * - "flexible financing" - too broad
 * - "terms available" - too broad
 * - "financing available/offered" - too broad
 */
export const SEARCH_CONFIGS: SearchConfig[] = [
  // ===== SEARCH 1: OWNER FINANCE (Nationwide) =====
  // STRICT keyword filter - only high-confidence owner financing terms
  // doz: 1 day (fresh daily listings only)
  // NO GHL webhook
  {
    id: 'owner-finance-nationwide',
    name: 'Owner Finance - Nationwide',
    description: 'Nationwide search with strict owner financing keywords (last 1 day)',
    url: 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-167.85649363072204%2C%22east%22%3A-11.762743630722056%2C%22south%22%3A-42.37056114607797%2C%22north%22%3A71.96035173654774%7D%2C%22mapZoom%22%3A4%2C%22usersSearchTerm%22%3A%22%22%2C%22customRegionId%22%3A%227737068f7fX1-CR1vsn1vnm6xxbg_1d5w1n%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22max%22%3A750000%2C%22min%22%3A0%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A3750%7D%2C%22beds%22%3A%7B%22min%22%3A1%2C%22max%22%3Anull%7D%2C%22baths%22%3A%7B%22min%22%3A1%2C%22max%22%3Anull%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%2C%22att%22%3A%7B%22value%22%3A%22%5C%22owner%20financing%5C%22%20%2C%20%5C%22seller%20financing%5C%22%20%2C%20%5C%22owner%20carry%5C%22%20%2C%20%5C%22seller%20carry%5C%22%20%2C%20%5C%22owner%20terms%5C%22%20%2C%20%5C%22seller%20terms%5C%22%20%2C%20%5C%22rent%20to%20own%5C%22%20%2C%20%5C%22lease%20option%5C%22%20%2C%20%5C%22contract%20for%20deed%5C%22%20%2C%20%5C%22land%20contract%5C%22%20%2C%20%5C%22assumable%20loan%5C%22%20%2C%20%5C%22no%20bank%20needed%5C%22%22%7D%2C%22pmf%22%3A%7B%22value%22%3Atrue%7D%2C%22pf%22%3A%7B%22value%22%3Atrue%7D%7D%2C%22isListVisible%22%3Atrue%7D',
    maxItems: 2500,
    type: 'owner_finance',
    sendToGHL: false,
  },

  // ===== SEARCH 2: CASH DEALS (Regional AR/TN) =====
  // NO keyword filter - searches all listings in region
  // doz: 1 day (fresh daily listings only)
  // Sends ALL properties to GHL webhook to find more owner finance deals
  {
    id: 'cash-deals-regional',
    name: 'Cash Deals - Regional (AR/TN)',
    description: 'Regional search without keywords (last 1 day) - sends to GHL',
    url: 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-93.00098810736567%2C%22east%22%3A-88.12305841986567%2C%22south%22%3A33.303923989315145%2C%22north%22%3A37.189660587627294%7D%2C%22mapZoom%22%3A9%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22nc%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22max%22%3A11000000%2C%22min%22%3A0%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22pf%22%3A%7B%22value%22%3Atrue%7D%2C%22pmf%22%3A%7B%22value%22%3Atrue%7D%7D%2C%22isListVisible%22%3Atrue%2C%22customRegionId%22%3A%22f6068695e6X1-CRor2wysttztwe_tcbal%22%2C%22pagination%22%3A%7B%7D%2C%22usersSearchTerm%22%3A%22%22%7D',
    maxItems: 2500,
    type: 'cash_deals',
    sendToGHL: true,
  },
];

/**
 * Get all search URLs for the scraper
 */
export function getAllSearchUrls(): string[] {
  return SEARCH_CONFIGS.map(config => config.url);
}

/**
 * Get total max items across all searches
 */
export function getTotalMaxItems(): number {
  return SEARCH_CONFIGS.reduce((sum, config) => sum + config.maxItems, 0);
}

/**
 * Get configs that should send to GHL webhook
 */
export function getGHLConfigs(): SearchConfig[] {
  return SEARCH_CONFIGS.filter(config => config.sendToGHL);
}

/**
 * Safety limits
 */
export const SAFETY_LIMITS = {
  // Hard limit per search to prevent runaway costs
  maxItemsPerSearch: 2500,

  // Total hard limit across all searches (2 searches x 2500 = 5000)
  maxTotalItems: 5000,

  // Abort if a single search returns more than this
  abortThreshold: 5000,
};
