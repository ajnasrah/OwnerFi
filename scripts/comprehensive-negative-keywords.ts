/**
 * Comprehensive list of NEGATIVE keywords that indicate NO owner financing
 * These properties should be EXCLUDED from the database
 *
 * Usage: Import this list in filters to prevent false positives
 */

export const COMPREHENSIVE_NEGATIVE_KEYWORDS = [
  // ===== EXPLICIT "NO" STATEMENTS =====
  'no owner financing',
  'no seller financing',
  'no creative financing',
  'no owner carry',
  'no seller carry',
  'no financing available',
  'no financing offered',
  'owner financing not available',
  'seller financing not available',
  'creative financing not available',
  'financing not available',
  'financing not offered',
  'not offering owner financing',
  'not offering seller financing',
  'not offering financing',
  'no owner finance',
  'no seller finance',
  'owner finance not available',
  'seller finance not available',
  'no owner fin', // Truncated version found in descriptions
  'no seller fin', // Truncated version

  // ===== CASH ONLY =====
  'cash only',
  'cash buyers only',
  'all cash only',
  'cash offers only',
  'cash sale only',
  'must be cash',
  'requires cash',
  'cash required',
  'cash purchase only',
  'cash or hard money only',
  'sold as-is cash only',
  'sold as is cash only',

  // ===== CASH OR CONVENTIONAL =====
  'cash or conventional',
  'cash or conventional financing',
  'cash or conventional loan',
  'cash or conventional offers',
  'cash or conventional only',
  'cash or traditional financing',
  'conventional financing only',
  'conventional loan only',
  'traditional financing only',
  'bank financing only',
  'cash and conventional only',

  // ===== VARIATIONS WITH "NOT" =====
  'not available for owner financing',
  'not available for seller financing',
  'not available for creative financing',
  'owner financing is not available',
  'seller financing is not available',
  'financing is not available',
  'will not carry',
  'will not finance',
  'cannot carry',
  'cannot finance',
  'does not offer financing',
  'do not offer financing',
  'not interested in owner financing',
  'not interested in seller financing',
  'not interested in creative financing',
  'seller is not interested in owner financing',

  // ===== FHA/VA RESTRICTIONS =====
  'fha or va only',
  'fha/va only',
  'va or fha only',
  'fha or conventional only',
  'will not go fha',
  'will not go va',
  'no fha or va',

  // ===== INVESTOR/WHOLESALE EXCLUSIONS (often paired with no owner financing) =====
  'no wholesalers, no assignments, no owner financing',
  'no assignments, no owner financing',
  'no creative financing, no owner financing',
  'no owner financing or subject to',
  'no owner financing or creative',
  'no owner financing or wholesale',

  // ===== ADDITIONAL VARIATIONS =====
  'no terms',
  'no seller terms',
  'no owner terms',
  'no financing terms',
  'terms not available',
  'no carry back',
  'no carryback',
  'seller will not carry',
  'owner will not carry',
  'no seller carry back',
  'no owner carry back',
  'no assumable',
  'no subject to',
  'no sub to',
  'no subject-to',

  // ===== EXPLICIT REJECTIONS =====
  'no owner financing offered',
  'no seller financing offered',
  'owner financing not offered',
  'seller financing not offered',
  'no creative finance is offered',
  'not looking to rent', // Sometimes paired with "no owner financing"
];

/**
 * Positive keywords that should ALLOW the property
 * (these override negative matches if they appear in the same context)
 */
export const POSITIVE_OVERRIDE_KEYWORDS = [
  'owner financing available',
  'seller financing available',
  'creative financing available',
  'owner financing offered',
  'seller financing offered',
  'owner will carry',
  'seller will carry',
  'owner carry available',
  'seller carry available',
  'flexible terms',
  'terms available',
  'financing available',
  'will consider owner financing',
  'will consider seller financing',
  'may consider owner financing',
  'may consider seller financing',
];

/**
 * Check if description has negative keywords (excludes owner financing)
 */
export function hasNegativeFinancingKeywords(description: string): {
  isNegative: boolean;
  negativeMatches: string[];
  positiveMatches: string[];
} {
  if (!description) {
    return { isNegative: false, negativeMatches: [], positiveMatches: [] };
  }

  const lowerDesc = description.toLowerCase();

  // Check for positive keywords first
  const positiveMatches: string[] = [];
  for (const keyword of POSITIVE_OVERRIDE_KEYWORDS) {
    if (lowerDesc.includes(keyword)) {
      positiveMatches.push(keyword);
    }
  }

  // Check for negative keywords
  const negativeMatches: string[] = [];
  for (const keyword of COMPREHENSIVE_NEGATIVE_KEYWORDS) {
    if (lowerDesc.includes(keyword)) {
      negativeMatches.push(keyword);
    }
  }

  // If there are BOTH positive and negative keywords, need manual review
  // But if negative is explicit like "no owner financing", it takes precedence
  const hasExplicitNegative = negativeMatches.some(match =>
    match.startsWith('no ') ||
    match.includes('not available') ||
    match.includes('cash only')
  );

  // Property is negative if:
  // 1. Has negative keywords AND no positive keywords, OR
  // 2. Has explicit negative keywords (even with positive keywords)
  const isNegative = negativeMatches.length > 0 && (
    positiveMatches.length === 0 ||
    hasExplicitNegative
  );

  return {
    isNegative,
    negativeMatches,
    positiveMatches,
  };
}

/**
 * Filter that checks if property should be INCLUDED
 * Returns false if property should be EXCLUDED (has negative keywords)
 */
export function shouldIncludeProperty(description: string): boolean {
  const { isNegative } = hasNegativeFinancingKeywords(description);
  return !isNegative;
}
