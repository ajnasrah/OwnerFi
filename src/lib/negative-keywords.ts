/**
 * Comprehensive NEGATIVE keywords that explicitly indicate NO owner financing
 *
 * These keywords are used to filter OUT properties that don't offer owner financing.
 * Based on analysis of 166 false positives found in the database.
 *
 * IMPORTANT: This list is used by:
 * - owner-financing-filter.ts (scraper pipeline)
 * - owner-financing-filter-strict.ts (buyer-facing dashboard)
 * - All API endpoints that filter properties
 */

/**
 * Convert keyword strings to regex patterns
 */
export function keywordsToPatterns(keywords: string[]): RegExp[] {
  return keywords.map(keyword => {
    // Escape special regex characters
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Replace spaces with flexible whitespace matcher
    const flexible = escaped.replace(/\s+/g, '\\s*');
    return new RegExp(flexible, 'i');
  });
}

/**
 * Comprehensive negative keyword list
 */
export const NEGATIVE_KEYWORDS = [
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
  'no owner fin', // Truncated
  'no seller fin', // Truncated

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

  // ===== INVESTOR/WHOLESALE EXCLUSIONS =====
  'no wholesalers, no assignments, no owner financing',
  'no assignments, no owner financing',
  'no creative financing, no owner financing',
  'no owner financing or subject to',
  'no owner financing or creative',
  'no owner financing or wholesale',
  'no creative or owner financed offers',
  'no creative or owner financing offers',
  'no creative or owner financed',
  'no owner financed offers',
  'no wholesalers or owner financing',
  'no assignments or owner financing',
  'no contract sales or seller financing',
  'no contract or seller financing',
  'no contract sales or owner financing',
  'no contract or owner financing',

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
];

/**
 * Precompiled regex patterns for performance
 */
export const NEGATIVE_PATTERNS: RegExp[] = keywordsToPatterns(NEGATIVE_KEYWORDS);

/**
 * Check if description contains negative owner financing keywords
 */
export function hasNegativeKeywords(description: string | null | undefined): {
  hasNegative: boolean;
  matches: string[];
} {
  if (!description) {
    return { hasNegative: false, matches: [] };
  }

  const lowerDesc = description.toLowerCase();
  const matches: string[] = [];

  for (let i = 0; i < NEGATIVE_KEYWORDS.length; i++) {
    if (NEGATIVE_PATTERNS[i].test(description)) {
      matches.push(NEGATIVE_KEYWORDS[i]);
    }
  }

  return {
    hasNegative: matches.length > 0,
    matches,
  };
}
