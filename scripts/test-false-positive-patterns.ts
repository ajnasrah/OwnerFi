// Test what the negative patterns are actually matching

const testDescriptions = [
  {
    address: "227 E High St, Kingwood, WV 26537",
    desc: "The mailing address is definitely negotiable and owner financing may be available with a 10% down payment",
    shouldPass: true, // This SHOULD pass because it offers owner financing
  },
  {
    address: "Test Property - No Owner Financing",
    desc: "Beautiful home. Cash only. No owner financing available.",
    shouldPass: false, // This should be filtered out
  },
  {
    address: "Test Property - No Creative Offers",
    desc: "Great investment. No creative or owner financed offers accepted.",
    shouldPass: false,
  },
  {
    address: "Test Property - Financing Available",
    desc: "Financing available. Owner will consider terms.",
    shouldPass: true,
  },
  {
    address: "132 RENFRO DR, Devine, TX 78016",
    desc: "NOW OFFERING OWNER FINANCE! Discover the charm of small-town living",
    shouldPass: true,
  },
];

// Current negative pattern (TOO BROAD)
const broadPattern = /no.*owner.*financ/i;

// Better pattern (STRICT)
const strictPattern = /\bno\s+(owner|seller)\s+financ/i;

console.log('\n🧪 TESTING NEGATIVE PATTERNS\n');
console.log('='.repeat(100));

testDescriptions.forEach((test, i) => {
  console.log(`\n${i + 1}. ${test.address}`);
  console.log(`   Description: "${test.desc}"`);
  console.log(`   Expected: ${test.shouldPass ? 'PASS ✅' : 'FILTER OUT ❌'}`);

  const broadMatch = broadPattern.test(test.desc);
  const strictMatch = strictPattern.test(test.desc);

  console.log(`   Broad Pattern Match: ${broadMatch ? 'YES (would filter out)' : 'NO (would pass)'}`);
  console.log(`   Strict Pattern Match: ${strictMatch ? 'YES (would filter out)' : 'NO (would pass)'}`);

  // Check if broad pattern is wrong
  if (test.shouldPass && broadPattern.test(test.desc)) {
    console.log(`   ⚠️  BROAD PATTERN IS TOO AGGRESSIVE - False positive!`);
    // Show what it matched
    const match = test.desc.match(broadPattern);
    if (match) {
      console.log(`   Matched text: "${match[0]}"`);
    }
  }

  // Check if strict pattern is correct
  if (test.shouldPass && strictPattern.test(test.desc)) {
    console.log(`   ⚠️  STRICT PATTERN STILL TOO AGGRESSIVE`);
  } else if (!test.shouldPass && !strictPattern.test(test.desc)) {
    console.log(`   ⚠️  STRICT PATTERN MISSED THIS (should have caught it)`);
  } else {
    console.log(`   ✅ STRICT PATTERN CORRECT`);
  }

  console.log('-'.repeat(100));
});
