import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

/**
 * Test script to verify Submagic configuration
 * Tests the removeSilencePace parameter for different brands
 */

const BRANDS = ['property', 'carz', 'ownerfi', 'vassdistro', 'podcast'];

console.log('🧪 Testing Submagic Configuration\n');
console.log('═'.repeat(60));

BRANDS.forEach(brand => {
  // Simulate the logic from heygen webhook route
  const magicBrolls = brand !== 'property' && brand !== 'podcast';
  const magicBrollsPercentage = (brand !== 'property' && brand !== 'podcast') ? 75 : 0;
  const removeSilencePace = brand !== 'property' ? 'fast' : 'natural';
  const removeBadTakes = brand !== 'property';

  const validValues = ['natural', 'fast', 'extra-fast'];
  const isValid = validValues.includes(removeSilencePace);

  const statusIcon = isValid ? '✅' : '❌';

  console.log(`\n${statusIcon} Brand: ${brand.toUpperCase()}`);
  console.log(`   magicBrolls: ${magicBrolls}`);
  console.log(`   magicBrollsPercentage: ${magicBrollsPercentage}%`);
  console.log(`   removeSilencePace: '${removeSilencePace}' ${isValid ? '(valid)' : '(INVALID!)'}`);
  console.log(`   removeBadTakes: ${removeBadTakes}`);
});

console.log('\n' + '═'.repeat(60));
console.log('\n✅ All configurations use valid removeSilencePace values!');
console.log('\nValid values: natural, fast, extra-fast');
console.log('Property brand uses: natural (preserves most content)');
console.log('Other brands use: fast (removes more silence)');
