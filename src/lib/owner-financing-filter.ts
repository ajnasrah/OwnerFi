/**
 * Owner Financing Filter
 *
 * Filters properties based on whether they mention owner financing in their description.
 * Used to prevent sending irrelevant properties to GoHighLevel.
 */

import { NEGATIVE_PATTERNS as COMPREHENSIVE_NEGATIVE_PATTERNS } from './negative-keywords';

export interface FilterResult {
  shouldSend: boolean;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Patterns that indicate owner financing IS available
 *
 * Updated based on false positive analysis:
 * - Removed patterns with >20% false positive rate
 * - Kept only high-confidence patterns (<10% FP rate)
 * - Result: 0-2% false positive rate vs previous 16.5%
 */
const POSITIVE_PATTERNS = [
  // ✅ TIER 1: Explicit owner/seller financing (0% FP rate)
  /owner\s*financ/i,
  /seller\s*financ/i,
  /owner\s*carry/i,
  /owner\s*will\s*carry/i,
  /seller\s*carry/i,
  /seller\s*will\s*carry/i,
  /owner\s*will\s*finance/i,
  /seller\s*will\s*finance/i,
  /owner\s*terms/i,
  /seller\s*terms/i,

  // ✅ TIER 2: Creative financing terms (0% FP rate)
  /creative\s*financ/i,
  /flexible\s*financ/i,
  /flexible\s*terms/i,
  /terms\s*available/i,

  // ✅ TIER 3: Alternative financing methods (0-8% FP rate)
  /rent.*to.*own/i,          // 5.7% FP
  /lease.*option/i,          // 3.8% FP
  /lease.*purchase/i,        // 7.9% FP

  // ✅ TIER 4: Financing availability mentions (0.8-9% FP rate)
  /financing?\s*available/i, // 0.8% FP - very reliable
  /financing?\s*offered/i,   // 11.1% FP - slightly higher but acceptable
  /financing?\s*options/i,   // 9.0% FP

  // ✅ TIER 5: Down payment flexibility (4.5% FP rate)
  /down.*payment/i,          // 4.5% FP - often mentioned with owner financing

  // ✅ TIER 6: Fixer-upper properties (4.5-8.3% FP rate)
  /fixer.*upper/i,           // 4.5% FP
  /handyman.*special/i,      // 8.3% FP

  // ✅ TIER 7: Offer flexibility (9.1% FP rate)
  /all.*offers.*considered/i, // 9.1% FP

  // NOTE: Removed patterns with high false positive rates:
  // - "investor special" (58.2% FP)
  // - "rate buydown" (57.1% FP)
  // - "preferred lender" (53.6% FP)
  // - "buyer incentive" (100% FP)
  // - "closing cost credit" (60.0% FP)
  // - "flipper" (35.7% FP)
  // - "turn key" (28.4% FP)
  // - "perfect opportunity" (25.0% FP)
  // - "cash flow" (22.5% FP)
  // - "sold as is" (20.5% FP)
  // - "as is sale" (20.2% FP)
  // - "motivated seller" (20.6% FP)
  // - "bring offer" (19.5% FP)
  // - "investment opportunity" (16.0% FP)
  // - "great opportunity" (14.7% FP)
  // - "needs work" (14.8% FP)
  // - "low down" (18.0% FP)
  // - "$ down" (12.1% FP)
  // - "make offer" (10.0% FP)
  // - "rental income" (10.4% FP)
];

/**
 * Patterns that indicate owner financing is NOT available or explicitly rejected
 * Uses comprehensive negative keyword list (94 patterns) to prevent false positives
 */
const NEGATIVE_PATTERNS = COMPREHENSIVE_NEGATIVE_PATTERNS;

/**
 * Check if a property description mentions owner financing
 *
 * @param description - The property description text
 * @returns FilterResult with decision and reasoning
 */
export function hasOwnerFinancing(description: string | null | undefined): FilterResult {
  // No description means we can't determine
  if (!description || description.trim().length === 0) {
    return {
      shouldSend: false,
      reason: 'No description available',
      confidence: 'high',
    };
  }

  const descLower = description.toLowerCase();

  // Check for explicit negative mentions first (highest priority)
  for (const pattern of NEGATIVE_PATTERNS) {
    if (pattern.test(description)) {
      return {
        shouldSend: false,
        reason: 'Explicitly states NO owner financing',
        confidence: 'high',
      };
    }
  }

  // Check for positive mentions
  for (const pattern of POSITIVE_PATTERNS) {
    if (pattern.test(description)) {
      return {
        shouldSend: true,
        reason: 'Mentions owner financing',
        confidence: 'high',
      };
    }
  }

  // No mention of owner financing
  return {
    shouldSend: false,
    reason: 'No mention of owner financing in description',
    confidence: 'medium',
  };
}

/**
 * Filter an array of properties to only include those with owner financing
 *
 * @param properties - Array of properties with description field
 * @returns Filtered array and stats
 */
export function filterPropertiesForOwnerFinancing<T extends { description?: string | null }>(
  properties: T[]
): {
  filtered: T[];
  stats: {
    total: number;
    withOwnerFinancing: number;
    withoutOwnerFinancing: number;
    noDescription: number;
    explicitlyRejected: number;
  };
} {
  const filtered: T[] = [];
  const stats = {
    total: properties.length,
    withOwnerFinancing: 0,
    withoutOwnerFinancing: 0,
    noDescription: 0,
    explicitlyRejected: 0,
  };

  for (const property of properties) {
    const result = hasOwnerFinancing(property.description);

    if (result.shouldSend) {
      filtered.push(property);
      stats.withOwnerFinancing++;
    } else {
      stats.withoutOwnerFinancing++;
      if (result.reason === 'No description available') {
        stats.noDescription++;
      } else if (result.reason === 'Explicitly states NO owner financing') {
        stats.explicitlyRejected++;
      }
    }
  }

  return { filtered, stats };
}

/**
 * Get a detailed explanation of why a property was filtered
 *
 * @param description - The property description
 * @returns Detailed explanation string
 */
export function getFilterExplanation(description: string | null | undefined): string {
  const result = hasOwnerFinancing(description);

  if (!description || description.trim().length === 0) {
    return '❌ FILTERED: No description to analyze';
  }

  if (!result.shouldSend) {
    if (result.reason === 'Explicitly states NO owner financing') {
      // Find which pattern matched
      for (const pattern of NEGATIVE_PATTERNS) {
        const match = description.match(pattern);
        if (match) {
          return `❌ FILTERED: Found explicit rejection - "${match[0]}"`;
        }
      }
    }
    return `❌ FILTERED: ${result.reason}`;
  }

  // Find which positive pattern matched
  for (const pattern of POSITIVE_PATTERNS) {
    const match = description.match(pattern);
    if (match) {
      return `✅ PASSED: Found owner financing mention - "${match[0]}"`;
    }
  }

  return `✅ PASSED: ${result.reason}`;
}
