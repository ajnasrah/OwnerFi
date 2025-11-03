/**
 * Quick validation of platform group configuration
 * No Firebase required - just validates the logic
 */

import { getPlatformGroups, validatePlatformGroups, getScheduleDescription } from '../src/lib/platform-scheduling';
import { getAllBrandIds } from '../src/lib/brand-utils';
import { Brand } from '../src/config/constants';

console.log('🔍 Validating Platform Group Configuration\n');
console.log('='.repeat(80));

const brands = getAllBrandIds();
let allValid = true;

for (const brand of brands) {
  console.log(`\n📊 ${brand.toUpperCase()}`);
  console.log('-'.repeat(80));

  // Get platform groups
  const groups = getPlatformGroups(brand as Brand);

  console.log(`   Platform Groups: ${groups.length}`);
  for (const group of groups) {
    const timeStr = `${group.hourCST % 12 || 12}${group.hourCST >= 12 ? 'PM' : 'AM'} CST`;
    console.log(`   • ${group.label} (${timeStr})`);
    console.log(`     Platforms: ${group.platforms.join(', ')}`);
    console.log(`     ${group.description}`);
  }

  // Validate all platforms are covered
  const validation = validatePlatformGroups(brand as Brand);

  if (validation.valid) {
    console.log(`   ✅ All ${validation.coveredPlatforms.length} platforms covered`);
  } else {
    console.log(`   ❌ MISSING PLATFORMS: ${validation.missingPlatforms.join(', ')}`);
    allValid = false;
  }

  // Show schedule description
  console.log(`\n   📅 ${getScheduleDescription(brand as Brand)}`);
}

console.log('\n' + '='.repeat(80));

if (allValid) {
  console.log('✅ Configuration Valid - All brands have complete platform coverage\n');
  process.exit(0);
} else {
  console.log('❌ Configuration Invalid - Some brands have missing platforms\n');
  process.exit(1);
}
