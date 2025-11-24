/**
 * Debug the "no issues. Owner financing" false positive
 */

const text = 'Great property with no issues. Owner financing available.';

const FINANCING_PATTERN = /\b(owner|seller|creative)[\s\-/_]*(financing?|finance|carry|terms|financed)\b/gi;
const NEGATION_WORDS = ['no', 'not', 'never', 'none', 'without'];

console.log('Debugging: "' + text + '"\n');
console.log('='.repeat(80));

FINANCING_PATTERN.lastIndex = 0;
let match;

while ((match = FINANCING_PATTERN.exec(text)) !== null) {
  const matchStart = match.index;
  const matchText = match[0];
  const matchEnd = matchStart + matchText.length;

  console.log(`\nFound financing term: "${matchText}" at position ${matchStart}`);

  const lookBehindStart = Math.max(0, matchStart - 50);
  const precedingText = text.substring(lookBehindStart, matchStart);

  console.log(`Preceding text (${precedingText.length} chars): "${precedingText}"`);

  for (const neg of NEGATION_WORDS) {
    const negPattern = new RegExp(`\\b${neg}\\b`, 'i');
    const negMatch = precedingText.match(negPattern);

    if (negMatch && negMatch.index !== undefined) {
      const negPosition = negMatch.index + lookBehindStart;
      const distance = matchStart - negPosition - negMatch[0].length;
      const textBetween = text.substring(negPosition + negMatch[0].length, matchStart);
      const hasSentenceBoundary = /[.!?]/.test(textBetween);

      console.log(`\n  Found negation word: "${negMatch[0]}" at position ${negPosition}`);
      console.log(`  Distance to financing term: ${distance} chars`);
      console.log(`  Text between: "${textBetween}"`);
      console.log(`  Has sentence boundary: ${hasSentenceBoundary}`);
      console.log(`  Should trigger negation: ${distance < 15 || !hasSentenceBoundary}`);

      // This is the bug - need to check BOTH conditions with AND
      // Currently: distance < 15 OR !hasSentenceBoundary
      // Should be: distance < 15 AND !hasSentenceBoundary
    }
  }
}

console.log('\n' + '='.repeat(80));
console.log('\nCONCLUSION: The logic "distance < 15 OR !hasSentenceBoundary" is wrong.');
console.log('It should be: "distance < 15 AND !hasSentenceBoundary"');
console.log('\nBecause we want BOTH:');
console.log('1. Close proximity (< 15 chars)');
console.log('2. No sentence boundary between them');
console.log('\nIf there IS a sentence boundary, we should NOT trigger negation.');
