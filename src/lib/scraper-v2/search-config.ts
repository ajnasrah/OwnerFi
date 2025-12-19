/**
 * Unified Search Configuration v2
 *
 * TWO SEARCHES - Both run twice daily (9 AM & 9 PM):
 * 1. Owner Finance Search (nationwide with keyword filters)
 * 2. Cash Deals Search (regional AR/TN, no keywords)
 *
 * ALL properties from BOTH searches run through:
 * - Owner finance filter → zillow_imports if passes
 * - Cash deals filter (< 80% ARV) → cash_houses if passes
 *
 * ONLY Search 2 (Cash Deals Regional) sends to GHL webhook
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
 */
export const SEARCH_CONFIGS: SearchConfig[] = [
  // ===== SEARCH 1: OWNER FINANCE (Nationwide) =====
  // Has keyword filter for owner financing terms
  // ~60-70 properties per day
  // NO GHL webhook
  {
    id: 'owner-finance-nationwide',
    name: 'Owner Finance - Nationwide',
    description: 'Nationwide search with owner financing keywords (last 1 day)',
    url: 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-126.59184519322206%2C%22east%22%3A-53.027392068222056%2C%22south%22%3A-18.744904304943347%2C%22north%22%3A61.09292780993076%7D%2C%22mapZoom%22%3A4%2C%22usersSearchTerm%22%3A%22%22%2C%22customRegionId%22%3A%227737068f7fX1-CR1vsn1vnm6xxbg_1d5w1n%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22min%22%3A50000%2C%22max%22%3A750000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A3750%7D%2C%22beds%22%3A%7B%22min%22%3A1%2C%22max%22%3Anull%7D%2C%22baths%22%3A%7B%22min%22%3A1%2C%22max%22%3Anull%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%2C%22att%22%3A%7B%22value%22%3A%22%5C%22owner%20financing%5C%22%20%2C%20%5C%22seller%20financing%5C%22%20%2C%20%5C%22owner%20carry%5C%22%20%2C%20%5C%22seller%20carry%5C%22%20%2C%20%5C%22financing%20available%2Foffered%5C%22%20%2C%20%5C%22creative%20financing%5C%22%20%2C%20%5C%22flexible%20financing%5C%22%2C%20%5C%22terms%20available%5C%22%2C%20%5C%22owner%20terms%5C%22%22%7D%7D%2C%22isListVisible%22%3Atrue%7D',
    maxItems: 500,
    type: 'owner_finance',
    sendToGHL: false,
  },

  // ===== SEARCH 2: CASH DEALS (Regional AR/TN) =====
  // NO keyword filter - searches all listings in region
  // Sends ALL properties to GHL webhook to find more owner finance deals
  {
    id: 'cash-deals-regional',
    name: 'Cash Deals - Regional (AR/TN)',
    description: 'Regional search without keywords (last 1 day) - sends to GHL',
    url: 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-92.64805231635005%2C%22east%22%3A-88.4759942108813%2C%22south%22%3A34.04448627074044%2C%22north%22%3A36.477417577203184%7D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22max%22%3A500000%2C%22min%22%3A50000%7D%2C%22mf%22%3A%7B%22value%22%3Afalse%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22nc%22%3A%7B%22value%22%3Afalse%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22mapZoom%22%3A9%2C%22customRegionId%22%3A%225f8096924aX1-CR1i1r231i2qe0e_1276cg%22%2C%22pagination%22%3A%7B%7D%2C%22usersSearchTerm%22%3A%22%22%7D',
    maxItems: 1000,
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
  maxItemsPerSearch: 2000,

  // Total hard limit across all searches
  maxTotalItems: 5000,

  // Abort if a single search returns more than this
  abortThreshold: 3000,
};
