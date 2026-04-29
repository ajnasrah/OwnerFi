/**
 * Unified Search Configuration v2
 *
 * TWO SEARCHES - Run daily at 12 PM CST (18:00 UTC):
 * 1. Owner Finance Search (nationwide with STRICT keyword filters)
 * 2. Cash Deals Search (regional AR/TN, no keywords)
 *
 * ALL properties from BOTH searches run through:
 * - Owner finance filter → properties collection with isOwnerfinance=true
 * - Cash deals filter (< 80% ARV) → properties collection with isCashDeal=true
 *
 * ONLY Search 2 (Cash Deals Regional) sends to GHL webhook
 *
 * UPDATED (Jan 7, 2026):
 * - Removed $50K minimum price (now $0)
 * - Keywords match owner-financing-filter-strict.ts patterns exactly
 *
 * UPDATED (Mar 28, 2026):
 * - Changed doz from 1 to 3 days (1 day was too aggressive, missed listings)
 * - Removed monthly payment cap ($3,750) - was using Zillow's conventional mortgage math, not seller's OF terms
 * - Removed beds/baths minimum (1/1) - was excluding land/lots which are a big segment of OF deals
 */

export interface SearchConfig {
  id: string;
  name: string;
  description: string;
  url: string;
  // Optional: when set, scraper runs these URLs instead of `url`.
  // Used for multi-URL searches (e.g. per-zip fan-out). `url` still holds
  // the first/representative URL for logging.
  urls?: string[];
  maxItems: number;
  type: 'owner_finance' | 'cash_deals';
  sendToGHL: boolean;
  // Optional: when set, runner discards any scraped property whose zipcode
  // is not in this list. Needed for per-zip searches where the Zillow
  // mapBounds bleed into neighboring zips.
  zipFilter?: string[];
}

/**
 * Targeted cash-deal zip codes (Knoxville TN, Athens GA, Columbus OH).
 * Focus on 1970+ brick homes with owner-occupancy and strong rental demand.
 * Same outreach path as regional: GHL webhook + Abdullah SMS + investor alerts.
 */
export const TARGETED_CASH_ZIPS = [
  // Knoxville, TN - Tier 1: Premium Investment Areas
  '37923', '37934', '37922', '37919',
  // Knoxville, TN - Tier 2: Solid Family Areas  
  '37921', '37931', '37924', '37918',
  // Knoxville, TN - Tier 3: Value Opportunities
  '37912', '37917',
  // Athens, GA - Tier 1: Prime UGA Investment Areas
  '30605', '30606', '30609', '30602',
  // Athens, GA - Tier 2: Solid Investment Areas
  '30607', '30601', '30608',
  // Athens, GA - Tier 3: Emerging Areas
  '30622', '30677', '30506',
  // Columbus, OH - Tier 1: Premium Safe Areas
  '43235', '43017', '43240', '43229',
  // Columbus, OH - Tier 2: University Adjacent
  '43202', '43210', '43201', '43214',
  // Columbus, OH - Tier 3: Value Opportunities
  '43228', '43223',
];

/**
 * Zip-code centroids (lat/lng). api-ninja/zillow-search-scraper requires
 * `mapBounds` on every Zillow URL — we derive a bounding box per zip by
 * padding ±0.08° around the centroid (~5 miles, safely covers any metro
 * zip). Zillow further filters by the zip in the URL path, so
 * over-coverage is harmless.
 */
export const ZIP_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  // Knoxville, TN - Tier 1: Premium Investment Areas
  '37923': { lat: 35.97, lng: -84.13 },
  '37934': { lat: 35.88, lng: -84.17 },
  '37922': { lat: 35.97, lng: -84.19 },
  '37919': { lat: 35.98, lng: -83.94 },
  // Knoxville, TN - Tier 2: Solid Family Areas
  '37921': { lat: 35.95, lng: -84.25 },
  '37931': { lat: 35.91, lng: -84.22 },
  '37924': { lat: 36.02, lng: -84.18 },
  '37918': { lat: 36.01, lng: -83.96 },
  // Knoxville, TN - Tier 3: Value Opportunities
  '37912': { lat: 35.96, lng: -83.93 },
  '37917': { lat: 35.96, lng: -83.87 },
  // Athens, GA - Tier 1: Prime UGA Investment Areas
  '30605': { lat: 33.93, lng: -83.36 },
  '30606': { lat: 33.98, lng: -83.39 },
  '30609': { lat: 33.99, lng: -83.42 },
  '30602': { lat: 34.02, lng: -83.36 },
  // Athens, GA - Tier 2: Solid Investment Areas
  '30607': { lat: 33.91, lng: -83.42 },
  '30601': { lat: 33.96, lng: -83.37 },
  '30608': { lat: 34.07, lng: -83.24 },
  // Athens, GA - Tier 3: Emerging Areas
  '30622': { lat: 34.00, lng: -83.47 },
  '30677': { lat: 33.83, lng: -83.41 },
  '30506': { lat: 34.30, lng: -83.82 },
  // Columbus, OH - Tier 1: Premium Safe Areas
  '43235': { lat: 40.16, lng: -83.06 },
  '43017': { lat: 40.10, lng: -83.11 },
  '43240': { lat: 40.15, lng: -82.89 },
  '43229': { lat: 40.08, lng: -83.03 },
  // Columbus, OH - Tier 2: University Adjacent
  '43202': { lat: 39.98, lng: -83.01 },
  '43210': { lat: 39.99, lng: -83.01 },
  '43201': { lat: 40.03, lng: -83.00 },
  '43214': { lat: 40.05, lng: -83.07 },
  // Columbus, OH - Tier 3: Value Opportunities
  '43228': { lat: 39.95, lng: -83.13 },
  '43223': { lat: 39.93, lng: -83.07 },
};

/**
 * Shared filter state for the targeted-zip search. Focuses on 1970+ brick homes
 * with character: $60k–$150k, monthly payment ≤ $55k, built 1970 or later,
 * SFR only (townhouse/multi-family/condo/land/apartment/manufactured/co-op
 * all excluded).
 */

/**
 * Build a precise Zillow search URL for a single zip code using the exact
 * format you specified. Includes 1970+ built, $0-300k, 1 day listings,
 * no land/apartments/manufactured, max $55k monthly payment, max $200 HOA.
 */
export function buildPreciseZipSearchUrl(zip: string): string {
  const centroid = ZIP_CENTROIDS[zip];
  if (!centroid) throw new Error(`No centroid defined for zip ${zip}`);

  // Get city name for the URL path
  const cityMap: Record<string, string> = {
    // Knoxville, TN
    '37923': 'knoxville-tn',
    '37934': 'farragut-tn', 
    '37922': 'knoxville-tn',
    '37919': 'knoxville-tn',
    '37921': 'knoxville-tn',
    '37931': 'knoxville-tn',
    '37924': 'knoxville-tn',
    '37918': 'knoxville-tn',
    '37912': 'knoxville-tn',
    '37917': 'knoxville-tn',
    // Athens, GA
    '30605': 'athens-ga',
    '30606': 'athens-ga',
    '30609': 'athens-ga',
    '30602': 'athens-ga',
    '30607': 'athens-ga',
    '30601': 'athens-ga',
    '30608': 'athens-ga',
    '30622': 'bogart-ga',
    '30677': 'watkinsville-ga',
    '30506': 'gainesville-ga',
    // Columbus, OH
    '43235': 'dublin-oh',
    '43017': 'dublin-oh',
    '43240': 'columbus-oh',
    '43229': 'columbus-oh',
    '43202': 'columbus-oh',
    '43210': 'columbus-oh',
    '43201': 'columbus-oh',
    '43214': 'columbus-oh',
    '43228': 'columbus-oh',
    '43223': 'columbus-oh',
  };

  const cityPath = cityMap[zip] || 'homes-for-sale';
  
  // Precise map bounds based on your format
  const pad = 0.08; // Smaller, more precise bounds
  const mapBounds = {
    north: Math.round((centroid.lat + pad) * 1000000) / 1000000,
    south: Math.round((centroid.lat - pad) * 1000000) / 1000000,
    east: Math.round((centroid.lng + pad) * 1000000) / 1000000,
    west: Math.round((centroid.lng - pad) * 1000000) / 1000000,
  };

  const searchQueryState = {
    isMapVisible: true,
    mapBounds,
    mapZoom: 13,
    filterState: {
      sort: { value: "globalrelevanceex" },
      price: { min: 0, max: 300000 },
      mp: { min: null, max: 55000 },
      land: { value: false },
      apa: { value: false },
      manu: { value: false },
      hoa: { max: 200 },
      built: { min: 1970 },
      "55plus": { value: "e" },
      doz: { value: "1" }
    },
    isListVisible: true,
    usersSearchTerm: zip,
    category: "cat1",
    regionSelection: [{ regionId: parseInt(zip), regionType: 7 }]
  };
  
  const encoded = encodeURIComponent(JSON.stringify(searchQueryState));
  return `https://www.zillow.com/${cityPath}-${zip}/?searchQueryState=${encoded}`;
}

/**
 * Legacy function - kept for backwards compatibility
 * @deprecated Use buildPreciseZipSearchUrl instead
 */
export function buildZipSearchUrl(
  zip: string,
  _filterOverrides: Record<string, unknown> = {}
): string {
  return buildPreciseZipSearchUrl(zip);
}

const TARGETED_ZIP_URLS = TARGETED_CASH_ZIPS.map(zip => buildPreciseZipSearchUrl(zip));

/**
 * Build a Zillow search URL for the agent-outreach pipeline in a single
 * targeted zip. Mirrors the filters the agent-outreach cron has always
 * used ($50k–$500k, no land/NC/auction/foreclosure/apartment/manufactured/
 * 55+), and INCLUDES multi-family (Zillow `mf` key omitted, so Zillow's
 * default — which includes MF — applies).
 *
 * `dozDays` — when set, Zillow's days-on-market filter restricts to
 * listings posted in that window. Omit for "any time".
 */
export function buildAgentOutreachZipUrl(
  zip: string,
  opts: { dozDays?: 1 | 7 | 14 | 30 | 90 } = {}
): string {
  const centroid = ZIP_CENTROIDS[zip];
  if (!centroid) throw new Error(`No centroid defined for zip ${zip}`);

  // Tight pad (~3.5mi) to minimize bbox bleed into neighbor zips. Zillow
  // still returns some bleed (its map search is fuzzy), so callers MUST
  // post-filter search results by addressZipcode ∈ TARGETED_CASH_ZIPS.
  const pad = 0.05;
  const mapBounds = {
    north: centroid.lat + pad,
    south: centroid.lat - pad,
    east: centroid.lng + pad,
    west: centroid.lng - pad,
  };

  const filterState: Record<string, unknown> = {
    sort: { value: 'globalrelevanceex' },
    nc: { value: false },
    auc: { value: false },
    fore: { value: false },
    price: { min: 50000, max: 500000 },
    built: { min: 1970 }, // 1970+ built homes only
    land: { value: false },
    apa: { value: false },
    manu: { value: false },
    '55plus': { value: 'e' },
  };
  if (opts.dozDays !== undefined) {
    filterState.doz = { value: String(opts.dozDays) };
  }

  const searchQueryState = {
    pagination: {},
    isMapVisible: true,
    mapBounds,
    mapZoom: 12,
    usersSearchTerm: zip,
    filterState,
    isListVisible: true,
  };
  const encoded = encodeURIComponent(JSON.stringify(searchQueryState));
  return `https://www.zillow.com/homes/for_sale/${zip}_rb/?searchQueryState=${encoded}`;
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
  // doz: 3 days (catch listings that post between cron runs)
  // No beds/baths minimum (include land/lots)
  // No monthly payment cap (Zillow's conventional mortgage math is irrelevant for OF terms)
  // NO GHL webhook
  {
    id: 'owner-finance-nationwide',
    name: 'Owner Finance - Nationwide',
    description: 'Nationwide search with strict owner financing keywords (last 3 days)',
    url: 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-167.85649363072204%2C%22east%22%3A-11.762743630722056%2C%22south%22%3A-42.37056114607797%2C%22north%22%3A71.96035173654774%7D%2C%22mapZoom%22%3A4%2C%22usersSearchTerm%22%3A%22%22%2C%22customRegionId%22%3A%227737068f7fX1-CR1vsn1vnm6xxbg_1d5w1n%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22max%22%3A750000%2C%22min%22%3A0%7D%2C%22doz%22%3A%7B%22value%22%3A%223%22%7D%2C%22att%22%3A%7B%22value%22%3A%22%5C%22owner%20financing%5C%22%20%2C%20%5C%22seller%20financing%5C%22%20%2C%20%5C%22owner%20carry%5C%22%20%2C%20%5C%22seller%20carry%5C%22%20%2C%20%5C%22owner%20terms%5C%22%20%2C%20%5C%22seller%20terms%5C%22%20%2C%20%5C%22rent%20to%20own%5C%22%20%2C%20%5C%22lease%20option%5C%22%20%2C%20%5C%22contract%20for%20deed%5C%22%20%2C%20%5C%22land%20contract%5C%22%20%2C%20%5C%22assumable%20loan%5C%22%20%2C%20%5C%22no%20bank%20needed%5C%22%22%7D%2C%22pmf%22%3A%7B%22value%22%3Atrue%7D%2C%22pf%22%3A%7B%22value%22%3Atrue%7D%7D%2C%22isListVisible%22%3Atrue%7D',
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
    url: 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-93.00098810736567%2C%22east%22%3A-88.12305841986567%2C%22south%22%3A33.303923989315145%2C%22north%22%3A37.189660587627294%7D%2C%22mapZoom%22%3A9%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22nc%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22max%22%3A11000000%2C%22min%22%3A0%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22pf%22%3A%7B%22value%22%3Atrue%7D%2C%22pmf%22%3A%7B%22value%22%3Atrue%7D%7D%2C%22isListVisible%22%3Atrue%2C%22customRegionId%22%3A%22f6068695e6X1-CRor2wysttztwe_tcbal%22%2C%22pagination%22%3A%7B%7D%2C%22usersSearchTerm%22%3A%22%22%7D',
    maxItems: 2500,
    type: 'cash_deals',
    sendToGHL: true,
  },

  // ===== SEARCH 3: CASH DEALS (Targeted Zips) =====
  // 30 per-zip URLs (Knoxville TN, Athens GA, Columbus OH)
  // Filters: $40k–$150k, monthly payment ≤ $55k, built 1970+, SFR only
  // Focus on brick homes with character in owner-occupied neighborhoods
  {
    id: 'cash-deals-targeted-zips',
    name: 'Cash Deals - Targeted Zips (1970+ Brick Homes)',
    description: `Per-zip search for 1970+ brick homes across ${TARGETED_CASH_ZIPS.length} premium zips - sends to GHL`,
    url: TARGETED_ZIP_URLS[0],
    urls: TARGETED_ZIP_URLS,
    maxItems: 2500,
    type: 'cash_deals',
    sendToGHL: true,
    zipFilter: TARGETED_CASH_ZIPS,
  },
];

/**
 * Get all search URLs for the scraper
 */
export function getAllSearchUrls(): string[] {
  return SEARCH_CONFIGS.flatMap(config => config.urls ?? [config.url]);
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
