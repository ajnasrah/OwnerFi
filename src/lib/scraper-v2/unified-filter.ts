/**
 * Unified Property Filter v2
 *
 * Runs BOTH filters on EVERY property:
 * 1. Owner Finance Filter → properties with isOwnerfinance=true
 * 2. Cash Deal Filter (price < 80% Zestimate) → properties with isCashDeal=true
 *
 * IMPORTANT (Jan 2026):
 * - Cash deals now REQUIRE actual discount (< 80% zestimate)
 * - "needsWork" is metadata only, NOT a standalone qualifier
 * - This prevents false positives from keyword matching
 *
 * A single property can match BOTH filters.
 */

import { hasStrictOwnerfinancing } from '../owner-financing-filter-strict';
import { hasNegativeKeywords } from '../negative-keywords';
import { detectNeedsWorkWithKeywords } from '../property-needs-work-detector';
import { detectFinancingType, FinancingTypeResult } from '../financing-type-detector';

/**
 * Gap above which we hide the Zestimate and label the deal a "Fixer".
 * When zestimate - price > this threshold the raw Zestimate is unreliable.
 * The property stays in cash deals but the estimate/discount are suppressed
 * from the UI — buyers see "Fixer" badge only, no bogus numbers.
 */
const FIXER_GAP_THRESHOLD = 150_000;

export interface FilterResult {
  // Owner Finance Filter
  passesOwnerfinance: boolean;
  ownerFinanceKeywords: string[];
  primaryOwnerfinanceKeyword?: string;
  financingType: FinancingTypeResult;

  // Cash Deal Filter
  passesCashDeal: boolean;
  cashDealReason?: 'discount' | 'needs_work' | 'both' | 'fixer';
  discountPercentage?: number;
  eightyPercentOfZestimate?: number;
  needsWork: boolean;
  needsWorkKeywords: string[];

  // Fixer: when zestimate – price > $150k, the Zestimate is unreliable.
  // UI should hide estimate/discount and show "Fixer" badge instead.
  isFixer: boolean;

  // Land detection
  isLand: boolean;

  // Suspicious discount warning (price < 50% of Zestimate — likely bad data)
  suspiciousDiscount: boolean;

  // UNIFIED: Deal types array for single collection
  dealTypes: ('owner_finance' | 'cash_deal')[];
  isOwnerfinance: boolean;
  isCashDeal: boolean;

  // Whether to save to the unified 'properties' collection
  shouldSave: boolean;

  // DEPRECATED: Legacy fields for backwards compatibility during migration
  shouldSaveToZillowImports: boolean;
  shouldSaveToCashHouses: boolean;
  targetCollections: ('zillow_imports' | 'cash_houses')[];
}

/**
 * Run both filters on a property
 * @param homeType - Normalized home type (e.g. 'land', 'single-family'). Used to flag land properties.
 * @param listingFlags - Auction / foreclosure / bank-owned flags. Distressed listings
 *   are never tagged owner_finance (price is a starting bid / estimate, not asking).
 */
export function runUnifiedFilter(
  description: string | null | undefined,
  price: number | undefined,
  zestimate: number | undefined,
  homeType?: string,
  listingFlags?: { isAuction?: boolean; isForeclosure?: boolean; isBankOwned?: boolean }
): FilterResult {
  // ===== LAND DETECTION =====
  const isLand = homeType === 'land';

  // ===== DISTRESSED LISTING DETECTION =====
  // Auctions, foreclosures, and bank-owned properties never qualify for
  // owner-finance classification — the posted price isn't a seller's asking
  // price, and the concept of "owner financing" doesn't apply to these sales.
  const isDistressedListing = Boolean(
    listingFlags?.isAuction || listingFlags?.isForeclosure || listingFlags?.isBankOwned
  );

  // ===== OWNER FINANCE FILTER =====
  const ownerFinanceResult = hasStrictOwnerfinancing(description);
  const negativeResult = hasNegativeKeywords(description);
  const financingType = detectFinancingType(description);

  // Owner finance passes if: has positive keywords AND no negative keywords
  // AND the listing is not distressed (auction/foreclosure/REO).
  const passesOwnerfinance =
    ownerFinanceResult.passes && !negativeResult.hasNegative && !isDistressedListing;

  // ===== CASH DEAL FILTER =====
  // Use combined function for single-pass efficiency (avoids scanning description twice)
  const needsWorkResult = detectNeedsWorkWithKeywords(description);
  const needsWork = needsWorkResult.needsWork;
  const needsWorkKeywords = needsWorkResult.matchedKeywords;

  // Calculate discount percentage
  let discountPercentage: number = 0;
  let eightyPercentOfZestimate: number | undefined;
  let meetsDiscountCriteria = false;

  if (price && price > 0 && zestimate && zestimate > 0) {
    eightyPercentOfZestimate = zestimate * 0.8;
    discountPercentage = ((zestimate - price) / zestimate) * 100;
    // Guard against Infinity/NaN
    if (!isFinite(discountPercentage)) discountPercentage = 0;
    meetsDiscountCriteria = price < eightyPercentOfZestimate;
  }

  // Cash deal passes if: price < 80% Zestimate (actual discount required)
  // needsWork is now metadata only, not a standalone qualifier
  // This prevents false positives from keyword matching alone
  const passesCashDeal = meetsDiscountCriteria;

  // Flag suspicious discounts: price < 50% of Zestimate is almost always bad data
  // (auctions, tax sales, data errors). These still save but get flagged for review.
  const suspiciousDiscount = !!(price && price > 0 && zestimate && zestimate > 0 && price < zestimate * 0.5);

  // ===== FIXER DETECTION =====
  // When the Zestimate gap exceeds $150k, the Zestimate is unreliable.
  // The deal stays in cash deals but UI hides estimate/discount and shows
  // "Fixer" badge — let buyers do their own due diligence.
  const gap = (price && zestimate) ? (zestimate - price) : 0;
  const isFixer = passesCashDeal && gap > FIXER_GAP_THRESHOLD;

  // Determine cash deal reason
  let cashDealReason: 'discount' | 'needs_work' | 'both' | 'fixer' | undefined;
  if (passesCashDeal) {
    if (isFixer) {
      cashDealReason = 'fixer';
    } else if (needsWork) {
      cashDealReason = 'both';
    } else {
      cashDealReason = 'discount';
    }
  }

  // ===== DETERMINE DEAL TYPES (UNIFIED) =====
  const dealTypes: ('owner_finance' | 'cash_deal')[] = [];

  if (passesOwnerfinance) {
    dealTypes.push('owner_finance');
  }

  if (passesCashDeal) {
    dealTypes.push('cash_deal');
  }

  // Should save if passes ANY filter
  const shouldSave = passesOwnerfinance || passesCashDeal;

  // DEPRECATED: Legacy target collections for backwards compatibility
  const targetCollections: ('zillow_imports' | 'cash_houses')[] = [];
  if (passesOwnerfinance) targetCollections.push('zillow_imports');
  if (passesCashDeal) targetCollections.push('cash_houses');

  return {
    // Owner Finance
    passesOwnerfinance,
    ownerFinanceKeywords: ownerFinanceResult.matchedKeywords,
    primaryOwnerfinanceKeyword: ownerFinanceResult.primaryKeyword,
    financingType,

    // Cash Deal
    passesCashDeal,
    cashDealReason,
    discountPercentage,
    eightyPercentOfZestimate,
    needsWork,
    needsWorkKeywords,

    // Fixer flag — UI must hide estimate + discount when true
    isFixer,

    // Land detection
    isLand,

    // Suspicious discount warning
    suspiciousDiscount,

    // UNIFIED: New fields for single collection
    dealTypes,
    isOwnerfinance: passesOwnerfinance,
    isCashDeal: passesCashDeal,
    shouldSave,

    // DEPRECATED: Legacy fields for backwards compatibility
    shouldSaveToZillowImports: passesOwnerfinance,
    shouldSaveToCashHouses: passesCashDeal,
    targetCollections,
  };
}

/**
 * Log filter result for debugging
 */
export function logFilterResult(
  address: string,
  filterResult: FilterResult,
  _price?: number,
  _zestimate?: number
): void {
  const { passesOwnerfinance, passesCashDeal, targetCollections } = filterResult;

  if (targetCollections.length === 0) {
    console.log(`   [SKIP] ${address} - No filters passed`);
    return;
  }

  const badges: string[] = [];

  if (passesOwnerfinance) {
    badges.push(`OF: ${filterResult.ownerFinanceKeywords.slice(0, 2).join(', ')}`);
  }

  if (passesCashDeal) {
    if (filterResult.cashDealReason === 'discount') {
      badges.push(`CASH: ${filterResult.discountPercentage?.toFixed(1)}% off`);
    } else if (filterResult.cashDealReason === 'needs_work') {
      badges.push(`CASH: needs work`);
    } else {
      badges.push(`CASH: ${filterResult.discountPercentage?.toFixed(1)}% off + needs work`);
    }
  }

  const collectionsStr = targetCollections.join(' + ');
  console.log(`   [SAVE] ${address} → ${collectionsStr} [${badges.join(' | ')}]`);
}

/**
 * Summary stats for a batch of filter results
 */
export interface FilterStats {
  total: number;
  passedOwnerfinance: number;
  passedCashDeal: number;
  passedBoth: number;
  passedNeither: number;
  savedToZillowImports: number;
  savedToCashHouses: number;
}

export function calculateFilterStats(results: FilterResult[]): FilterStats {
  return {
    total: results.length,
    passedOwnerfinance: results.filter(r => r.passesOwnerfinance).length,
    passedCashDeal: results.filter(r => r.passesCashDeal).length,
    passedBoth: results.filter(r => r.passesOwnerfinance && r.passesCashDeal).length,
    passedNeither: results.filter(r => !r.passesOwnerfinance && !r.passesCashDeal).length,
    savedToZillowImports: results.filter(r => r.shouldSaveToZillowImports).length,
    savedToCashHouses: results.filter(r => r.shouldSaveToCashHouses).length,
  };
}

export function logFilterStats(stats: FilterStats): void {
  console.log(`\n========== FILTER STATISTICS ==========`);
  console.log(`Total Properties: ${stats.total}`);
  console.log(`----------------------------------------`);
  console.log(`Owner Finance Filter:`);
  console.log(`  - Passed: ${stats.passedOwnerfinance} (${((stats.passedOwnerfinance / stats.total) * 100).toFixed(1)}%)`);
  console.log(`Cash Deal Filter:`);
  console.log(`  - Passed: ${stats.passedCashDeal} (${((stats.passedCashDeal / stats.total) * 100).toFixed(1)}%)`);
  console.log(`----------------------------------------`);
  console.log(`Passed BOTH Filters: ${stats.passedBoth}`);
  console.log(`Passed NEITHER Filter: ${stats.passedNeither}`);
  console.log(`----------------------------------------`);
  console.log(`Will Save To:`);
  console.log(`  - zillow_imports: ${stats.savedToZillowImports}`);
  console.log(`  - cash_houses: ${stats.savedToCashHouses}`);
  console.log(`========================================\n`);
}
