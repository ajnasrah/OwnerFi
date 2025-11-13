/**
 * Legal Disclaimers & Safe UI Copy
 *
 * Centralized location for all legally-compliant UI text to reduce liability exposure
 * across property listings, buyer dashboard, and marketing materials.
 */

export const LEGAL_DISCLAIMERS = {
  // Primary persistent disclaimer (always visible)
  PERSISTENT_WARNING: '⚠️ All estimates agent-reported only • Not verified • Seller determines actual terms',

  // Financial estimate disclaimers
  MONTHLY_PAYMENT: 'Agent-reported • Not verified',
  DOWN_PAYMENT: 'Based on agent-reported terms. Actual down payment determined by seller. Verify before planning.',
  PAYMENT_BREAKDOWN: 'Based on generic area averages. Actual taxes/insurance vary significantly by property, location, and provider. Not verified. Seller determines actual terms.',
  FINANCING_TERMS: 'Agent-reported estimates • Subject to change • Seller determines final terms',

  // Property information disclaimers
  PROPERTY_DESCRIPTION: 'Description provided by listing agent. OwnerFi does not verify accuracy. Verify all information with seller.',
  INVESTMENT_INFO: 'Third-party rental estimate • Not investment advice • Does not include vacancy, maintenance, or other costs • Consult financial advisor',

  // Badge/status disclaimers
  OWNER_FINANCE_BADGE: 'Agent-reported • Subject to verification',

  // General disclaimer
  GENERAL_ESTIMATES: 'Estimates exclude taxes, insurance & HOA fees. Not guaranteed - verify with seller.',

  // Investment section
  INVESTMENT_WARNING: 'For reference only - not a guarantee of rental income or returns',
} as const;

export const SAFE_UI_LABELS = {
  // Replace authoritative language with softer, safer alternatives
  MONTHLY_PAYMENT: 'Illustrative Est.',
  DOWN_PAYMENT: 'Illustrative Down Payment Example',
  PAYMENT_BREAKDOWN: 'Illustrative Monthly Estimate Only',
  FINANCING_TERMS: 'Indicative Financing Terms',
  INVESTMENT_SECTION: 'Rental Market Reference (Informational Only)',
  OWNER_FINANCE_BADGE: 'Owner Finance Option',
  NEGOTIABLE_BADGE: 'Terms May Vary',
  PROPERTY_DESCRIPTION: 'Property Description',

  // Loading/searching language
  LOADING_TEXT: 'Loading properties',
  SEARCHING_TEXT: 'Finding your home',
} as const;

export const LEGAL_COLORS = {
  // Use neutral colors to avoid implying verification/approval
  BADGE_NEUTRAL: 'bg-slate-500',
  WARNING_BG: 'bg-amber-50',
  WARNING_BORDER: 'border-amber-300',
  WARNING_TEXT: 'text-amber-900',
  DISCLAIMER_BG: 'bg-slate-50',
  DISCLAIMER_TEXT: 'text-slate-500',
} as const;

/**
 * Owner Financing Educational Facts - Legally Safe Versions
 * Added qualifiers to make them informational, not promises
 */
export const OWNER_FINANCING_FACTS = [
  "💡 Owner financing may require less paperwork than traditional mortgages in some cases - but not always. Every seller sets their own requirements.",
  "🏦 Some sellers consider applicants with varied credit profiles - but approval is entirely seller-specific and not guaranteed.",
  "💰 Owner financing may have lower closing costs in some cases - actual costs vary by property, location, and seller requirements.",
  "⚡ Some owner-financed deals close faster than traditional bank mortgages - but timelines vary based on seller, due diligence, and legal requirements.",
  "🎯 Terms in owner financing are often negotiable - but final terms are always determined by the seller.",
  "📈 Lower down payments may be available with some sellers - but down payment requirements vary significantly by seller and property.",
  "🏡 Owner financing can work for self-employed or non-traditional income buyers - but each seller has their own qualification criteria.",
  "💼 Interest rates vary by seller and property - some may be competitive with traditional financing, others may be higher.",
  "🔓 Owner financing approval is based on seller's criteria rather than bank policies - but sellers may still require credit checks, income verification, and references.",
  "📊 Owner financing has been used for real estate transactions for centuries - it's an established alternative financing method.",
  "🌟 Balloon payment structures may give buyers time to build credit for refinancing - but buyers must plan for refinancing or full payment when the balloon term ends.",
  "🤝 Direct relationship with the seller may allow flexibility - but all terms must be agreed upon and documented legally.",
  "💵 Some sellers may consider creative arrangements - but any special terms must be mutually agreed upon and properly documented.",
  "🏃 Owner-financed deals may have different timelines than traditional mortgages - actual closing time depends on due diligence, legal review, and seller preferences.",
  "📝 Terms vary significantly by seller and property - always review all documentation with a real estate attorney before committing."
] as const;

/**
 * Helper function to format disclaimer text with appropriate styling
 */
export function formatDisclaimer(text: string, size: 'xs' | 'sm' = 'xs'): string {
  return text;
}

/**
 * Legal contact disclaimer for agent contact buttons
 */
export const AGENT_CONTACT_DISCLAIMER = 'Listing agent represents the seller, not the buyer. Consider hiring your own buyer\'s agent for representation.';
