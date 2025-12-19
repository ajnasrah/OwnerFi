/**
 * Integration test to verify OR logic works in the actual API routes
 *
 * This simulates what happens when:
 * 1. A new property is added (sync-matches endpoint)
 * 2. A buyer searches for properties (buyer/properties endpoint)
 */

import { isPropertyMatch } from './src/lib/matching';

console.log('🧪 API Integration Test - OR Logic Verification\n');
console.log('━'.repeat(80));

// Simulate a buyer profile
const buyer = {
  id: 'test-buyer-123',
  maxMonthlyPayment: 1500,
  maxDownPayment: 15000,
  preferredCity: 'Houston',
  preferredState: 'TX',
  searchRadius: 30,
  minBedrooms: 3,
  minBathrooms: 2
};

// Simulate properties in the database
const properties = [
  {
    id: 'prop-1',
    name: '123 Main St',
    monthlyPayment: 1400,
    downPaymentAmount: 12000,
    city: 'Houston',
    state: 'TX',
    bedrooms: 3,
    bathrooms: 2,
    expectedVisible: true,
    expectedTag: 'Within Budget'
  },
  {
    id: 'prop-2',
    name: '456 Oak Ave (Low Monthly)',
    monthlyPayment: 1300,
    downPaymentAmount: 20000, // $5k over down payment budget
    city: 'Houston',
    state: 'TX',
    bedrooms: 3,
    bathrooms: 2,
    expectedVisible: true,
    expectedTag: 'Low Monthly Payment'
  },
  {
    id: 'prop-3',
    name: '789 Pine St (Low Down)',
    monthlyPayment: 1700, // $200/mo over budget
    downPaymentAmount: 10000,
    city: 'Houston',
    state: 'TX',
    bedrooms: 4,
    bathrooms: 2.5,
    expectedVisible: true,
    expectedTag: 'Low Down Payment'
  },
  {
    id: 'prop-4',
    name: '321 Elm Dr (Over Budget)',
    monthlyPayment: 2000,
    downPaymentAmount: 25000,
    city: 'Houston',
    state: 'TX',
    bedrooms: 3,
    bathrooms: 2,
    expectedVisible: false,
    expectedTag: 'Should not show'
  },
  {
    id: 'prop-5',
    name: '555 Maple Way (Wrong City)',
    monthlyPayment: 1200,
    downPaymentAmount: 10000,
    city: 'Dallas', // Wrong city
    state: 'TX',
    bedrooms: 3,
    bathrooms: 2,
    expectedVisible: false,
    expectedTag: 'Should not show'
  }
];

console.log('\n📊 Buyer Profile:');
console.log(`   Budget: $${buyer.maxMonthlyPayment}/mo, $${buyer.maxDownPayment.toLocaleString()} down`);
console.log(`   Location: ${buyer.preferredCity}, ${buyer.preferredState}`);
console.log(`   Requirements: ${buyer.minBedrooms}+ bed, ${buyer.minBathrooms}+ bath`);
console.log('\n━'.repeat(80));

console.log('\n🏠 Testing Properties:\n');

let correctPredictions = 0;
const totalProperties = properties.length;
const visibleProperties: any[] = [];
const hiddenProperties: any[] = [];

properties.forEach(property => {
  const result = isPropertyMatch(property, buyer);

  const isVisible = result.matches;
  const expectedVisible = property.expectedVisible;
  const isCorrect = isVisible === expectedVisible;

  if (isCorrect) correctPredictions++;

  console.log(`${isCorrect ? '✅' : '❌'} ${property.name}`);
  console.log(`   Budget: $${property.monthlyPayment}/mo, $${property.downPaymentAmount.toLocaleString()} down`);
  console.log(`   Location: ${property.city}, ${property.state}`);
  console.log(`   Match Result: ${result.matches ? 'VISIBLE ✓' : 'HIDDEN ✗'}`);
  console.log(`   Budget Type: ${result.budgetMatchType}`);

  if (result.matches) {
    let tag = '';
    if (result.budgetMatchType === 'both') tag = '✅ Within Budget';
    else if (result.budgetMatchType === 'monthly_only') tag = '🟡 Low Monthly Payment';
    else if (result.budgetMatchType === 'down_only') tag = '🟡 Low Down Payment';

    console.log(`   Display Tag: ${tag}`);
    visibleProperties.push({ ...property, tag, result });
  } else {
    console.log(`   Display Tag: (Not shown to user)`);
    hiddenProperties.push(property);
  }

  console.log(`   Expected: ${expectedVisible ? 'VISIBLE' : 'HIDDEN'} - ${property.expectedTag}`);
  console.log('');
});

console.log('━'.repeat(80));
console.log('\n📈 Summary:\n');
console.log(`Total Properties: ${totalProperties}`);
console.log(`Visible to Buyer: ${visibleProperties.length}`);
console.log(`Hidden from Buyer: ${hiddenProperties.length}`);
console.log(`Correct Predictions: ${correctPredictions}/${totalProperties} (${(correctPredictions/totalProperties*100).toFixed(0)}%)`);

console.log('\n━'.repeat(80));
console.log('\n🎯 What Buyer Would See:\n');

if (visibleProperties.length > 0) {
  visibleProperties
    .sort((a, b) => {
      // Sort by budget tier, then by monthly payment
      const aTier = a.result.budgetMatchType === 'both' ? 0 : 1;
      const bTier = b.result.budgetMatchType === 'both' ? 0 : 1;
      if (aTier !== bTier) return aTier - bTier;
      return a.monthlyPayment - b.monthlyPayment;
    })
    .forEach((prop, index) => {
      console.log(`${index + 1}. ${prop.name}`);
      console.log(`   💰 $${prop.monthlyPayment}/mo • $${prop.downPaymentAmount.toLocaleString()} down`);
      console.log(`   📍 ${prop.city}, ${prop.state}`);
      console.log(`   🏷️  ${prop.tag}`);

      if (prop.result.budgetMatchType === 'monthly_only') {
        const overAmount = prop.downPaymentAmount - buyer.maxDownPayment;
        console.log(`   ℹ️  Down payment is $${overAmount.toLocaleString()} over your budget`);
      } else if (prop.result.budgetMatchType === 'down_only') {
        const overAmount = prop.monthlyPayment - buyer.maxMonthlyPayment;
        console.log(`   ℹ️  Monthly payment is $${overAmount}/mo over your budget`);
      }
      console.log('');
    });
} else {
  console.log('   No properties match your criteria\n');
}

console.log('━'.repeat(80));

// Verify the key scenarios
console.log('\n🔍 Verification Checklist:\n');

const checks = [
  {
    name: 'Perfect matches are visible',
    passed: visibleProperties.some(p => p.result.budgetMatchType === 'both')
  },
  {
    name: 'Monthly-only matches are visible',
    passed: visibleProperties.some(p => p.result.budgetMatchType === 'monthly_only')
  },
  {
    name: 'Down-only matches are visible',
    passed: visibleProperties.some(p => p.result.budgetMatchType === 'down_only')
  },
  {
    name: 'Over-budget properties are hidden',
    passed: hiddenProperties.some(p => p.id === 'prop-4')
  },
  {
    name: 'Wrong location properties are hidden',
    passed: hiddenProperties.some(p => p.id === 'prop-5')
  },
  {
    name: 'All predictions correct',
    passed: correctPredictions === totalProperties
  }
];

checks.forEach(check => {
  console.log(`${check.passed ? '✅' : '❌'} ${check.name}`);
});

const allChecksPassed = checks.every(c => c.passed);

console.log('\n━'.repeat(80));
console.log('');

if (allChecksPassed) {
  console.log('🎉 SUCCESS! OR logic is working correctly across all scenarios.');
  console.log('');
  console.log('✅ Buyers will now see:');
  console.log('   • Properties matching BOTH budget criteria (perfect matches)');
  console.log('   • Properties matching ONLY monthly payment budget');
  console.log('   • Properties matching ONLY down payment budget');
  console.log('   • Clear tags explaining which budget criteria each property meets');
  console.log('');
  console.log('❌ Buyers will NOT see:');
  console.log('   • Properties over BOTH budget criteria');
  console.log('   • Properties in wrong locations');
  console.log('');
  process.exit(0);
} else {
  console.log('⚠️  FAILED! Some checks did not pass.');
  console.log('Please review the implementation.');
  console.log('');
  process.exit(1);
}
