/**
 * DIAGNOSE WHY FALSE POSITIVES LEAKED THROUGH THE FILTER
 *
 * This script tests each false positive against the current filters
 * to identify exactly WHY they passed when they shouldn't have.
 */

import { hasStrictOwnerFinancing, getStrictMatchedPatterns } from '../src/lib/owner-financing-filter-strict';
import { hasNegativeKeywords, NEGATIVE_KEYWORDS } from '../src/lib/negative-keywords';
import { detectNegativeFinancing, hasNegativeFinancing } from '../src/lib/negative-financing-detector';

// The 19 false positives from our analysis
const FALSE_POSITIVES = [
  {
    id: '1srDdbhzT1eYE5QC4o0E',
    address: 'Aiken, SC',
    description: `SPECIAL FINANCING W/ SPECIAL INTEREST RATE AS LOW AS 4.99% AND UP TO 6,000 IN SELLER PAID CLOSING COST W/PREFERRED LENDER FOR QUALIFIED BUYERS THAT CLOSE BY 2/28/256.
The Mansfield floor plan. Get everything on your wish list with this single-story home featuring a large great room, spacious kitchen with an island, 3 bedrooms, 2 bathrooms, flex room and a 2-car garage.`,
    aiReason: 'mentions special financing with a preferred lender, not owner financing'
  },
  {
    id: '46fDmB6PgQoLXXhM8Miy',
    address: 'Rockingham, NC',
    description: `Nice 3 bedroom, 1 bath house. Big two car garage. Huge fenced in yard. Huge pool with new liner. Security cameras and system will come with house. Must be able to purchase, or get a loan. Cannot do owner financing.`,
    aiReason: 'explicitly says "Cannot do owner financing"'
  },
  {
    id: '6eAIjYKAg8ggg1AS235d',
    address: 'Dallas, TX',
    description: `🔥 COMING SOON Fully Renovated & Ready to Impress!
📍 List Price: $250,000 💰 Flexible Financing Available!
While renovations are being completed, a qualified buyer working with our preferred lender can lock in a rate as low as 5.5% (rates subject to change). This is a limited-time opportunity—don't miss out!`,
    aiReason: 'mentions flexible financing but it\'s about a preferred lender, not owner finance'
  },
  {
    id: '9PSVzmLLhalxBcOJ0GeV',
    address: 'Fort Myers, FL (1)',
    description: `14-day listing!!! Discover an incredible opportunity to own a first-floor condo in a community that's undergoing a full-scale transformation.`,
    aiReason: 'no owner financing terms mentioned'
  },
  {
    id: 'CdLyit0wnebwSGjYvT1N',
    address: 'Fort Myers, FL (2)',
    description: `Spacious 2nd-Story Carriage Home with a 2 CAR GARAGE, located in the prestigious Gulf Harbour Yacht & Country Club in Fort Myers.`,
    aiReason: 'no owner financing terms mentioned'
  },
  {
    id: 'DfXXZMnh70Jqe3LLj17p',
    address: 'Jackson, MS',
    description: `Attention investors! This is a turnkey rental investment opportunity. The property is tenant-occupied on month-to-month leases.`,
    aiReason: 'no owner financing terms - just investment property'
  },
  {
    id: 'EC0uTJNmwJ6bwmOOTCxc',
    address: 'San Antonio, TX (1)',
    description: `Step into a beautifully updated 3-bedroom, 2-bathroom haven. The sellers will not consider subject-to or 'creative' finance offers.`,
    aiReason: 'explicitly says sellers will not consider creative finance'
  },
  {
    id: 'JYpvLy0MLOW0bzAEAhAw',
    address: 'Orlando, FL',
    description: `Excellent investment opportunity in downtown Orlando. This duplex has been exceptionally maintained.`,
    aiReason: 'no owner financing terms mentioned'
  },
  {
    id: 'KjNka65iTIYJozZCffuy',
    address: 'Saint Augustine, FL',
    description: `Welcome to this exceptional three-story coastal retreat on Anastasia Island.`,
    aiReason: 'no owner financing keywords'
  },
  {
    id: 'KoPE8fXu3UpktDIGigO1',
    address: 'Joliet, IL',
    description: `BACK ON THE MARKET BUYER COULD NOT GET LOAN APPROVED. Looking for the perfect home to start a family.`,
    aiReason: 'no owner financing - just says buyer couldn\'t get loan'
  },
  {
    id: 'MgNvkRjZ8gzqobeoEzuU',
    address: 'Kannapolis, NC',
    description: `Investor owned - being sold AS IS. Was tenant occupied. Nestled into quiet neighborhood.`,
    aiReason: 'no owner financing keywords'
  },
  {
    id: 'RVbPtNT626ew5Fj8EDHS',
    address: 'Hollister, MO',
    description: `Welcome! You have arrived at 161 Foggy Bay Ln. in Hollister, MO. As part of the coveted subdivision of Branson Canyon.`,
    aiReason: 'no owner financing terms'
  },
  {
    id: 'hYJOWYV0Z5XMeE8w5uN9',
    address: 'Graniteville, SC',
    description: `SPECIAL FINANCING W/ SPECIAL FIXED INTEREST RATE AS LOW AS 4.99% AND UP TO 6,000 IN SELLER PAID CLOSING COST W/PREFERRED LENDER FOR QUALIFIED BUYERS.`,
    aiReason: 'lender financing, not owner financing'
  },
  {
    id: 'kQSmryZ5dYWAtXxYDbUG',
    address: 'Saint Louis, MO',
    description: `Fantastic investment opportunity! This 2-bedroom, 1-bath home is currently rented for $1050/month. Seller financing is not an option.`,
    aiReason: 'explicitly says "Seller financing is not an option"'
  },
  {
    id: 'p6LsCljV8eGtjhZvgspm',
    address: 'Butte, MT',
    description: `First time home buyer or investor opportunity! Manufactured home situated on three city lots. Owner financing is not an option.`,
    aiReason: 'explicitly says "Owner financing is not an option"'
  },
  {
    id: 'pKvgKrI8gpIsXsmKUtmP',
    address: 'San Antonio, TX (2)',
    description: `Starter home for a growing family, this roomy 3 bedroom 2 bath house also comes with an additional 1 bedroom 1 bath detached mother-in-law suite.`,
    aiReason: 'no owner financing keywords'
  },
  {
    id: 'rlL3F0KxlHF8FkKGpih5',
    address: 'Kellyton, AL',
    description: `ALL offers must have POF for CASH offers and Lender PQ's for Financed offers. Cash offers require 10% EMD.`,
    aiReason: 'requires cash or traditional lender financing only'
  },
  {
    id: 'tPH65CzSIGhj9LfTcoSF',
    address: 'Hamilton, TX',
    description: `Nice property located on the edge of Hamilton. This is a distressed property that needs extensive clean-up after a seller financed foreclosure.`,
    aiReason: 'mentions past "seller financed foreclosure" but not offering it now'
  },
  {
    id: 'v3rEZoOfjrUhXykzFESq',
    address: 'Sahuarita, AZ',
    description: `Fantastic opportunity for desirable single story 2,076 SqFt 3 bed/2 full bath plus den, split floor plan.`,
    aiReason: 'no owner financing keywords'
  },
];

console.log('=' .repeat(80));
console.log('DIAGNOSING WHY FALSE POSITIVES LEAKED THROUGH THE FILTER');
console.log('=' .repeat(80));
console.log('');

// Categories of failures
const failures = {
  matchedWrongKeyword: [] as string[],
  missedNegativeKeyword: [] as string[],
  shouldNotHaveMatched: [] as string[],
  unknownReason: [] as string[],
};

for (const fp of FALSE_POSITIVES) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`📍 ${fp.address} (${fp.id})`);
  console.log(`${'─'.repeat(80)}`);
  console.log(`Description: ${fp.description.substring(0, 200)}...`);
  console.log(`AI Reason: ${fp.aiReason}`);
  console.log('');

  // Test 1: What keywords matched?
  const matchedPatterns = getStrictMatchedPatterns(fp.description);
  console.log(`🔍 Matched Keywords: ${matchedPatterns.length > 0 ? matchedPatterns.join(', ') : 'NONE'}`);

  // Test 2: Did negative keyword filter catch it?
  const negKeywordsResult = hasNegativeKeywords(fp.description);
  console.log(`🚫 Negative Keywords Check: ${negKeywordsResult.hasNegative ? `YES - ${negKeywordsResult.matches.join(', ')}` : 'NO (not caught)'}`);

  // Test 3: Did context-aware detector catch it?
  const negFinancingResult = detectNegativeFinancing(fp.description);
  console.log(`🧠 Context-Aware Detector: ${negFinancingResult.isNegative ? `YES - ${negFinancingResult.reason}` : 'NO (not caught)'}`);

  // Test 4: What does the full filter say?
  const fullFilterResult = hasStrictOwnerFinancing(fp.description);
  console.log(`✅ Full Filter Result: ${fullFilterResult.passes ? `PASSES (BAD!) - keywords: ${fullFilterResult.matchedKeywords.join(', ')}` : 'FAILS (GOOD)'}`);

  // Diagnose the failure
  console.log('');
  if (fullFilterResult.passes) {
    console.log(`⚠️  DIAGNOSIS: This property SHOULD HAVE BEEN FILTERED OUT but WASN'T!`);

    if (matchedPatterns.length > 0) {
      // It matched keywords it shouldn't have
      if (fp.description.toLowerCase().includes('preferred lender') ||
          fp.description.toLowerCase().includes('lender') ||
          fp.description.toLowerCase().includes('bank')) {
        console.log(`   ISSUE: Matched "${matchedPatterns.join(', ')}" but description mentions LENDER, not owner`);
        failures.matchedWrongKeyword.push(`${fp.address}: matched "${matchedPatterns.join(', ')}" but is LENDER financing`);
      } else if (fp.description.toLowerCase().includes('not an option') ||
                 fp.description.toLowerCase().includes('cannot do') ||
                 fp.description.toLowerCase().includes('will not')) {
        console.log(`   ISSUE: Negative phrase not caught by filters`);
        failures.missedNegativeKeyword.push(`${fp.address}: has negative phrase but filter didn't catch it`);
      } else if (fp.description.toLowerCase().includes('foreclosure')) {
        console.log(`   ISSUE: Matched "seller financed" in historical context (foreclosure), not current offer`);
        failures.matchedWrongKeyword.push(`${fp.address}: matched historical "seller financed" reference`);
      } else {
        console.log(`   ISSUE: Unknown - matched "${matchedPatterns.join(', ')}" incorrectly`);
        failures.unknownReason.push(`${fp.address}: matched "${matchedPatterns.join(', ')}" - reason unclear`);
      }
    } else {
      console.log(`   ISSUE: No keywords matched but still in database - DATA INTEGRITY ISSUE?`);
      failures.shouldNotHaveMatched.push(`${fp.address}: No keywords matched - shouldn't be in DB at all`);
    }
  } else {
    console.log(`✅ GOOD: Filter now correctly rejects this property`);
  }
}

// Summary
console.log('\n\n');
console.log('=' .repeat(80));
console.log('SUMMARY: ROOT CAUSES OF FILTER FAILURES');
console.log('=' .repeat(80));
console.log('');

console.log('🔴 CATEGORY 1: KEYWORDS TOO BROAD (matched lender financing as owner financing)');
console.log('   These matched "flexible financing", "creative financing", etc. but the financing');
console.log('   is from a LENDER, not the owner/seller');
failures.matchedWrongKeyword.forEach(f => console.log(`   • ${f}`));

console.log('');
console.log('🔴 CATEGORY 2: NEGATIVE PHRASES NOT CAUGHT');
console.log('   These explicitly say "NOT available" or "Cannot do" owner financing');
console.log('   but the negative keyword detector missed them');
failures.missedNegativeKeyword.forEach(f => console.log(`   • ${f}`));

console.log('');
console.log('🔴 CATEGORY 3: DATA INTEGRITY - SHOULDN\'T BE IN DB');
console.log('   These have NO owner financing keywords - how did they get saved?');
failures.shouldNotHaveMatched.forEach(f => console.log(`   • ${f}`));

console.log('');
console.log('🟡 CATEGORY 4: UNKNOWN REASON');
failures.unknownReason.forEach(f => console.log(`   • ${f}`));

console.log('\n');
console.log('=' .repeat(80));
console.log('RECOMMENDED FIXES');
console.log('=' .repeat(80));
console.log(`
1. REMOVE BROAD KEYWORDS from strict filter:
   - Remove "flexible financing" - too broad, matches lender offers
   - Remove "creative financing" - too broad, matches general marketing
   - Remove "flexible terms" - too broad
   - Remove "terms available" - too broad

   KEEP ONLY explicit owner/seller terms:
   - "owner financing", "seller financing"
   - "owner carry", "seller carry"
   - "owner will finance", "seller will finance"
   - "rent to own", "lease option", "lease purchase"

2. ADD MISSING NEGATIVE PATTERNS:
   - "is not an option"
   - "is not available"
   - "cannot do"
   - "sellers will not consider"
   - "preferred lender" (indicates lender financing, not owner)
   - "with our lender"
   - "lock in a rate" (lender language)

3. ADD CONTEXT CHECK:
   - If description mentions "lender", "bank", "mortgage company"
   - AND contains "flexible/creative financing"
   - THEN reject (it's lender financing, not owner)

4. HISTORICAL REFERENCE CHECK:
   - "seller financed foreclosure" = PAST tense, not current offer
   - Reject if "foreclosure" appears near "seller finance"
`);

console.log('\nDone!');
