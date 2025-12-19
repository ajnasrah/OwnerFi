/**
 * Shared Apify Client for Unified Scraper v2
 *
 * Uses memo23/zillow-cheerio-scraper (all-in-one)
 * - Single run gets search results WITH full details
 * - No queue needed between search and detail scraping
 */

import { ApifyClient } from 'apify-client';

// All-in-one actor that does search + details in one run
const ALL_IN_ONE_ACTOR = 'memo23/zillow-cheerio-scraper';

// Fallback actors (if all-in-one fails or for specific use cases)
const SEARCH_ACTOR = 'maxcopell/zillow-scraper';
const DETAIL_ACTOR = 'maxcopell/zillow-detail-scraper';

let client: ApifyClient | null = null;

export function getApifyClient(): ApifyClient {
  if (!client) {
    const token = process.env.APIFY_API_KEY;
    if (!token) {
      throw new Error('APIFY_API_KEY environment variable is not set');
    }
    client = new ApifyClient({ token });
  }
  return client;
}

export interface AllInOneScraperInput {
  startUrls: Array<{ url: string }>;
  includePropertyDetails?: boolean;
  includeAgentDetails?: boolean;
  includeSaleDetails?: boolean;
  maxItems?: number;
  maxConcurrency?: number;
  maxRequestRetries?: number;
}

export interface ScrapedProperty {
  // Basic info
  zpid?: number | string;
  detailUrl?: string;
  url?: string;
  address?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipcode?: string;

  // Pricing
  price?: number | string;
  zestimate?: number;
  rentZestimate?: number;

  // Property details
  bedrooms?: number;
  bathrooms?: number;
  livingArea?: number;
  lotSize?: number;
  yearBuilt?: number;
  homeType?: string;

  // Full details (when includePropertyDetails: true)
  description?: string;

  // Agent info (when includeAgentDetails: true)
  agentName?: string;
  agentPhone?: string;
  agentEmail?: string;
  brokerName?: string;
  brokerPhone?: string;

  // Media
  imgSrc?: string;
  photos?: string[];

  // Location
  latitude?: number;
  longitude?: number;

  // Raw data passthrough
  [key: string]: any;
}

/**
 * Run search + detail scraping using the FREE maxcopell actors
 * This is a two-step process but uses free/existing actors
 */
export async function runAllInOneScraper(
  searchUrls: string[],
  options: {
    maxItems?: number;
    includeDetails?: boolean;
    timeoutSecs?: number;
  } = {}
): Promise<ScrapedProperty[]> {
  const client = getApifyClient();

  console.log(`[APIFY] Starting two-step scraper (search + details)`);
  console.log(`[APIFY] Search URLs: ${searchUrls.length}`);

  // STEP 1: Run search scraper to get property URLs
  console.log(`\n[APIFY STEP 1] Running search scraper...`);
  console.log(`[APIFY] Actor: ${SEARCH_ACTOR}`);

  const searchInput = {
    searchUrls: searchUrls.map(url => ({ url })),
    maxResults: options.maxItems ?? 2000,
    mode: 'pagination' as const,
  };

  const searchRun = await client.actor(SEARCH_ACTOR).start(searchInput);
  console.log(`[APIFY] Search run started: ${searchRun.id}`);

  const finishedSearchRun = await client.run(searchRun.id).waitForFinish({
    waitSecs: options.timeoutSecs ?? 300
  });

  if (finishedSearchRun.status !== 'SUCCEEDED') {
    throw new Error(`Search scraper failed: ${finishedSearchRun.status}`);
  }

  const { items: searchResults } = await client.dataset(finishedSearchRun.defaultDatasetId).listItems();
  console.log(`[APIFY] Search found ${searchResults.length} properties`);

  if (searchResults.length === 0) {
    console.log(`[APIFY] No properties found in search`);
    return [];
  }

  // Extract URLs from search results
  const propertyUrls = searchResults
    .map((item: any) => item.detailUrl || item.url)
    .filter((url: string) => url && url.includes('zillow.com'));

  console.log(`[APIFY] Extracted ${propertyUrls.length} valid property URLs`);

  if (propertyUrls.length === 0) {
    // If no detail URLs, return search results as-is (basic info only)
    console.log(`[APIFY] No detail URLs found, returning basic search results`);
    return searchResults as ScrapedProperty[];
  }

  // STEP 2: Run detail scraper to get full property info
  // LIMIT: Only process first 500 properties to control costs
  // Increase this limit as needed (each 100 = ~$0.40 in Apify credits)
  const MAX_DETAIL_URLS = 500;
  const urlsToProcess = propertyUrls.slice(0, MAX_DETAIL_URLS);

  if (propertyUrls.length > MAX_DETAIL_URLS) {
    console.log(`[APIFY] Limiting detail scraping to ${MAX_DETAIL_URLS} properties (found ${propertyUrls.length})`);
  }

  console.log(`\n[APIFY STEP 2] Running detail scraper for ${urlsToProcess.length} properties...`);
  console.log(`[APIFY] Actor: ${DETAIL_ACTOR}`);

  // Process in batches to avoid timeout (100 at a time)
  const BATCH_SIZE = 100;
  const allDetailedProperties: ScrapedProperty[] = [];

  for (let i = 0; i < urlsToProcess.length; i += BATCH_SIZE) {
    const batchUrls = urlsToProcess.slice(i, i + BATCH_SIZE);
    console.log(`[APIFY] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(urlsToProcess.length / BATCH_SIZE)} (${batchUrls.length} URLs)`);

    const detailInput = {
      startUrls: batchUrls.map((url: string) => ({ url })),
    };

    const detailRun = await client.actor(DETAIL_ACTOR).start(detailInput);
    const finishedDetailRun = await client.run(detailRun.id).waitForFinish({
      waitSecs: 300 // 5 minutes per batch
    });

    if (finishedDetailRun.status !== 'SUCCEEDED') {
      console.error(`[APIFY] Detail batch failed: ${finishedDetailRun.status}`);
      continue; // Continue with next batch
    }

    const { items: detailResults } = await client.dataset(finishedDetailRun.defaultDatasetId).listItems();
    console.log(`[APIFY] Batch returned ${detailResults.length} detailed properties`);

    allDetailedProperties.push(...(detailResults as ScrapedProperty[]));
  }

  console.log(`\n[APIFY] Total detailed properties: ${allDetailedProperties.length}`);

  // MERGE: Copy images from search results to detail results
  // Detail scraper doesn't return images, but search scraper does
  const searchByZpid = new Map<string, any>();
  for (const item of searchResults as any[]) {
    if (item.zpid) {
      searchByZpid.set(String(item.zpid), item);
    }
  }

  let imagesMerged = 0;
  for (const prop of allDetailedProperties) {
    if (!prop.imgSrc && prop.zpid) {
      const searchItem = searchByZpid.get(String(prop.zpid));
      if (searchItem?.imgSrc) {
        prop.imgSrc = searchItem.imgSrc;
        imagesMerged++;
      }
    }
  }
  console.log(`[APIFY] Merged ${imagesMerged} images from search results`);

  return allDetailedProperties;
}

/**
 * Fallback: Run search-only scraper (maxcopell)
 * Returns basic info without full details
 */
export async function runSearchScraper(
  searchUrls: string[],
  options: {
    maxResults?: number;
    mode?: 'map' | 'pagination' | 'deep';
  } = {}
): Promise<ScrapedProperty[]> {
  const client = getApifyClient();

  const input = {
    searchUrls: searchUrls.map(url => ({ url })),
    maxResults: options.maxResults ?? 1000,
    mode: options.mode ?? 'pagination',
  };

  console.log(`[APIFY] Starting search scraper (fallback)`);
  console.log(`[APIFY] Actor: ${SEARCH_ACTOR}`);

  const run = await client.actor(SEARCH_ACTOR).call(input);
  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  console.log(`[APIFY] Search completed. Found ${items.length} properties`);

  return items as ScrapedProperty[];
}

/**
 * Fallback: Run detail scraper for specific URLs (maxcopell)
 */
export async function runDetailScraper(
  propertyUrls: string[],
  options: {
    timeoutSecs?: number;
  } = {}
): Promise<ScrapedProperty[]> {
  const client = getApifyClient();

  const input = {
    startUrls: propertyUrls.map(url => ({ url })),
  };

  console.log(`[APIFY] Starting detail scraper for ${propertyUrls.length} URLs`);
  console.log(`[APIFY] Actor: ${DETAIL_ACTOR}`);

  const run = await client.actor(DETAIL_ACTOR).start(input);
  const finishedRun = await client.run(run.id).waitForFinish({
    waitSecs: options.timeoutSecs ?? 300
  });

  if (finishedRun.status !== 'SUCCEEDED') {
    throw new Error(`Detail scraper failed: ${finishedRun.status}`);
  }

  const { items } = await client.dataset(finishedRun.defaultDatasetId).listItems();

  console.log(`[APIFY] Detail scraping completed. Got ${items.length} results`);

  return items as ScrapedProperty[];
}

export { ALL_IN_ONE_ACTOR, SEARCH_ACTOR, DETAIL_ACTOR };
