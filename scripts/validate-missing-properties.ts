import * as fs from 'fs';

const missing = JSON.parse(
  fs.readFileSync('/Users/abdullahabunasrah/Desktop/ownerfi/scripts/missing-exported-properties.json', 'utf-8')
);

console.log('Checking validation for 10 missing properties:\n');

missing.forEach((prop: any, i: number) => {
  console.log(`${i + 1}. ${prop['Opportunity Name']}`);
  console.log(`   OpportunityId: ${prop['Opportunity ID'] || '❌ MISSING'}`);
  console.log(`   Address: ${prop['Property Address'] || '❌ MISSING'}`);
  console.log(`   City: ${prop['Property city'] || '❌ MISSING'}`);
  console.log(`   State: ${prop['State '] || prop['State'] || '❌ MISSING'}`);
  console.log(`   Price: ${prop['Price'] || '❌ MISSING'}`);

  const issues = [];
  if (!prop['Opportunity ID']) issues.push('Missing OpportunityId');
  if (!prop['Property Address'] || !prop['Property Address'].trim()) issues.push('Missing/Empty Address');
  if (!prop['Property city'] || !prop['Property city'].trim()) issues.push('Missing/Empty City');
  if (!prop['State '] && !prop['State']) issues.push('Missing State');
  if (!prop['Price'] || parseFloat(prop['Price']) <= 0) issues.push('Invalid Price');

  if (issues.length > 0) {
    console.log(`   ⚠️  VALIDATION ISSUES: ${issues.join(', ')}`);
  } else {
    console.log(`   ✅ All required fields present`);
  }
  console.log('');
});
