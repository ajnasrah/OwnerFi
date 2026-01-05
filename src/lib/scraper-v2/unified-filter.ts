/**
 * Unified Property Filter v2
 *
 * Runs BOTH filters on EVERY property:
 * 1. Owner Finance Filter → properties with isOwnerFinance=true
 * 2. Cash Deal Filter (price < 80% Zestimate) → properties with isCashDeal=true
 *
 * IMPORTANT (Jan 2026):
 * - Cash deals now REQUIRE actual discount (< 80% zestimate)
 * - "needsWork" is metadata only, NOT a standalone qualifier
 * - This prevents false positives from keyword matching
 *
 * A single property can match BOTH filters.
 */

import { hasStrictOwnerFinancing } from '../owner-financing-filter-strict';
import { hasNegativeKeywords } from '../negative-keywords';
import { detectNeedsWorkWithKeywords } from '../property-needs-work-detector';
import { detectFinancingType, FinancingTypeResult } from '../financing-type-detector';

export interface FilterResult {
  // Owner Finance Filter
  passesOwnerFinance: boolean;
  ownerFinanceKeywords: string[];
  primaryOwnerFinanceKeyword?: string;
  financingType: FinancingTypeResult;

  // Cash Deal Filter
  passesCashDeal: boolean;
  cashDealReason?: 'discount' | 'needs_work' | 'both';
  discountPercentage?: number;
  eightyPercentOfZestimate?: number;
  needsWork: boolean;
  needsWorkKeywords: string[];

  // UNIFIED: Deal types array for single collection
  dealTypes: ('owner_finance' | 'cash_deal')[];
  isOwnerFinance: boolean;
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
 */
export function runUnifiedFilter(
  description: string | null | undefined,
  price: number | undefined,
  zestimate: number | undefined
): FilterResult {
  // ===== OWNER FINANCE FILTER =====
  const ownerFinanceResult = hasStrictOwnerFinancing(description);
  const negativeResult = hasNegativeKeywords(description);
  const financingType = detectFinancingType(description);

  // Owner finance passes if: has positive keywords AND no negative keywords
  const passesOwnerFinance = ownerFinanceResult.passes && !negativeResult.hasNegative;

  // ===== CASH DEAL FILTER =====
  // Use combined function for single-pass efficiency (avoids scanning description twice)
  const needsWorkResult = detectNeedsWorkWithKeywords(description);
  const needsWork = needsWorkResult.needsWork;
  const needsWorkKeywords = needsWorkResult.matchedKeywords;

  // Calculate discount percentage
  let discountPercentage: number | undefined;
  let eightyPercentOfZestimate: number | undefined;
  let meetsDiscountCriteria = false;

  if (price && price > 0 && zestimate && zestimate > 0) {
    eightyPercentOfZestimate = zestimate * 0.8;
    discountPercentage = ((zestimate - price) / zestimate) * 100;
    meetsDiscountCriteria = price < eightyPercentOfZestimate;
  }

  // Cash deal passes if: price < 80% Zestimate (actual discount required)
  // needsWork is now metadata only, not a standalone qualifier
  // This prevents false positives from keyword matching alone
  const passesCashDeal = meetsDiscountCriteria;

  // Determine cash deal reason
  let cashDealReason: 'discount' | 'needs_work' | 'both' | undefined;
  if (passesCashDeal) {
    // Only set reason if it actually passes (has discount)
    cashDealReason = needsWork ? 'both' : 'discount';
  }

  // ===== DETERMINE DEAL TYPES (UNIFIED) =====
  const dealTypes: ('owner_finance' | 'cash_deal')[] = [];

  if (passesOwnerFinance) {
    dealTypes.push('owner_finance');
  }

  if (passesCashDeal) {
    dealTypes.push('cash_deal');
  }

  // Should save if passes ANY filter
  const shouldSave = passesOwnerFinance || passesCashDeal;

  // DEPRECATED: Legacy target collections for backwards compatibility
  const targetCollections: ('zillow_imports' | 'cash_houses')[] = [];
  if (passesOwnerFinance) targetCollections.push('zillow_imports');
  if (passesCashDeal) targetCollections.push('cash_houses');

  return {
    // Owner Finance
    passesOwnerFinance,
    ownerFinanceKeywords: ownerFinanceResult.matchedKeywords,
    primaryOwnerFinanceKeyword: ownerFinanceResult.primaryKeyword,
    financingType,

    // Cash Deal
    passesCashDeal,
    cashDealReason,
    discountPercentage,
    eightyPercentOfZestimate,
    needsWork,
    needsWorkKeywords,

    // UNIFIED: New fields for single collection
    dealTypes,
    isOwnerFinance: passesOwnerFinance,
    isCashDeal: passesCashDeal,
    shouldSave,

    // DEPRECATED: Legacy fields for backwards compatibility
    shouldSaveToZillowImports: passesOwnerFinance,
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
  const { passesOwnerFinance, passesCashDeal, targetCollections } = filterResult;

  if (targetCollections.length === 0) {
    console.log(`   [SKIP] ${address} - No filters passed`);
    return;
  }

  const badges: string[] = [];

  if (passesOwnerFinance) {
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
  passedOwnerFinance: number;
  passedCashDeal: number;
  passedBoth: number;
  passedNeither: number;
  savedToZillowImports: number;
  savedToCashHouses: number;
}

export function calculateFilterStats(results: FilterResult[]): FilterStats {
  return {
    total: results.length,
    passedOwnerFinance: results.filter(r => r.passesOwnerFinance).length,
    passedCashDeal: results.filter(r => r.passesCashDeal).length,
    passedBoth: results.filter(r => r.passesOwnerFinance && r.passesCashDeal).length,
    passedNeither: results.filter(r => !r.passesOwnerFinance && !r.passesCashDeal).length,
    savedToZillowImports: results.filter(r => r.shouldSaveToZillowImports).length,
    savedToCashHouses: results.filter(r => r.shouldSaveToCashHouses).length,
  };
}

export function logFilterStats(stats: FilterStats): void {
  console.log(`\n========== FILTER STATISTICS ==========`);
  console.log(`Total Properties: ${stats.total}`);
  console.log(`----------------------------------------`);
  console.log(`Owner Finance Filter:`);
  console.log(`  - Passed: ${stats.passedOwnerFinance} (${((stats.passedOwnerFinance / stats.total) * 100).toFixed(1)}%)`);
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
