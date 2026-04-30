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
 * Targeted cash-deal zip codes - ALL 55 markets from 4.30 target zips document.
 * Expanded from original 30 to include Memphis TN, Toledo OH, Cleveland OH, 
 * Indianapolis IN, and Detroit MI markets.
 * Focus on 1970+ brick homes with owner-occupancy and strong rental demand.
 * Same outreach path as regional: GHL webhook + Abdullah SMS + investor alerts.
 */
export const TARGETED_CASH_ZIPS = [
  // Memphis, TN - 7 zip codes (11% rental yield - HIGHEST)
  '38125', '38127', '38118', '38109', '38116', '38128', '38141',
  // Toledo, OH - 5 zip codes (9.2% rental yield)
  '43605', '43607', '43612', '43613', '43608',
  // Cleveland, OH - 5 zip codes (9.8% rental yield) 
  '44109', '44108', '44105', '44102', '44111',
  // Indianapolis, IN - 4 zip codes (strong rental market)
  '46218', '46203', '46219', '46226',
  // Detroit, MI - 4 zip codes (deep value opportunities)
  '48219', '48235', '48228', '48221',
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
  // Memphis, TN - 7 zip codes (11% rental yield - HIGHEST)
  '38125': { lat: 35.029, lng: -89.783 },
  '38127': { lat: 35.235, lng: -90.020 },
  '38118': { lat: 35.039, lng: -89.928 },
  '38109': { lat: 35.065, lng: -90.170 },
  '38116': { lat: 35.035, lng: -90.010 },
  '38128': { lat: 35.222, lng: -89.918 },
  '38141': { lat: 35.015, lng: -89.854 },
  // Toledo, OH - 5 zip codes (9.2% rental yield)
  '43605': { lat: 41.653, lng: -83.514 },
  '43607': { lat: 41.659, lng: -83.571 },
  '43612': { lat: 41.616, lng: -83.465 },
  '43613': { lat: 41.590, lng: -83.478 },
  '43608': { lat: 41.648, lng: -83.612 },
  // Cleveland, OH - 5 zip codes (9.8% rental yield)
  '44109': { lat: 41.458, lng: -81.651 },
  '44108': { lat: 41.479, lng: -81.632 },
  '44105': { lat: 41.472, lng: -81.609 },
  '44102': { lat: 41.485, lng: -81.703 },
  '44111': { lat: 41.452, lng: -81.760 },
  // Indianapolis, IN - 4 zip codes (strong rental market)
  '46218': { lat: 39.836, lng: -86.065 },
  '46203': { lat: 39.693, lng: -86.145 },
  '46219': { lat: 39.820, lng: -86.045 },
  '46226': { lat: 39.818, lng: -86.009 },
  // Detroit, MI - 4 zip codes (deep value opportunities)
  '48219': { lat: 42.254, lng: -83.213 },
  '48235': { lat: 42.400, lng: -83.088 },
  '48228': { lat: 42.347, lng: -83.263 },
  '48221': { lat: 42.392, lng: -83.154 },
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
    // Memphis, TN
    '38125': 'memphis-tn',
    '38127': 'memphis-tn',
    '38118': 'memphis-tn',
    '38109': 'memphis-tn',
    '38116': 'memphis-tn',
    '38128': 'memphis-tn',
    '38141': 'memphis-tn',
    // Toledo, OH
    '43605': 'toledo-oh',
    '43607': 'toledo-oh',
    '43612': 'toledo-oh',
    '43613': 'toledo-oh',
    '43608': 'toledo-oh',
    // Cleveland, OH
    '44109': 'cleveland-oh',
    '44108': 'cleveland-oh',
    '44105': 'cleveland-oh',
    '44102': 'cleveland-oh',
    '44111': 'cleveland-oh',
    // Indianapolis, IN
    '46218': 'indianapolis-in',
    '46203': 'indianapolis-in',
    '46219': 'indianapolis-in',
    '46226': 'indianapolis-in',
    // Detroit, MI
    '48219': 'detroit-mi',
    '48235': 'detroit-mi',
    '48228': 'detroit-mi',
    '48221': 'detroit-mi',
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

// Use the exact URLs from 4.30_target_zips.md document (provided by user)
const TARGETED_ZIP_URLS = [
  'https://www.zillow.com/memphis-tn-38125/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A35.11420596161709%2C%22south%22%3A34.94383903281931%2C%22east%22%3A-89.70031351525878%2C%22west%22%3A-89.8635634847412%7D%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%2238125%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74661%2C%22regionType%22%3A7%7D%5D%7D', // 38125
  'https://www.zillow.com/memphis-tn-38127/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A35.31945859319875%2C%22south%22%3A35.14952101213539%2C%22east%22%3A-89.93738151525879%2C%22west%22%3A-90.10063148474121%7D%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%2238127%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74663%2C%22regionType%22%3A7%7D%5D%7D', // 38127
  'https://www.zillow.com/memphis-tn-38118/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A35.124008521431%2C%22south%22%3A34.953662047814234%2C%22east%22%3A-89.8462820152588%2C%22west%22%3A-90.00953198474122%7D%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%2238118%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74656%2C%22regionType%22%3A7%7D%5D%7D', // 38118
  'https://www.zillow.com/memphis-tn-38109/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A35.23503263642265%2C%22south%22%3A34.894448485177556%2C%22east%22%3A-90.00756353051757%2C%22west%22%3A-90.33406346948242%7D%2C%22mapZoom%22%3A12%2C%22usersSearchTerm%22%3A%2238109%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74647%2C%22regionType%22%3A7%7D%5D%7D', // 38109
  'https://www.zillow.com/memphis-tn-38116/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A35.12060898341935%2C%22south%22%3A34.95025541535783%2C%22east%22%3A-89.9277555152588%2C%22west%22%3A-90.09100548474122%7D%2C%22mapZoom%22%3A13%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22usersSearchTerm%22%3A%2238116%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74654%2C%22regionType%22%3A7%7D%5D%7D', // 38116
  'https://www.zillow.com/memphis-tn-38128/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A35.30714349618013%2C%22south%22%3A35.137180092632505%2C%22east%22%3A-89.83704451525877%2C%22west%22%3A-90.00029448474119%7D%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%2238128%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74664%2C%22regionType%22%3A7%7D%5D%7D', // 38128
  'https://www.zillow.com/memphis-tn-38141/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A35.05720022386111%2C%22south%22%3A34.972001686167026%2C%22east%22%3A-89.81339650762938%2C%22west%22%3A-89.89502149237059%7D%2C%22mapZoom%22%3A14%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22usersSearchTerm%22%3A%2238141%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74677%2C%22regionType%22%3A7%7D%5D%7D', // 38141
  'https://www.zillow.com/toledo-oh-43605/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A41.731149703751726%2C%22south%22%3A41.57569661389699%2C%22east%22%3A-83.4322580152588%2C%22west%22%3A-83.59550798474122%7D%2C%22mapZoom%22%3A13%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22usersSearchTerm%22%3A%2243605%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A76764%2C%22regionType%22%3A7%7D%5D%7D', // 43605
  'https://www.zillow.com/toledo-oh-43607/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A41.724847828732635%2C%22south%22%3A41.569379512548146%2C%22east%22%3A-83.5227540152588%2C%22west%22%3A-83.68600398474122%7D%2C%22mapZoom%22%3A13%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22usersSearchTerm%22%3A%2243607%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A76766%2C%22regionType%22%3A7%7D%5D%7D', // 43607
  'https://www.zillow.com/toledo-oh-43612/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A41.7848663262056%2C%22south%22%3A41.629543100824485%2C%22east%22%3A-83.46243301525878%2C%22west%22%3A-83.6256829847412%7D%2C%22mapZoom%22%3A13%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22usersSearchTerm%22%3A%2243612%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A76771%2C%22regionType%22%3A7%7D%5D%7D', // 43612
  'https://www.zillow.com/toledo-oh-43613/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A41.742372948654136%2C%22south%22%3A41.66470686298093%2C%22east%22%3A-83.5603605076294%2C%22west%22%3A-83.64198549237061%7D%2C%22mapZoom%22%3A14%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22usersSearchTerm%22%3A%2243613%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A76772%2C%22regionType%22%3A7%7D%5D%7D', // 43613
  'https://www.zillow.com/toledo-oh-43608/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A41.71582150541046%2C%22south%22%3A41.63812333768508%2C%22east%22%3A-83.4912940076294%2C%22west%22%3A-83.57291899237062%7D%2C%22mapZoom%22%3A14%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22usersSearchTerm%22%3A%2243608%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A76767%2C%22regionType%22%3A7%7D%5D%7D', // 43608
  'https://www.zillow.com/cleveland-oh-44109/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A41.48423925843775%2C%22south%22%3A41.40626197984403%2C%22east%22%3A-81.65364250762937%2C%22west%22%3A-81.73526749237058%7D%2C%22mapZoom%22%3A14%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22usersSearchTerm%22%3A%2244109%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A77009%2C%22regionType%22%3A7%7D%5D%7D', // 44109
  'https://www.zillow.com/cleveland-oh-44108/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A41.58552427001165%2C%22south%22%3A41.507668906836344%2C%22east%22%3A-81.56954250762938%2C%22west%22%3A-81.65116749237059%7D%2C%22mapZoom%22%3A14%2C%22usersSearchTerm%22%3A%2244108%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A77008%2C%22regionType%22%3A7%7D%5D%7D', // 44108
  'https://www.zillow.com/cleveland-oh-44105/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A41.53179774786931%2C%22south%22%3A41.375863907540776%2C%22east%22%3A-81.55057051525878%2C%22west%22%3A-81.7138204847412%7D%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%2244105%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A77005%2C%22regionType%22%3A7%7D%5D%7D', // 44105
  'https://www.zillow.com/cleveland-oh-44102/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A41.51662522159074%2C%22south%22%3A41.43868689901855%2C%22east%22%3A-81.69813100762939%2C%22west%22%3A-81.7797559923706%7D%2C%22mapZoom%22%3A14%2C%22usersSearchTerm%22%3A%2244102%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A77002%2C%22regionType%22%3A7%7D%5D%7D', // 44102
  'https://www.zillow.com/cleveland-oh-44111/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A41.53519604786475%2C%22south%22%3A41.37927038690617%2C%22east%22%3A-81.70926651525878%2C%22west%22%3A-81.8725164847412%7D%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%2244111%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A77011%2C%22regionType%22%3A7%7D%5D%7D', // 44111
  'https://www.zillow.com/indianapolis-in-46218/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A39.84711428318168%2C%22south%22%3A39.767200545377285%2C%22east%22%3A-86.0601635076294%2C%22west%22%3A-86.14178849237061%7D%2C%22mapZoom%22%3A14%2C%22usersSearchTerm%22%3A%2246218%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A78033%2C%22regionType%22%3A7%7D%5D%7D', // 46218
  'https://www.zillow.com/indianapolis-in-46203/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A39.763024%2C%22south%22%3A39.694591%2C%22east%22%3A-86.044969%2C%22west%22%3A-86.150271%7D%2C%22mapZoom%22%3A14%2C%22usersSearchTerm%22%3A%2246203%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A78022%2C%22regionType%22%3A7%7D%5D%7D', // 46203
  'https://www.zillow.com/indianapolis-in-46219/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A39.82393999390667%2C%22south%22%3A39.74399931003124%2C%22east%22%3A-86.00547000762938%2C%22west%22%3A-86.0870949923706%7D%2C%22mapZoom%22%3A14%2C%22usersSearchTerm%22%3A%2246219%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A78034%2C%22regionType%22%3A7%7D%5D%7D', // 46219
  'https://www.zillow.com/indianapolis-in-46226/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A39.921282667059884%2C%22south%22%3A39.75889572049772%2C%22east%22%3A-85.96968863427735%2C%22west%22%3A-86.14066336572266%7D%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%2246226%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A78041%2C%22regionType%22%3A7%7D%5D%7D', // 46226
  'https://www.zillow.com/knoxville-tn-37923/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A36.01134451941521%2C%22south%22%3A35.842870310661404%2C%22east%22%3A-84.0031170152588%2C%22west%22%3A-84.16636698474122%7D%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%2237923%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74560%2C%22regionType%22%3A7%7D%5D%7D', // 37923
  'https://www.zillow.com/farragut-tn-37934/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A35.95591630098203%2C%22south%22%3A35.78732394789383%2C%22east%22%3A-84.09860401525879%2C%22west%22%3A-84.26185398474121%7D%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%2237934%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74569%2C%22regionType%22%3A7%7D%5D%7D', // 37934
  'https://www.zillow.com/knoxville-tn-37922/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A36.024475596256124%2C%22south%22%3A35.687224538698395%2C%22east%22%3A-83.9390845305176%2C%22west%22%3A-84.26558446948245%7D%2C%22mapZoom%22%3A12%2C%22usersSearchTerm%22%3A%2237922%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74559%2C%22regionType%22%3A7%7D%5D%7D', // 37922
  'https://www.zillow.com/knoxville-tn-37919/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A36.002904385677375%2C%22south%22%3A35.83441217670582%2C%22east%22%3A-83.9218615152588%2C%22west%22%3A-84.08511148474122%7D%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%2237919%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74556%2C%22regionType%22%3A7%7D%5D%7D', // 37919
  'https://www.zillow.com/knoxville-tn-37921/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A36.06681673201222%2C%22south%22%3A35.89846091972921%2C%22east%22%3A-83.91189301525877%2C%22west%22%3A-84.07514298474119%7D%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%2237921%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74558%2C%22regionType%22%3A7%7D%5D%7D', // 37921
  'https://www.zillow.com/knoxville-tn-37931/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A36.143966605334285%2C%22south%22%3A35.80722567891184%2C%22east%22%3A-83.96672303051757%2C%22west%22%3A-84.29322296948241%7D%2C%22mapZoom%22%3A12%2C%22usersSearchTerm%22%3A%2237931%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74566%2C%22regionType%22%3A7%7D%5D%7D', // 37931
  'https://www.zillow.com/knoxville-tn-37924/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A36.2095000265444%2C%22south%22%3A35.87303950149451%2C%22east%22%3A-83.63838353051759%2C%22west%22%3A-83.96488346948243%7D%2C%22mapZoom%22%3A12%2C%22usersSearchTerm%22%3A%2237924%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74561%2C%22regionType%22%3A7%7D%5D%7D', // 37924
  'https://www.zillow.com/knoxville-tn-37918/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A36.22518861462949%2C%22south%22%3A35.88879528291932%2C%22east%22%3A-83.74998603051756%2C%22west%22%3A-84.0764859694824%7D%2C%22mapZoom%22%3A12%2C%22usersSearchTerm%22%3A%2237918%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74555%2C%22regionType%22%3A7%7D%5D%7D', // 37918
  'https://www.zillow.com/knoxville-tn-37912/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A36.049656049975404%2C%22south%22%3A35.96550471139547%2C%22east%22%3A-83.9508540076294%2C%22west%22%3A-84.03247899237061%7D%2C%22mapZoom%22%3A14%2C%22usersSearchTerm%22%3A%2237912%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74550%2C%22regionType%22%3A7%7D%5D%7D', // 37912
  'https://www.zillow.com/knoxville-tn-37917/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A36.08410809445749%2C%22south%22%3A35.91578922016354%2C%22east%22%3A-83.83020101525878%2C%22west%22%3A-83.9934509847412%7D%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%2237917%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74554%2C%22regionType%22%3A7%7D%5D%7D', // 37917
  'https://www.zillow.com/little-rock-ar-72205/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A34.837987568094556%2C%22south%22%3A34.68286318734486%2C%22east%22%3A-92.24319651525879%2C%22west%22%3A-92.4064464847412%7D%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%2272205%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A82106%2C%22regionType%22%3A7%7D%5D%7D', // 72205
  'https://www.zillow.com/little-rock-ar-72204/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A34.767953242071915%2C%22south%22%3A34.689986736374364%2C%22east%22%3A-92.23102100762938%2C%22west%22%3A-92.31264599237061%7D%2C%22mapZoom%22%3A14%2C%22usersSearchTerm%22%3A%2272204%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A82105%2C%22regionType%22%3A7%7D%5D%7D', // 72204
  'https://www.zillow.com/little-rock-ar-72202/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A34.74919970893506%2C%22south%22%3A34.67089463012693%2C%22east%22%3A-92.25117850762937%2C%22west%22%3A-92.33280349237061%7D%2C%22mapZoom%22%3A14%2C%22usersSearchTerm%22%3A%2272202%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A82103%2C%22regionType%22%3A7%7D%5D%7D', // 72202
  'https://www.zillow.com/little-rock-ar-72206/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A34.812554951866686%2C%22south%22%3A34.73418509481074%2C%22east%22%3A-92.1941485076294%2C%22west%22%3A-92.2757734923706%7D%2C%22mapZoom%22%3A14%2C%22usersSearchTerm%22%3A%2272206%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A82107%2C%22regionType%22%3A7%7D%5D%7D', // 72206
  'https://www.zillow.com/little-rock-ar-72209/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A34.717736751030906%2C%22south%22%3A34.55571327896324%2C%22east%22%3A-92.28024751525878%2C%22west%22%3A-92.44349748474122%7D%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%2272209%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A82110%2C%22regionType%22%3A7%7D%5D%7D', // 72209
  'https://www.zillow.com/little-rock-ar-72201/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A34.75968434549449%2C%22south%22%3A34.72574651450489%2C%22east%22%3A-92.2569395076294%2C%22west%22%3A-92.2850844923706%7D%2C%22mapZoom%22%3A16%2C%22usersSearchTerm%22%3A%2272201%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A82102%2C%22regionType%22%3A7%7D%5D%7D', // 72201
  'https://www.zillow.com/jackson-ms-39212/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A32.33414950063628%2C%22south%22%3A32.254776095244194%2C%22east%22%3A-90.07751050762938%2C%22west%22%3A-90.15913549237059%7D%2C%22mapZoom%22%3A14%2C%22usersSearchTerm%22%3A%2239212%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A83018%2C%22regionType%22%3A7%7D%5D%7D', // 39212
  'https://www.zillow.com/jackson-ms-39204/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A32.31976734863648%2C%22south%22%3A32.24139488536152%2C%22east%22%3A-90.1298155076294%2C%22west%22%3A-90.21144049237061%7D%2C%22mapZoom%22%3A14%2C%22usersSearchTerm%22%3A%2239204%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A83010%2C%22regionType%22%3A7%7D%5D%7D', // 39204
  'https://www.zillow.com/jackson-ms-39206/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A32.30830773516029%2C%22south%22%3A32.22994138383972%2C%22east%22%3A-90.05987100762937%2C%22west%22%3A-90.14149599237059%7D%2C%22mapZoom%22%3A14%2C%22usersSearchTerm%22%3A%2239206%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A83012%2C%22regionType%22%3A7%7D%5D%7D', // 39206
  'https://www.zillow.com/jackson-ms-39203/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A32.36513436426881%2C%22south%22%3A32.286794636731194%2C%22east%22%3A-90.12174800762939%2C%22west%22%3A-90.20337299237061%7D%2C%22mapZoom%22%3A14%2C%22usersSearchTerm%22%3A%2239203%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A83009%2C%22regionType%22%3A7%7D%5D%7D', // 39203
  'https://www.zillow.com/detroit-mi-48221/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A42.3797959264071%2C%22south%22%3A42.30148893359291%2C%22east%22%3A-83.07847100762939%2C%22west%22%3A-83.16009599237061%7D%2C%22mapZoom%22%3A14%2C%22usersSearchTerm%22%3A%2248221%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A84616%2C%22regionType%22%3A7%7D%5D%7D', // 48221
  'https://www.zillow.com/detroit-mi-48235/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A42.351945491962144%2C%22south%22%3A42.273621508037856%2C%22east%22%3A-83.25488100762939%2C%22west%22%3A-83.33650599237062%7D%2C%22mapZoom%22%3A14%2C%22usersSearchTerm%22%3A%2248235%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A84629%2C%22regionType%22%3A7%7D%5D%7D', // 48235
  'https://www.zillow.com/detroit-mi-48219/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A42.358966495624504%2C%22south%22%3A42.280641504375496%2C%22east%22%3A-83.1977875076294%2C%22west%22%3A-83.2794124923706%7D%2C%22mapZoom%22%3A14%2C%22usersSearchTerm%22%3A%2248219%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A84614%2C%22regionType%22%3A7%7D%5D%7D', // 48219
  'https://www.zillow.com/detroit-mi-48234/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A42.373624486938226%2C%22south%22%3A42.295300513061774%2C%22east%22%3A-82.92859850762937%2C%22west%22%3A-83.01022349237059%7D%2C%22mapZoom%22%3A14%2C%22usersSearchTerm%22%3A%2248234%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A84628%2C%22regionType%22%3A7%7D%5D%7D', // 48234
  'https://www.zillow.com/detroit-mi-48238/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A42.452639499999994%2C%22south%22%3A42.348990500000005%2C%22east%22%3A-83.07639751525878%2C%22west%22%3A-83.23964748474122%7D%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%2248238%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A84632%2C%22regionType%22%3A7%7D%5D%7D' // 48238
];

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
