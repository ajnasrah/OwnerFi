/**
 * Detects if a property needs work based on keywords in description
 * Used for filtering investor/cash deal properties
 */

export const NEEDS_WORK_KEYWORDS = [
  // Explicit fixer keywords
  'handyman',
  'handyman special',
  'investor special',
  'investors only',
  'investor only',
  'as is',
  'as-is',
  'fixer',
  'fixer upper',
  'fixer-upper',
  'fixerupper',
  'tlc',
  't.l.c',
  'needs tlc',
  'little tlc',
  'some tlc',

  // Renovation/repair keywords (specific phrases to avoid false positives)
  'needs renovation',
  'needs to be renovated',
  'rehab',
  'needs rehab',
  'rehab project',
  'restoration project',
  'restore',
  'restoration needed',
  'needs restoration',
  'needs remodel',
  'needs remodeling',
  'repair',
  'repairs',
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

  // Condition keywords
  'distressed',
  'estate sale',
  'probate sale',
  'probate',
  'foreclosure',
  'pre-foreclosure',
  'reo',
  'bank owned',
  'bank-owned',
  'short sale',
  'motivated seller',
  'highly motivated',
  'very motivated',
  'cash only',
  'cash buyers only',
  'cash preferred',
  'sold as is',
  'selling as is',
  'being sold as is',
  'where is',
  'as is where is',

  // Specific issues
  'foundation work',
  'foundation issues',
  'foundation problems',
  'structural issues',
  'structural work',
  'roof repair',
  'roof replacement',
  'needs roof',
  'needs new roof',
  'roof issues',
  'water damage',
  'fire damage',
  'smoke damage',
  'mold',
  'termite damage',
  'cosmetic work',
  'needs cosmetic',
  'cosmetic updates needed',
  'cosmetic repairs',
  'outdated',
  'original condition',
  'dated kitchen',
  'dated bathrooms',
  'dated interior',
  'dated finishes',
  'very dated',
  'extremely dated',
  'deferred maintenance',
  'hvac issues',
  'needs hvac',
  'plumbing issues',
  'electrical issues',
  'needs electrical',
  'needs plumbing',

  // Investment keywords
  'flip',
  'flip opportunity',
  'flipping opportunity',
  'investment opportunity',
  'investor opportunity',
  'great investment',
  'investment property',
  'wholesale',
  'wholesale deal',
  'bring your tools',
  'bring your contractor',
  'bring your vision',
  'bring your ideas',
  'sweat equity',
  'profit potential',
  'great potential',
  'tons of potential',
  'lot of potential',
  'arv',
  'after repair value',
  'below market',
  'below arv',
  'under market',
  'quick sale',
  'must sell',
  'must sell fast',
  'priced to sell',
  'priced to sell fast',
  'priced below',
  'price reduced',
  'reduced price',
  'price drop',
  'make offer',
  'all offers considered',
  'bring all offers',

  // Vacancy/rental keywords that indicate distress
  'vacant',
  'vacant property',
  'currently vacant',
  'tenant occupied',
  'section 8',
  'rental property',
  'income property',
  'cash flow',

  // Auction/urgency keywords
  'auction',
  'absolute auction',
  'no reserve',
  'deadline',
  'time sensitive',
  'urgent sale',
  'immediate sale',
  'quick close',
  'fast close',
  'flexible closing',

  // Diamond in the rough keywords
  'diamond in the rough',
  'hidden gem',
  'great bones',
  'good bones',
  'solid bones',
  'loads of potential',
  'endless possibilities',
  'blank canvas',
  'opportunity knocks',
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
