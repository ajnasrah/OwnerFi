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
 * Targeted cash-deal zip codes (Memphis TN, Birmingham AL, Huntsville AL,
 * Indianapolis IN, Louisville KY). Same outreach path as AR/TN regional:
 * GHL webhook + Abdullah SMS + investor subscriber alerts.
 */
export const TARGETED_CASH_ZIPS = [
  // Memphis, TN
  '38125', '38116', '38141', '38114', '38128',
  // Birmingham, AL
  '35214', '35215', '35235', '35206', '35217',
  '35023', '35020', '35068', '35126', '35071',
  // Huntsville, AL
  '35810', '35816', '35805', '35811', '35763',
  '35756', '35748', '35754', '35757',
  // Indianapolis, IN
  '46241', '46219', '46222', '46227', '46203',
  '46201', '46107', '46237', '46239', '46221',
  // Louisville, KY
  '40215', '40216', '40218', '40214', '40213',
  '40211', '40212', '40258', '40272', '40229',
  // Dayton, OH
  '45410', '45417', '45420', '45406', '45403',
  // Montgomery, AL
  '36116', '36109', '36111', '36106', '36110',
  // Akron, OH
  '44306', '44301', '44314', '44320', '44302',
];

/**
 * Zip-code centroids (lat/lng). api-ninja/zillow-search-scraper requires
 * `mapBounds` on every Zillow URL — we derive a bounding box per zip by
 * padding ±0.08° around the centroid (~5 miles, safely covers any metro
 * zip). Zillow further filters by the zip in the URL path, so
 * over-coverage is harmless.
 */
const ZIP_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  // Memphis, TN
  '38125': { lat: 35.05, lng: -89.80 },
  '38116': { lat: 35.05, lng: -90.03 },
  '38141': { lat: 35.03, lng: -89.81 },
  '38114': { lat: 35.12, lng: -89.98 },
  '38128': { lat: 35.22, lng: -89.91 },
  // Birmingham, AL
  '35214': { lat: 33.56, lng: -86.88 },
  '35215': { lat: 33.62, lng: -86.70 },
  '35235': { lat: 33.63, lng: -86.66 },
  '35206': { lat: 33.57, lng: -86.74 },
  '35217': { lat: 33.58, lng: -86.79 },
  '35023': { lat: 33.41, lng: -86.96 },
  '35020': { lat: 33.40, lng: -86.96 },
  '35068': { lat: 33.57, lng: -86.97 },
  '35126': { lat: 33.63, lng: -86.60 },
  '35071': { lat: 33.64, lng: -86.84 },
  // Huntsville, AL
  '35810': { lat: 34.79, lng: -86.58 },
  '35816': { lat: 34.74, lng: -86.64 },
  '35805': { lat: 34.70, lng: -86.62 },
  '35811': { lat: 34.80, lng: -86.53 },
  '35763': { lat: 34.64, lng: -86.54 },
  '35756': { lat: 34.64, lng: -86.77 },
  '35748': { lat: 34.73, lng: -86.44 },
  '35754': { lat: 34.79, lng: -86.77 },
  '35757': { lat: 34.83, lng: -86.73 },
  // Indianapolis, IN
  '46241': { lat: 39.71, lng: -86.29 },
  '46219': { lat: 39.78, lng: -86.04 },
  '46222': { lat: 39.80, lng: -86.21 },
  '46227': { lat: 39.69, lng: -86.13 },
  '46203': { lat: 39.73, lng: -86.12 },
  '46201': { lat: 39.77, lng: -86.09 },
  '46107': { lat: 39.74, lng: -86.07 },
  '46237': { lat: 39.67, lng: -86.08 },
  '46239': { lat: 39.72, lng: -86.02 },
  '46221': { lat: 39.72, lng: -86.22 },
  // Louisville, KY
  '40215': { lat: 38.19, lng: -85.79 },
  '40216': { lat: 38.20, lng: -85.82 },
  '40218': { lat: 38.21, lng: -85.68 },
  '40214': { lat: 38.14, lng: -85.79 },
  '40213': { lat: 38.19, lng: -85.71 },
  '40211': { lat: 38.24, lng: -85.82 },
  '40212': { lat: 38.26, lng: -85.79 },
  '40258': { lat: 38.13, lng: -85.85 },
  '40272': { lat: 38.10, lng: -85.84 },
  '40229': { lat: 38.09, lng: -85.70 },
  // Dayton, OH
  '45410': { lat: 39.74, lng: -84.15 },
  '45417': { lat: 39.73, lng: -84.24 },
  '45420': { lat: 39.72, lng: -84.13 },
  '45406': { lat: 39.78, lng: -84.22 },
  '45403': { lat: 39.75, lng: -84.14 },
  // Montgomery, AL
  '36116': { lat: 32.31, lng: -86.25 },
  '36109': { lat: 32.39, lng: -86.22 },
  '36111': { lat: 32.33, lng: -86.26 },
  '36106': { lat: 32.36, lng: -86.27 },
  '36110': { lat: 32.42, lng: -86.27 },
  // Akron, OH
  '44306': { lat: 41.04, lng: -81.50 },
  '44301': { lat: 41.05, lng: -81.53 },
  '44314': { lat: 41.05, lng: -81.57 },
  '44320': { lat: 41.08, lng: -81.56 },
  '44302': { lat: 41.09, lng: -81.52 },
};

/**
 * Shared filter state for the targeted-zip search. Mirrors the Zillow
 * search URL the user provided: $60k–$150k, monthly payment ≤ $55k,
 * SFR only (townhouse/multi-family/condo/land/apartment/manufactured/co-op
 * all excluded).
 */
const TARGETED_ZIP_FILTER_STATE = {
  sort: { value: 'globalrelevanceex' },
  price: { min: 40000, max: 150000 },
  mp: { max: 55000 },
  tow: { value: false },
  mf: { value: false },
  con: { value: false },
  land: { value: false },
  apa: { value: false },
  manu: { value: false },
  apco: { value: false },
  pf: { value: true },
  pmf: { value: true },
};

/**
 * Build a Zillow search URL for a single zip. Uses zip centroid ±0.08°
 * for mapBounds (required by api-ninja), plus path + usersSearchTerm so
 * Zillow restricts to the zip.
 *
 * `filterOverrides` lets callers override individual filters (e.g. a
 * one-off script wanting doz=any can pass {}).
 */
export function buildZipSearchUrl(
  zip: string,
  filterOverrides: Record<string, unknown> = {}
): string {
  const centroid = ZIP_CENTROIDS[zip];
  if (!centroid) throw new Error(`No centroid defined for zip ${zip}`);

  const pad = 0.15;
  const mapBounds = {
    north: centroid.lat + pad,
    south: centroid.lat - pad,
    east: centroid.lng + pad,
    west: centroid.lng - pad,
  };

  const searchQueryState = {
    pagination: {},
    isMapVisible: true,
    mapBounds,
    mapZoom: 12,
    usersSearchTerm: zip,
    filterState: { ...TARGETED_ZIP_FILTER_STATE, ...filterOverrides },
    isListVisible: true,
  };
  const encoded = encodeURIComponent(JSON.stringify(searchQueryState));
  return `https://www.zillow.com/homes/for_sale/${zip}_rb/?searchQueryState=${encoded}`;
}

const TARGETED_ZIP_URLS = TARGETED_CASH_ZIPS.map(zip => buildZipSearchUrl(zip));

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
  // 21 per-zip URLs (Memphis, Birmingham, Huntsville, Indianapolis, Louisville)
  // Filters: $60k–$150k, monthly payment ≤ $55k, SFR only
  // Same outreach as cash-deals-regional: GHL + Abdullah SMS + investor alerts
  {
    id: 'cash-deals-targeted-zips',
    name: 'Cash Deals - Targeted Zips',
    description: `Per-zip cash-deal search across ${TARGETED_CASH_ZIPS.length} zips - sends to GHL`,
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
