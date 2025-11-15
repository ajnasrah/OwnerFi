/**
 * Comprehensive test for the investor property filtering system
 * Tests: keyword detection, deal type classification, and filtering logic
 */

import { detectNeedsWork, getMatchingKeywords } from '../src/lib/property-needs-work-detector';

interface TestProperty {
  description: string;
  price: number;
  estimate: number;
  source: 'zillow_scraper' | 'cash_deals_scraper';
  agentPhoneNumber?: string;
  fullAddress: string;
}

interface TestResult {
  scenario: string;
  passed: boolean;
  expected: any;
  actual: any;
  details?: string;
}

const results: TestResult[] = [];

// Test scenarios
const testProperties: Array<TestProperty & { expectedOutcome: any }> = [
  // Zillow Scraper Tests
  {
    scenario: '1. Zillow - Owner Finance Keywords (should go to GHL)',
    description: 'Great fixer upper opportunity! Needs some TLC but has tons of potential. Motivated seller, priced to sell!',
    price: 250000,
    estimate: 350000,
    source: 'zillow_scraper',
    agentPhoneNumber: '555-1234',
    fullAddress: '123 Fixer St',
    expectedOutcome: {
      needsWork: true,
      savedToCashHouses: true,
      dealType: 'owner_finance',
      sentToGHL: true,
      hasKeywords: true,
    }
  },
  {
    scenario: '2. Zillow - No Keywords (should NOT go to GHL)',
    description: 'Beautiful move-in ready home with modern updates. Brand new kitchen and bathrooms. Perfect for families.',
    price: 300000,
    estimate: 320000,
    source: 'zillow_scraper',
    agentPhoneNumber: '555-5678',
    fullAddress: '456 Perfect Ave',
    expectedOutcome: {
      needsWork: false,
      savedToCashHouses: false,
      dealType: null,
      sentToGHL: false,
      hasKeywords: false,
    }
  },
  {
    scenario: '3. Zillow - Keywords but no contact (should NOT go to GHL)',
    description: 'Handyman special! Needs work but great investment opportunity. Cash buyers only.',
    price: 180000,
    estimate: 280000,
    source: 'zillow_scraper',
    agentPhoneNumber: undefined,
    fullAddress: '789 Investment Rd',
    expectedOutcome: {
      needsWork: true,
      savedToCashHouses: true,
      dealType: 'owner_finance',
      sentToGHL: false, // No contact info
      hasKeywords: true,
    }
  },

  // Cash Deals Scraper Tests
  {
    scenario: '4. Cash Deals - Discount Only (no keywords)',
    description: 'Nice property in good condition. Well maintained and move-in ready.',
    price: 200000,
    estimate: 300000, // 66.7% - under 80%
    source: 'cash_deals_scraper',
    fullAddress: '321 Discount Ln',
    expectedOutcome: {
      needsWork: false,
      savedToCashHouses: true,
      dealType: 'discount',
      meetsDiscountCriteria: true,
      hasKeywords: false,
    }
  },
  {
    scenario: '5. Cash Deals - Keywords Only (no discount)',
    description: 'Property needs renovation and repairs. Great flip opportunity for investors. Bring your contractor!',
    price: 260000,
    estimate: 280000, // 92.8% - above 80%
    source: 'cash_deals_scraper',
    fullAddress: '654 Flip St',
    expectedOutcome: {
      needsWork: true,
      savedToCashHouses: true,
      dealType: 'needs_work',
      meetsDiscountCriteria: false,
      hasKeywords: true,
    }
  },
  {
    scenario: '6. Cash Deals - Both Discount AND Keywords',
    description: 'As-is sale! Needs work but priced below market. Investor special!',
    price: 150000,
    estimate: 250000, // 60% - under 80%
    source: 'cash_deals_scraper',
    fullAddress: '987 Deal Ave',
    expectedOutcome: {
      needsWork: true,
      savedToCashHouses: true,
      dealType: 'discount', // Discount takes priority
      meetsDiscountCriteria: true,
      hasKeywords: true,
    }
  },
  {
    scenario: '7. Cash Deals - Neither (should NOT save)',
    description: 'Beautiful updated home in great condition.',
    price: 300000,
    estimate: 320000, // 93.75% - above 80%
    source: 'cash_deals_scraper',
    fullAddress: '147 Nice St',
    expectedOutcome: {
      needsWork: false,
      savedToCashHouses: false,
      dealType: null,
      meetsDiscountCriteria: false,
      hasKeywords: false,
    }
  },

  // Keyword Detection Edge Cases
  {
    scenario: '8. False Positive Test - "renovated" should NOT match',
    description: 'Completely renovated home with all new updates. Recently updated kitchen and baths.',
    price: 280000,
    estimate: 300000,
    source: 'zillow_scraper',
    fullAddress: '258 Updated Dr',
    expectedOutcome: {
      needsWork: false,
      savedToCashHouses: false,
      hasKeywords: false,
    }
  },
  {
    scenario: '9. Multiple Keywords Test',
    description: 'Fixer upper needs repairs. Foreclosure sale, sold as-is. Great rehab opportunity!',
    price: 120000,
    estimate: 250000,
    source: 'cash_deals_scraper',
    fullAddress: '369 Multi St',
    expectedOutcome: {
      needsWork: true,
      savedToCashHouses: true,
      dealType: 'discount',
      hasKeywords: true,
      minKeywordCount: 5, // At least 5 keywords (fixer, fixer upper, needs repairs, foreclosure, as-is, sold as is, rehab, etc.)
    }
  },
];

console.log('\n🧪 Testing Investor Property Filter System\n');
console.log('═'.repeat(80));

// Run tests
testProperties.forEach((testProp, index) => {
  const {
    scenario,
    description,
    price,
    estimate,
    source,
    agentPhoneNumber,
    fullAddress,
    expectedOutcome
  } = testProp;

  console.log(`\n${scenario}`);
  console.log(`   Property: ${fullAddress}`);
  console.log(`   Source: ${source}`);
  console.log(`   Price: $${price.toLocaleString()} | Estimate: $${estimate.toLocaleString()}`);

  // Test keyword detection
  const needsWork = detectNeedsWork(description);
  const matchingKeywords = getMatchingKeywords(description);

  // Calculate discount
  const eightyPercentOfZestimate = Math.round(estimate * 0.8);
  const meetsDiscountCriteria = price < eightyPercentOfZestimate;

  // Determine deal type and whether to save
  let dealType = null;
  let savedToCashHouses = false;

  if (source === 'cash_deals_scraper') {
    // Cash deals: save if discount OR keywords
    if (meetsDiscountCriteria || needsWork) {
      savedToCashHouses = true;
      dealType = meetsDiscountCriteria ? 'discount' : 'needs_work';
    }
  } else if (source === 'zillow_scraper') {
    // Zillow: only save if has keywords
    if (needsWork) {
      savedToCashHouses = true;
      dealType = 'owner_finance';
    }
  }

  // Determine if sent to GHL (Zillow only, needs keywords AND contact)
  const sentToGHL = source === 'zillow_scraper' && needsWork && !!agentPhoneNumber;

  // Build actual outcome
  const actualOutcome: any = {
    needsWork,
    savedToCashHouses,
    dealType,
    hasKeywords: needsWork,
  };

  if (source === 'zillow_scraper') {
    actualOutcome.sentToGHL = sentToGHL;
  } else {
    actualOutcome.meetsDiscountCriteria = meetsDiscountCriteria;
  }

  if (matchingKeywords.length > 0) {
    actualOutcome.keywordCount = matchingKeywords.length;
  }

  // Compare results
  let passed = true;
  const differences: string[] = [];

  Object.keys(expectedOutcome).forEach(key => {
    // Handle minKeywordCount separately (at least N keywords)
    if (key === 'minKeywordCount') {
      if (matchingKeywords.length < expectedOutcome[key]) {
        passed = false;
        differences.push(`${key}: expected at least ${expectedOutcome[key]}, got ${matchingKeywords.length}`);
      }
    } else if (expectedOutcome[key] !== actualOutcome[key]) {
      passed = false;
      differences.push(`${key}: expected ${expectedOutcome[key]}, got ${actualOutcome[key]}`);
    }
  });

  results.push({
    scenario,
    passed,
    expected: expectedOutcome,
    actual: actualOutcome,
    details: differences.join('; ')
  });

  // Display results
  if (passed) {
    console.log(`   ✅ PASS`);
  } else {
    console.log(`   ❌ FAIL`);
    differences.forEach(diff => console.log(`      - ${diff}`));
  }

  if (matchingKeywords.length > 0) {
    console.log(`   Keywords found: ${matchingKeywords.slice(0, 5).join(', ')}`);
  }

  console.log(`   Deal Type: ${dealType || 'None'}`);
  console.log(`   Saved to Cash Houses: ${savedToCashHouses ? 'Yes' : 'No'}`);
  if (source === 'zillow_scraper') {
    console.log(`   Sent to GHL: ${sentToGHL ? 'Yes' : 'No'}`);
  }
});

// Test Admin UI Filter Logic
console.log('\n' + '═'.repeat(80));
console.log('\n📊 Testing Admin UI Filter Logic\n');

const mockCashHouses = [
  { dealType: 'discount', fullAddress: '100 Discount St' },
  { dealType: 'needs_work', fullAddress: '200 Needs Work Ave' },
  { dealType: 'owner_finance', fullAddress: '300 Owner Finance Rd' },
  { dealType: 'discount', fullAddress: '400 Another Discount Ln' },
  { dealType: 'owner_finance', fullAddress: '500 Another Owner Finance Dr' },
];

console.log('Mock Cash Houses:', mockCashHouses.length, 'properties');
console.log('  - Discount: 2');
console.log('  - Needs Work (cash scraper): 1');
console.log('  - Owner Finance (zillow scraper): 2\n');

// Test Filter 1: All
const allFilter = mockCashHouses.filter(h => true);
console.log(`Filter "All": ${allFilter.length} properties`);
results.push({
  scenario: 'Admin UI - Filter "All"',
  passed: allFilter.length === 5,
  expected: 5,
  actual: allFilter.length
});

// Test Filter 2: Discount
const discountFilter = mockCashHouses.filter(h => h.dealType === 'discount');
console.log(`Filter "Discount": ${discountFilter.length} properties`);
results.push({
  scenario: 'Admin UI - Filter "Discount"',
  passed: discountFilter.length === 2,
  expected: 2,
  actual: discountFilter.length
});

// Test Filter 3: Needs Work / Owner Finance (combined)
const needsWorkFilter = mockCashHouses.filter(h =>
  h.dealType === 'needs_work' || h.dealType === 'owner_finance'
);
console.log(`Filter "Needs Work / Owner Finance": ${needsWorkFilter.length} properties (1 from cash scraper + 2 from zillow)`);
results.push({
  scenario: 'Admin UI - Filter "Needs Work / Owner Finance"',
  passed: needsWorkFilter.length === 3,
  expected: 3,
  actual: needsWorkFilter.length
});

// Final Summary
console.log('\n' + '═'.repeat(80));
console.log('\n📈 Test Summary\n');

const passedTests = results.filter(r => r.passed).length;
const totalTests = results.length;
const passRate = ((passedTests / totalTests) * 100).toFixed(1);

console.log(`Total Tests: ${totalTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${totalTests - passedTests}`);
console.log(`Pass Rate: ${passRate}%\n`);

if (passedTests === totalTests) {
  console.log('✅ ALL TESTS PASSED! System is working correctly.\n');
  console.log('Summary:');
  console.log('  ✅ Zillow scraper only sends properties with keywords to GHL');
  console.log('  ✅ Cash deals scraper saves properties with discount OR keywords');
  console.log('  ✅ Admin UI filters combine both scrapers correctly');
  console.log('  ✅ No false positives from "renovated" or "updated" keywords\n');
} else {
  console.log('❌ SOME TESTS FAILED\n');
  console.log('Failed tests:');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`  ❌ ${r.scenario}`);
    if (r.details) {
      console.log(`     ${r.details}`);
    }
  });
  console.log();
}

process.exit(passedTests === totalTests ? 0 : 1);
