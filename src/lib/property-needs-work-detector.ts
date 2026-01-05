/**
 * Detects if a property needs work based on keywords in description
 * Used for filtering investor/cash deal properties
 */

/**
 * STRICT keywords that indicate a property genuinely needs work.
 *
 * REMOVED false positives (Jan 2026):
 * - "repair/repairs" - too generic, matches "repairs completed"
 * - "outdated" - matches "no longer outdated"
 * - "vacant/rental property/income property/cash flow/section 8" - rental indicators, not condition
 * - "priced to sell/price reduced/price drop" - normal marketing
 * - "great bones/good bones/solid bones/hidden gem" - positive descriptors
 * - "flip/investment opportunity/great investment" - investment indicators
 * - "auction/quick close/fast close" - transaction type, not condition
 * - Generic "potential" phrases - too broad
 */
export const NEEDS_WORK_KEYWORDS = [
  // Explicit fixer keywords (HIGH CONFIDENCE)
  'handyman special',
  'investor special',
  'investors only',
  'investor only',
  'fixer upper',
  'fixer-upper',
  'fixerupper',
  'needs tlc',
  'little tlc',
  'some tlc',

  // As-is indicators (HIGH CONFIDENCE)
  'sold as is',
  'selling as is',
  'being sold as is',
  'as is where is',

  // Renovation keywords (SPECIFIC PHRASES ONLY)
  'needs renovation',
  'needs to be renovated',
  'needs rehab',
  'rehab project',
  'needs restoration',
  'needs remodel',
  'needs remodeling',
  'needs work',
  'needs repairs',
  'needs updating',
  'needs updates',
  'needs some work',
  'needs a little work',
  'complete renovation',
  'total renovation',
  'gut renovation',
  'gut rehab',

  // Distress indicators (HIGH CONFIDENCE)
  'distressed',
  'foreclosure',
  'pre-foreclosure',
  'reo',
  'bank owned',
  'bank-owned',
  'short sale',
  'cash only',
  'cash buyers only',

  // Structural/major issues (HIGH CONFIDENCE)
  'foundation issues',
  'foundation problems',
  'structural issues',
  'structural damage',
  'needs roof',
  'needs new roof',
  'roof issues',
  'water damage',
  'fire damage',
  'smoke damage',
  'mold',
  'termite damage',
  'deferred maintenance',
  'hvac issues',
  'needs hvac',
  'plumbing issues',
  'electrical issues',
  'needs electrical',
  'needs plumbing',

  // Investor-focused phrases (SPECIFIC)
  'wholesale deal',
  'bring your contractor',
  'sweat equity',
  'arv',
  'after repair value',
  'below arv',
];

/**
 * Combined detection result - avoids scanning description twice
 */
export interface NeedsWorkResult {
  needsWork: boolean;
  matchedKeywords: string[];
}

/**
 * Detect if property needs work AND get matching keywords in a single pass
 * This is more efficient than calling detectNeedsWork() and getMatchingKeywords() separately
 * @param description - Property description text
 * @returns Object with needsWork boolean and array of matched keywords
 */
export function detectNeedsWorkWithKeywords(description: string | null | undefined): NeedsWorkResult {
  if (!description) return { needsWork: false, matchedKeywords: [] };

  const lowerDescription = description.toLowerCase();
  const matchedKeywords: string[] = [];

  // Single pass through keywords
  for (const keyword of NEEDS_WORK_KEYWORDS) {
    if (lowerDescription.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword);
    }
  }

  return {
    needsWork: matchedKeywords.length > 0,
    matchedKeywords,
  };
}

/**
 * Check if property description contains "needs work" keywords
 * @param description - Property description text
 * @returns true if property likely needs work
 * @deprecated Use detectNeedsWorkWithKeywords() for better performance
 */
export function detectNeedsWork(description: string | null | undefined): boolean {
  if (!description) return false;

  const lowerDescription = description.toLowerCase();

  // Check if any keyword is found in the description
  return NEEDS_WORK_KEYWORDS.some(keyword => {
    return lowerDescription.includes(keyword.toLowerCase());
  });
}

/**
 * Get all matching keywords found in description
 * @param description - Property description text
 * @returns Array of keywords that were found
 * @deprecated Use detectNeedsWorkWithKeywords() for better performance
 */
export function getMatchingKeywords(description: string | null | undefined): string[] {
  if (!description) return [];

  const lowerDescription = description.toLowerCase();

  return NEEDS_WORK_KEYWORDS.filter(keyword => {
    return lowerDescription.includes(keyword.toLowerCase());
  });
}

/**
 * Calculate a "needs work" score based on number of matching keywords
 * @param description - Property description text
 * @returns Number from 0-100 indicating likelihood property needs work
 */
export function calculateNeedsWorkScore(description: string | null | undefined): number {
  if (!description) return 0;

  const matchingKeywords = getMatchingKeywords(description);

  // Each keyword adds to the score (max 100)
  const score = Math.min(100, matchingKeywords.length * 10);

  return score;
}
