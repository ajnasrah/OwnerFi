/**
 * Financing Type Detector
 *
 * Categorizes properties into financing types based on keywords found in description.
 * Sets a clean "financingType" status field for display and filtering.
 *
 * Financing Types (in priority order):
 * 1. Owner Finance - owner financing, owner carry, owner terms
 * 2. Seller Finance - seller financing, seller carry, seller terms
 * 3. Rent to Own - rent to own, lease option, lease purchase
 * 4. Contract for Deed - contract for deed, land contract
 * 5. Assumable Loan - assumable loan, assumable mortgage
 * 6. Creative Financing - wrap mortgage, no bank needed, etc.
 */

export type FinancingType =
  | 'Owner Finance'
  | 'Seller Finance'
  | 'Rent to Own'
  | 'Contract for Deed'
  | 'Assumable Loan'
  | 'Creative Financing'
  | null;

export interface FinancingTypeResult {
  financingType: FinancingType;
  allTypes: FinancingType[];  // All financing types detected (property may have multiple)
  matchedKeywords: string[];   // Specific keywords that matched
  displayLabel: string;        // Human-readable label for UI
}

/**
 * Financing type patterns organized by category
 */
const FINANCING_TYPE_PATTERNS: {
  type: FinancingType;
  patterns: { regex: RegExp; keyword: string }[];
}[] = [
  {
    type: 'Owner Finance',
    patterns: [
      { regex: /owner\s*financ/i, keyword: 'owner financing' },
      { regex: /owner\s*carry/i, keyword: 'owner carry' },
      { regex: /owner\s*will\s*carry/i, keyword: 'owner will carry' },
      { regex: /owner\s*will\s*finance/i, keyword: 'owner will finance' },
      { regex: /owner\s*terms/i, keyword: 'owner terms' },
    ],
  },
  {
    type: 'Seller Finance',
    patterns: [
      { regex: /seller\s*financ/i, keyword: 'seller financing' },
      { regex: /seller\s*carry/i, keyword: 'seller carry' },
      { regex: /seller\s*will\s*carry/i, keyword: 'seller will carry' },
      { regex: /seller\s*will\s*finance/i, keyword: 'seller will finance' },
      { regex: /seller\s*terms/i, keyword: 'seller terms' },
      { regex: /third\s*party\s*seller\s*financ/i, keyword: 'third party seller finance' },
    ],
  },
  {
    type: 'Rent to Own',
    patterns: [
      { regex: /rent[\s-]+to[\s-]+own/i, keyword: 'rent to own' },
      { regex: /lease[\s-]*to[\s-]*own/i, keyword: 'lease to own' },
      { regex: /lease[\s-]*option/i, keyword: 'lease option' },
      { regex: /lease[\s-]*purchase/i, keyword: 'lease purchase' },
    ],
  },
  {
    type: 'Contract for Deed',
    patterns: [
      { regex: /contract\s*for\s*deed/i, keyword: 'contract for deed' },
      { regex: /deed\s*of\s*contract/i, keyword: 'deed of contract' },
      { regex: /land\s*contract/i, keyword: 'land contract' },
      { regex: /installment\s*land\s*contract/i, keyword: 'installment land contract' },
      { regex: /bond\s*for\s*deed/i, keyword: 'bond for deed' },
    ],
  },
  {
    type: 'Assumable Loan',
    patterns: [
      { regex: /assumable\s*(loan|mortgage)/i, keyword: 'assumable loan' },
      { regex: /assume\s*(the\s*)?(loan|mortgage)/i, keyword: 'assumable loan' },
      { regex: /loan\s*assumption/i, keyword: 'loan assumption' },
    ],
  },
  {
    type: 'Creative Financing',
    patterns: [
      { regex: /wrap\s*(around\s*)?(mortgage|loan)/i, keyword: 'wrap mortgage' },
      { regex: /no\s*bank\s*(needed|qualifying|required)/i, keyword: 'no bank needed' },
      { regex: /creative\s*financ/i, keyword: 'creative financing' },
      { regex: /flexible\s*financ/i, keyword: 'flexible financing' },
      { regex: /subject\s*to/i, keyword: 'subject to' },
    ],
  },
];

/**
 * Detect the financing type from a property description
 *
 * @param description - Property description text
 * @returns FinancingTypeResult with primary type, all types, and matched keywords
 */
export function detectFinancingType(
  description: string | null | undefined
): FinancingTypeResult {
  if (!description || description.trim().length === 0) {
    return {
      financingType: null,
      allTypes: [],
      matchedKeywords: [],
      displayLabel: 'Unknown',
    };
  }

  const allTypes: FinancingType[] = [];
  const matchedKeywords: string[] = [];

  // Check each financing type category
  for (const { type, patterns } of FINANCING_TYPE_PATTERNS) {
    for (const { regex, keyword } of patterns) {
      if (regex.test(description)) {
        // Add type if not already added
        if (!allTypes.includes(type)) {
          allTypes.push(type);
        }
        // Always add matched keyword
        if (!matchedKeywords.includes(keyword)) {
          matchedKeywords.push(keyword);
        }
      }
    }
  }

  // Primary type is the first one found (they're in priority order)
  const financingType = allTypes.length > 0 ? allTypes[0] : null;

  // Create display label
  let displayLabel = 'Unknown';
  if (allTypes.length === 1) {
    displayLabel = allTypes[0]!;
  } else if (allTypes.length > 1) {
    // Multiple types - show primary with indicator
    displayLabel = `${allTypes[0]} (+${allTypes.length - 1} more)`;
  }

  return {
    financingType,
    allTypes,
    matchedKeywords,
    displayLabel,
  };
}

/**
 * Get a short badge/tag for the financing type (for UI display)
 */
export function getFinancingTypeBadge(financingType: FinancingType): {
  label: string;
  color: string;
} {
  switch (financingType) {
    case 'Owner Finance':
      return { label: 'Owner Finance', color: 'green' };
    case 'Seller Finance':
      return { label: 'Seller Finance', color: 'blue' };
    case 'Rent to Own':
      return { label: 'Rent to Own', color: 'purple' };
    case 'Contract for Deed':
      return { label: 'Contract for Deed', color: 'orange' };
    case 'Assumable Loan':
      return { label: 'Assumable', color: 'teal' };
    case 'Creative Financing':
      return { label: 'Creative Finance', color: 'yellow' };
    default:
      return { label: 'Unknown', color: 'gray' };
  }
}

/**
 * Export all available financing types for filtering UI
 */
export const ALL_FINANCING_TYPES: FinancingType[] = [
  'Owner Finance',
  'Seller Finance',
  'Rent to Own',
  'Contract for Deed',
  'Assumable Loan',
  'Creative Financing',
];
