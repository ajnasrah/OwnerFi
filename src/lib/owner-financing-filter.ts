/**
 * Owner Financing Filter
 *
 * Filters properties based on whether they mention owner financing in their description.
 * Used to prevent sending irrelevant properties to GoHighLevel.
 */

export interface FilterResult {
  shouldSend: boolean;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Patterns that indicate owner financing IS available
 */
const POSITIVE_PATTERNS = [
  // Explicit owner/seller financing mentions
  /owner\s*financ/i,
  /seller\s*financ/i,
  /owner\s*carry/i,
  /seller\s*carry/i,
  /owner\s*will\s*finance/i,
  /seller\s*will\s*finance/i,

  // Generic financing availability
  /financing?\s*available/i,
  /financing?\s*offered/i,
  /financing?\s*options/i,

  // Flexible/creative terms
  /creative\s*financ/i,
  /flexible\s*financ/i,
  /terms\s*available/i,
  /owner\s*terms/i,
  /seller\s*terms/i,
  /flexible\s*terms/i,

  // Buyer incentives and assistance
  /buyer\s*incentive/i,
  /closing\s*cost.*credit/i,
  /rate\s*buy.*down/i,
  /preferred\s*lender/i,

  // Investor-friendly indicators
  /investor\s*special/i,
  /cash\s*flow/i,
  /rental\s*income/i,
  /investment\s*opportunity/i,
  /great\s*opportunity/i,
  /perfect\s*opportunity/i,
  /flipper/i,
  /fixer.*upper/i,

  // Rent-to-own and alternative financing
  /rent.*to.*own/i,
  /lease.*option/i,
  /lease.*purchase/i,

  // Motivated seller / AS-IS indicators
  /sold\s*as.*is/i,
  /as.*is.*sale/i,
  /motivated\s*seller/i,
  /bring.*offer/i,
  /make.*offer/i,
  /all.*offers.*considered/i,

  // Down payment / payment flexibility
  /low.*down/i,
  /down.*payment/i,
  /\$.*down/i,

  // Additional investor language
  /turn.*key/i,
  /handyman.*special/i,
  /needs.*work/i,
];

/**
 * Patterns that indicate owner financing is NOT available or explicitly rejected
 */
const NEGATIVE_PATTERNS = [
  /no\s*owner\s*financ/i,
  /not\s*owner\s*financ/i,
  /owner\s*financ.*not\s*available/i,
  /seller\s*financ.*not\s*available/i,
  /no\s*seller\s*financ/i,
  /not\s*seller\s*financ/i,
  /cash\s*only/i,
  /conventional\s*financ.*only/i,
];

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
