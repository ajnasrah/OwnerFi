/**
 * Analyze why negative patterns are failing and design better approach
 */

const failedCases = [
  {
    text: 'No Seller-financing offered',
    issue: 'Hyphen between words not caught'
  },
  {
    text: 'No wholesalers or seller financing offers',
    issue: 'Phrase structure with "or" separator'
  },
  {
    text: 'NO Wholesale, Assignments or Seller Finance Offers will be accepted',
    issue: 'Complex list structure where "NO" applies to entire list'
  },
  {
    text: 'No wholesalers/assignable offers will be considered',
    issue: 'Slash separator instead of spaces/commas'
  }
];

console.log('ANALYSIS: Why Negative Keyword Filters Fail\n');
console.log('='.repeat(80));

console.log('\n📊 IDENTIFIED ISSUES:\n');

const issues = new Map<string, string[]>();

failedCases.forEach(fc => {
  if (!issues.has(fc.issue)) {
    issues.set(fc.issue, []);
  }
  issues.get(fc.issue)!.push(fc.text);
});

for (const [issue, examples] of issues) {
  console.log(`\n❌ ${issue}`);
  examples.forEach(ex => console.log(`   - "${ex}"`));
}

console.log('\n\n💡 PROPOSED SOLUTIONS:\n');

console.log(`
1️⃣  FLEXIBLE WORD SEPARATORS
   - Current: Only matches spaces (\\s+)
   - Better: Match spaces, hyphens, slashes, and underscores
   - Pattern: [\\s\\-/_]+ instead of \\s+
   - This catches: "seller financing", "seller-financing", "seller/financing"

2️⃣  CONTEXT-AWARE NEGATION DETECTION
   - Look for negation words (no, not, never, none, without)
   - Then check if financing terms appear within X words after
   - This catches complex structures like "NO [list] or Seller Finance"

3️⃣  LIST STRUCTURE DETECTION
   - Detect patterns like "NO X, Y or Z" where Z is financing-related
   - Regex: /\\bno\\b[^.!?]{0,150}?\\b(seller|owner)[-\\s]*(financing?|finance|carry)/i
   - Captures up to 150 chars between "NO" and financing terms

4️⃣  EXPLICIT REJECTION PHRASES
   - "will (not )?(be )?accepted"
   - "will (not )?(be )?considered"
   - "will (not )?(be )?entertained"
   - When preceded by financing terms in same sentence = rejection

5️⃣  DUAL-PASS FILTERING APPROACH
   - Pass 1: Quick keyword match (current approach)
   - Pass 2: Context-aware analysis for edge cases
   - Only use Pass 2 if Pass 1 doesn't find clear negative
`);

console.log('\n\n🎯 RECOMMENDED IMPLEMENTATION:\n');

console.log(`
CREATE NEW FILE: src/lib/negative-financing-detector.ts

Key Features:
✅ Flexible separators (spaces, hyphens, slashes)
✅ Context-aware negation (looks for "no/not" within proximity)
✅ List structure detection ("NO X, Y or Z will be [rejected]")
✅ Explicit rejection phrases ("offers will not be accepted")
✅ Case-insensitive matching
✅ Performance optimized (regex caching, early returns)

This replaces fragile keyword lists with robust pattern detection.
`);

console.log('\n' + '='.repeat(80));
