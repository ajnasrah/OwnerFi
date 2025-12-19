/**
 * Unified Scraper v2
 *
 * TWO SEARCHES - Both run twice daily (9 AM & 9 PM):
 * 1. Owner Finance Search (nationwide with keyword filters)
 * 2. Cash Deals Search (regional AR/TN, no keywords)
 *
 * ALL properties from BOTH searches:
 * - Run through owner finance filter → zillow_imports if passes
 * - Run through cash deals filter (< 80% ARV) → cash_houses if passes
 *
 * ONLY Cash Deals Regional properties → GHL webhook
 *
 * API Endpoints:
 * - GET /api/v2/scraper/run - Main cron endpoint (9 AM + 9 PM daily)
 * - POST /api/v2/scraper/add - Manual property add (bookmarklet)
 *
 * Files:
 * - firebase-admin.ts - Shared Firebase Admin singleton
 * - apify-client.ts - Apify client with search + detail scrapers
 * - search-config.ts - Search URLs and configuration
 * - unified-filter.ts - Runs both owner finance + cash deal filters
 * - property-transformer.ts - Transforms raw data to standardized format
 * - cron-lock.ts - Prevents concurrent execution
 * - ghl-webhook.ts - GHL webhook integration for Cash Deals Regional
 */

export { getFirebaseAdmin, FieldValue } from './firebase-admin';
export {
  getApifyClient,
  runAllInOneScraper,
  runSearchScraper,
  runDetailScraper,
  type ScrapedProperty,
} from './apify-client';
export {
  SEARCH_CONFIGS,
  SAFETY_LIMITS,
  GHL_WEBHOOK_URL,
  getAllSearchUrls,
  getTotalMaxItems,
  getGHLConfigs,
  type SearchConfig,
} from './search-config';
export {
  runUnifiedFilter,
  logFilterResult,
  calculateFilterStats,
  logFilterStats,
  type FilterResult,
  type FilterStats,
} from './unified-filter';
export {
  transformProperty,
  validateProperty,
  createZillowImportsDoc,
  createCashHousesDoc,
  type TransformedProperty,
} from './property-transformer';
export { withScraperLock, acquireCronLock, releaseCronLock } from './cron-lock';
export {
  sendToGHLWebhook,
  sendBatchToGHLWebhook,
  toGHLPayload,
  type GHLPropertyPayload,
} from './ghl-webhook';
