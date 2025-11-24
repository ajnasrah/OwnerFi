/**
 * Context-Aware Negative Financing Detector
 *
 * This replaces brittle keyword lists with intelligent pattern detection that:
 * - Handles flexible word separators (spaces, hyphens, slashes)
 * - Detects negation context ("NO X, Y or Z" structures)
 * - Identifies explicit rejections ("will not be accepted")
 * - Performs better with edge cases
 *
 * @see scripts/analyze-negative-pattern-failures.ts for analysis
 */

/**
 * Core financing terms to look for
 */
const FINANCING_TERMS = [
  'owner financing',
  'owner finance',
  'seller financing',
  'seller finance',
  'creative financing',
  'creative finance',
  'owner carry',
  'seller carry',
  'owner terms',
  'seller terms',
  'owner financed',
  'seller financed',
];

/**
 * Flexible financing term pattern that matches:
 * - "owner financing"
 * - "owner-financing"
 * - "owner/financing"
 * - "OwnerFinancing" (no separator)
 */
const FINANCING_PATTERN = /\b(owner|seller|creative)[\s\-/_]*(financing?|finance|carry|terms|financed)\b/gi;

/**
 * Negation indicators
 */
const NEGATION_WORDS = ['no', 'not', 'never', 'none', 'without'];

/**
 * Rejection phrases (when appearing near financing terms)
 */
const REJECTION_PHRASES = [
  'will not be accepted',
  'will not be considered',
  'will not be entertained',
  'not accepted',
  'not considered',
  'not available',
  'not offered',
  'not offering',
  'not interested',
];

/**
 * Cash-only indicators (strong signals of no owner financing)
 */
const CASH_ONLY_PATTERNS = [
  /\bcash\s+only\b/i,
  /\bcash\s+buyers?\s+only\b/i,
  /\ball\s+cash\s+only\b/i,
  /\bcash\s+offers?\s+only\b/i,
  /\bmust\s+be\s+cash\b/i,
  /\brequires?\s+cash\b/i,
  /\bcash\s+required\b/i,
  /\bcash\s+or\s+conventional\s+only\b/i,
  /\bcash\s+or\s+conventional\s+financing/i,  // "Cash or conventional financing accepted"
  /\bconventional\s+financing\s+only\b/i,
  /\bconventional\s+loan\s+only\b/i,
  /\bcash\s+and\s+conventional\s+only\b/i,
];

export interface NegativeDetectionResult {
  isNegative: boolean;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  matchedPattern?: string;
}

/**
 * STRATEGY 1: Detect explicit "NO [financing term]" patterns
 * Handles: "no owner financing", "no owner-financing", "no owner/financing"
 */
function detectDirectNegation(text: string): NegativeDetectionResult | null {
  // Reset regex state
  FINANCING_PATTERN.lastIndex = 0;

  let match;
  while ((match = FINANCING_PATTERN.exec(text)) !== null) {
    const matchStart = match.index;
    const matchText = match[0];

    // Look backwards up to 50 chars for negation words
    const lookBehindStart = Math.max(0, matchStart - 50);
    const precedingText = text.substring(lookBehindStart, matchStart);

    // Check if any negation word appears before the financing term
    // BUT: Make sure the negation is close (within ~15 chars) to avoid false positives
    // like "no issues. Owner financing available"
    const hasNegation = NEGATION_WORDS.some(neg => {
      const negPattern = new RegExp(`\\b${neg}\\b`, 'i');
      const negMatch = precedingText.match(negPattern);

      if (!negMatch || negMatch.index === undefined) return false;

      // Calculate distance from negation word to financing term
      const negPosition = negMatch.index + lookBehindStart;
      const distance = matchStart - negPosition - negMatch[0].length;

      // Only consider it a negation if:
      // 1. Distance is < 15 chars (close proximity) AND
      // 2. There's no sentence boundary (period, exclamation, question mark) between them
      // This prevents false positives like "no issues. Owner financing available"
      const textBetween = text.substring(negPosition + negMatch[0].length, matchStart);
      const hasSentenceBoundary = /[.!?]/.test(textBetween);

      return distance < 15 && !hasSentenceBoundary;
    });

    if (hasNegation) {
      return {
        isNegative: true,
        confidence: 'high',
        reason: 'Direct negation before financing term',
        matchedPattern: `${precedingText.trim().split(/\s+/).slice(-2).join(' ')} ${matchText}`,
      };
    }
  }

  return null;
}

/**
 * STRATEGY 2: Detect list structures like "NO X, Y or Z will be [action]"
 * Handles: "NO Wholesale, Assignments or Seller Finance Offers will be accepted"
 */
function detectListStructureNegation(text: string): NegativeDetectionResult | null {
  // Pattern: "NO/Not [up to 150 chars] (financing term)"
  // This captures lists like "NO X, Y, or Z" where Z is a financing term
  const listPattern = /\b(no|not)\b[^.!?]{0,150}?\b(owner|seller|creative)[\s\-/_]*(financing?|finance|carry|terms)/i;

  const match = text.match(listPattern);
  if (match) {
    return {
      isNegative: true,
      confidence: 'high',
      reason: 'Negation applies to list containing financing term',
      matchedPattern: match[0],
    };
  }

  return null;
}

/**
 * STRATEGY 3: Detect rejection phrases near financing terms
 * Handles: "seller financing offers will not be accepted"
 */
function detectRejectionPhrase(text: string): NegativeDetectionResult | null {
  // Reset regex state
  FINANCING_PATTERN.lastIndex = 0;

  let match;
  while ((match = FINANCING_PATTERN.exec(text)) !== null) {
    const matchEnd = match.index + match[0].length;
    const matchText = match[0];

    // Look ahead up to 100 chars for rejection phrases
    const lookAheadEnd = Math.min(text.length, matchEnd + 100);
    const followingText = text.substring(matchEnd, lookAheadEnd);

    // Check if any rejection phrase appears after the financing term
    const hasRejection = REJECTION_PHRASES.some(phrase => {
      const rejPattern = new RegExp(phrase.replace(/\s+/g, '\\s+'), 'i');
      return rejPattern.test(followingText);
    });

    if (hasRejection) {
      return {
        isNegative: true,
        confidence: 'high',
        reason: 'Rejection phrase follows financing term',
        matchedPattern: `${matchText} ${followingText.trim().split(/\s+/).slice(0, 5).join(' ')}...`,
      };
    }
  }

  return null;
}

/**
 * STRATEGY 4: Detect cash-only requirements
 */
function detectCashOnly(text: string): NegativeDetectionResult | null {
  for (const pattern of CASH_ONLY_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return {
        isNegative: true,
        confidence: 'high',
        reason: 'Explicitly requires cash only',
        matchedPattern: match[0],
      };
    }
  }

  return null;
}

/**
 * Main detection function - runs all strategies
 *
 * @param description - Property description text
 * @returns Detection result with confidence and reasoning
 */
export function detectNegativeFinancing(
  description: string | null | undefined
): NegativeDetectionResult {
  if (!description || description.trim().length === 0) {
    return {
      isNegative: false,
      confidence: 'low',
      reason: 'No description provided',
    };
  }

  // Run all detection strategies in order of confidence
  // Stop at first match for performance

  // Strategy 1: Direct negation (e.g., "no owner financing")
  const directNegation = detectDirectNegation(description);
  if (directNegation) return directNegation;

  // Strategy 2: List structure (e.g., "NO X, Y or owner financing")
  const listNegation = detectListStructureNegation(description);
  if (listNegation) return listNegation;

  // Strategy 3: Rejection phrases (e.g., "seller financing not accepted")
  const rejectionPhrase = detectRejectionPhrase(description);
  if (rejectionPhrase) return rejectionPhrase;

  // Strategy 4: Cash only requirements
  const cashOnly = detectCashOnly(description);
  if (cashOnly) return cashOnly;

  // No negative indicators found
  return {
    isNegative: false,
    confidence: 'high',
    reason: 'No negative financing indicators detected',
  };
}

/**
 * Simplified function for quick checks
 *
 * @param description - Property description
 * @returns true if negative financing detected
 */
export function hasNegativeFinancing(description: string | null | undefined): boolean {
  return detectNegativeFinancing(description).isNegative;
}

/**
 * Get detailed explanation of detection
 *
 * @param description - Property description
 * @returns Human-readable explanation
 */
export function explainNegativeDetection(description: string | null | undefined): string {
  const result = detectNegativeFinancing(description);

  if (result.isNegative) {
    return `❌ REJECTED: ${result.reason}${result.matchedPattern ? ` - "${result.matchedPattern}"` : ''}`;
  }

  return `✅ PASSED: ${result.reason}`;
}
