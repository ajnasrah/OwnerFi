/**
 * Test webhook validation to see what would fail
 */

interface TestProperty {
  name: string;
  opportunityId: string;
  propertyAddress?: string;
  propertyCity?: string;
  state?: string;
  price?: string | number;
}

function validateProperty(prop: TestProperty): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!prop.opportunityId) {
    errors.push('opportunityId is required');
  }
  if (!prop.propertyAddress || prop.propertyAddress.trim().length === 0) {
    errors.push('propertyAddress is required');
  }
  if (!prop.propertyCity || prop.propertyCity.trim().length === 0) {
    errors.push('propertyCity is required');
  }
  if (!prop.state) {
    errors.push('state is required');
  }

  const price = typeof prop.price === 'number' ? prop.price : parseFloat(String(prop.price || '0').replace(/[$,]/g, ''));
  if (!price || price <= 0) {
    errors.push('price must be greater than 0');
  }

  return { valid: errors.length === 0, errors };
}

console.log('\n🧪 Testing Webhook Validation Logic');
console.log('='.repeat(80));

const testCases: TestProperty[] = [
  {
    name: 'Valid Property',
    opportunityId: 'test123',
    propertyAddress: '123 Main St',
    propertyCity: 'Memphis',
    state: 'TN',
    price: 150000
  },
  {
    name: 'Missing Address',
    opportunityId: 'test456',
    propertyAddress: '',
    propertyCity: 'Memphis',
    state: 'TN',
    price: 150000
  },
  {
    name: 'Missing City',
    opportunityId: 'test789',
    propertyAddress: '123 Main St',
    propertyCity: '',
    state: 'TN',
    price: 150000
  },
  {
    name: 'Missing State',
    opportunityId: 'test101',
    propertyAddress: '123 Main St',
    propertyCity: 'Memphis',
    state: '',
    price: 150000
  },
  {
    name: 'Missing Price',
    opportunityId: 'test102',
    propertyAddress: '123 Main St',
    propertyCity: 'Memphis',
    state: 'TN',
    price: 0
  },
  {
    name: 'Price as String',
    opportunityId: 'test103',
    propertyAddress: '123 Main St',
    propertyCity: 'Memphis',
    state: 'TN',
    price: '$150,000'
  },
  {
    name: 'All Fields Missing',
    opportunityId: '',
    propertyAddress: '',
    propertyCity: '',
    state: '',
    price: 0
  }
];

testCases.forEach((testCase, i) => {
  const result = validateProperty(testCase);
  console.log(`\n${i + 1}. ${testCase.name}`);
  console.log(`   Result: ${result.valid ? '✅ VALID' : '❌ INVALID'}`);
  if (!result.valid) {
    result.errors.forEach(err => console.log(`   - ${err}`));
  }
});

console.log('\n\n📋 Summary of Required Fields:');
console.log('='.repeat(80));
console.log('\nFor a property to be created via GHL webhook, it MUST have:');
console.log('  1. opportunityId (unique ID from GHL)');
console.log('  2. propertyAddress (cannot be empty string)');
console.log('  3. propertyCity (cannot be empty string)');
console.log('  4. state (any value)');
console.log('  5. price (must be > 0, can be string like "$150,000")');

console.log('\n\n💡 Why 44 Properties Might Be Missing:');
console.log('='.repeat(80));
console.log('\n1. GHL Custom Fields Not Mapped:');
console.log('   - Check if "propertyAddress", "propertyCity", "state", "price" exist in GHL');
console.log('   - These fields must be populated for ALL opportunities');

console.log('\n2. Webhook Only Triggers on Certain Stages:');
console.log('   - GHL webhooks can be configured to only fire on specific pipeline stages');
console.log('   - If 44 properties are in stages that don\'t trigger webhook, they won\'t sync');

console.log('\n3. Properties Created Before Webhook Was Set Up:');
console.log('   - If webhook was recently configured, older opportunities won\'t sync');
console.log('   - Need to manually import existing opportunities');

console.log('\n4. Different Pipeline:');
console.log('   - If the 44 properties are in a different pipeline than configured');
console.log('   - Webhook only fires for opportunities in the configured pipeline');

console.log('\n\n🔧 How to Sync Missing Properties:');
console.log('='.repeat(80));
console.log('\n1. Check GHL webhook logs for errors');
console.log('2. Ensure all custom fields are mapped correctly');
console.log('3. Verify webhook is configured for ALL pipeline stages');
console.log('4. For existing opportunities, use the import script or trigger webhook manually');
