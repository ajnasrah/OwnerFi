/**
 * Detects if a property needs work based on keywords in description
 * Used for filtering investor/cash deal properties
 */

export const NEEDS_WORK_KEYWORDS = [
  // Explicit fixer keywords
  'handyman',
  'investor special',
  'investors only',
  'as is',
  'as-is',
  'fixer',
  'fixer upper',
  'fixer-upper',
  'fixerupper',
  'tlc',
  't.l.c',
  'needs tlc',

  // Renovation/repair keywords (specific phrases to avoid false positives)
  'needs renovation',
  'needs to be renovated',
  'rehab',
  'needs rehab',
  'restore',
  'restoration needed',
  'needs restoration',
  'needs remodel',
  'repair',
  'repairs',
  'needs work',
  'needs repairs',
  'needs updating',

  // Condition keywords
  'distressed',
  'estate sale',
  'foreclosure',
  'short sale',
  'motivated seller',
  'cash only',
  'cash buyers only',
  'sold as is',
  'selling as is',

  // Specific issues
  'foundation work',
  'foundation issues',
  'roof repair',
  'needs roof',
  'needs new roof',
  'water damage',
  'fire damage',
  'cosmetic work',
  'needs cosmetic',
  'cosmetic updates needed',
  'outdated',
  'original condition',

  // Investment keywords
  'flip',
  'flip opportunity',
  'flipping opportunity',
  'investment opportunity',
  'wholesale',
  'bring your tools',
  'bring your contractor',
  'sweat equity',
  'profit potential',
  'arv',
  'below market',
  'below arv',
  'quick sale',
  'must sell',
  'priced to sell',
];

/**
 * Check if property description contains "needs work" keywords
 * @param description - Property description text
 * @returns true if property likely needs work
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
