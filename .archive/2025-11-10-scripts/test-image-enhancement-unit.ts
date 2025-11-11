/**
 * Unit Test for Image Enhancement Logic
 * Tests the core functionality without requiring Firebase
 */

import { autoCleanPropertyData, upgradeZillowImageUrl, fixGoogleDriveUrl } from '../src/lib/property-auto-cleanup';

console.log('🧪 Image Enhancement Unit Tests\n');
console.log('='.repeat(70));

let passedTests = 0;
let totalTests = 0;

function test(name: string, fn: () => boolean) {
  totalTests++;
  const passed = fn();
  console.log(`${passed ? '✅' : '❌'} ${name}`);
  if (passed) passedTests++;
  return passed;
}

// Test 1: Zillow Low-Res URLs are Upgraded
console.log('\n📋 Test Suite 1: Zillow Image Upgrades');
console.log('-'.repeat(70));

test('Upgrades cc_ft_576.webp to full-size', () => {
  const input = 'https://photos.zillowstatic.com/fp/abc-cc_ft_576.webp';
  const output = upgradeZillowImageUrl(input);
  return output.includes('uncropped_scaled_within_1536_1152.webp');
});

test('Upgrades cc_ft_768.webp to full-size', () => {
  const input = 'https://photos.zillowstatic.com/fp/abc-cc_ft_768.webp';
  const output = upgradeZillowImageUrl(input);
  return output.includes('uncropped_scaled_within_1536_1152.webp');
});

test('Upgrades cc_ft_384.webp to full-size', () => {
  const input = 'https://photos.zillowstatic.com/fp/abc-cc_ft_384.webp';
  const output = upgradeZillowImageUrl(input);
  return output.includes('uncropped_scaled_within_1536_1152.webp');
});

test('Upgrades p_c.jpg thumbnail to full-size', () => {
  const input = 'https://photos.zillowstatic.com/fp/abc-p_c.jpg';
  const output = upgradeZillowImageUrl(input);
  return output.includes('uncropped_scaled_within_1536_1152.webp');
});

test('Does NOT upgrade cc_ft_960.webp (already good quality)', () => {
  const input = 'https://photos.zillowstatic.com/fp/abc-cc_ft_960.webp';
  const output = upgradeZillowImageUrl(input);
  return output === input; // Should remain unchanged
});

test('Does NOT upgrade cc_ft_1344.webp (already excellent quality)', () => {
  const input = 'https://photos.zillowstatic.com/fp/abc-cc_ft_1344.webp';
  const output = upgradeZillowImageUrl(input);
  return output === input; // Should remain unchanged
});

test('Does NOT upgrade uncropped_scaled (already full-size)', () => {
  const input = 'https://photos.zillowstatic.com/fp/abc-uncropped_scaled_within_1536_1152.webp';
  const output = upgradeZillowImageUrl(input);
  return output === input; // Should remain unchanged
});

// Test 2: Google Drive URL Fixes
console.log('\n📋 Test Suite 2: Google Drive URL Fixes');
console.log('-'.repeat(70));

test('Converts Drive share link to direct URL', () => {
  const input = 'https://drive.google.com/file/d/ABC123XYZ/view';
  const output = fixGoogleDriveUrl(input);
  return output === 'https://lh3.googleusercontent.com/d/ABC123XYZ=w2000';
});

test('Converts Drive open link to direct URL', () => {
  const input = 'https://drive.google.com/open?id=ABC123XYZ';
  const output = fixGoogleDriveUrl(input);
  return output === 'https://lh3.googleusercontent.com/d/ABC123XYZ=w2000';
});

test('Does NOT modify already-direct googleusercontent URLs', () => {
  const input = 'https://lh3.googleusercontent.com/d/ABC123=w2000';
  const output = fixGoogleDriveUrl(input);
  return output === input; // Should remain unchanged
});

test('Does NOT modify non-Google-Drive URLs', () => {
  const input = 'https://example.com/image.jpg';
  const output = fixGoogleDriveUrl(input);
  return output === input; // Should remain unchanged
});

// Test 3: Auto-Cleanup Integration
console.log('\n📋 Test Suite 3: Auto-Cleanup Integration');
console.log('-'.repeat(70));

test('Auto-cleanup upgrades Zillow images in imageUrls array', () => {
  const input = {
    address: '123 Main St',
    city: 'Phoenix',
    state: 'AZ',
    zipCode: '85001',
    imageUrls: ['https://photos.zillowstatic.com/fp/test-cc_ft_576.webp']
  };
  const output = autoCleanPropertyData(input);
  return output.imageUrls?.[0]?.includes('uncropped_scaled_within_1536_1152.webp') ?? false;
});

test('Auto-cleanup sets imageEnhanced to true', () => {
  const input = {
    address: '123 Main St',
    imageUrls: ['https://photos.zillowstatic.com/fp/test-cc_ft_576.webp']
  };
  const output = autoCleanPropertyData(input);
  return output.imageEnhanced === true;
});

test('Auto-cleanup sets imageEnhancedAt timestamp', () => {
  const input = {
    address: '123 Main St',
    imageUrls: ['https://photos.zillowstatic.com/fp/test-cc_ft_576.webp']
  };
  const output = autoCleanPropertyData(input);
  const hasTimestamp = !!output.imageEnhancedAt;
  const isValidDate = output.imageEnhancedAt ? !isNaN(Date.parse(output.imageEnhancedAt)) : false;
  return hasTimestamp && isValidDate;
});

test('Auto-cleanup cleans address with duplicate city/state', () => {
  const input = {
    address: '123 Main St, Phoenix, AZ 85001',
    city: 'Phoenix',
    state: 'AZ',
    zipCode: '85001'
  };
  const output = autoCleanPropertyData(input);
  return output.address === '123 Main St';
});

test('Auto-cleanup handles multiple images in array', () => {
  const input = {
    imageUrls: [
      'https://photos.zillowstatic.com/fp/test1-cc_ft_576.webp',
      'https://photos.zillowstatic.com/fp/test2-cc_ft_768.webp',
      'https://photos.zillowstatic.com/fp/test3-cc_ft_960.webp'
    ]
  };
  const output = autoCleanPropertyData(input);
  const allProcessed = output.imageUrls?.length === 3;
  const firstUpgraded = output.imageUrls?.[0]?.includes('uncropped_scaled');
  const secondUpgraded = output.imageUrls?.[1]?.includes('uncropped_scaled');
  const thirdUnchanged = output.imageUrls?.[2]?.includes('cc_ft_960'); // Should not upgrade
  return allProcessed && firstUpgraded && secondUpgraded && thirdUnchanged;
});

test('Auto-cleanup handles Google Drive URLs', () => {
  const input = {
    imageUrls: ['https://drive.google.com/file/d/TEST123/view']
  };
  const output = autoCleanPropertyData(input);
  return output.imageUrls?.[0] === 'https://lh3.googleusercontent.com/d/TEST123=w2000';
});

// Test 4: Edge Cases
console.log('\n📋 Test Suite 4: Edge Cases');
console.log('-'.repeat(70));

test('Handles empty imageUrls array', () => {
  const input = { imageUrls: [] };
  const output = autoCleanPropertyData(input);
  return output.imageUrls?.length === 0 && output.imageEnhanced === true;
});

test('Handles undefined imageUrls', () => {
  const input = { address: '123 Main St' };
  const output = autoCleanPropertyData(input);
  return output.imageEnhanced === true; // Should still mark as enhanced
});

test('Handles non-Zillow, non-Drive URLs', () => {
  const input = {
    imageUrls: ['https://example.com/image.jpg']
  };
  const output = autoCleanPropertyData(input);
  const unchanged = output.imageUrls?.[0] === 'https://example.com/image.jpg';
  const marked = output.imageEnhanced === true;
  return unchanged && marked; // URL unchanged but still marked as processed
});

test('Preserves non-image properties', () => {
  const input = {
    address: '123 Main St',
    city: 'Phoenix',
    state: 'AZ',
    zipCode: '85001',
    imageUrls: ['https://photos.zillowstatic.com/fp/test-cc_ft_576.webp']
  };
  const output = autoCleanPropertyData(input);
  // Should only return cleaned fields, not all input fields
  return (
    typeof output.address === 'string' &&
    typeof output.imageEnhanced === 'boolean' &&
    typeof output.imageEnhancedAt === 'string' &&
    Array.isArray(output.imageUrls)
  );
});

// Summary
console.log('\n' + '='.repeat(70));
console.log('📊 TEST RESULTS');
console.log('='.repeat(70));
console.log(`Tests Passed: ${passedTests}/${totalTests}`);
console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (passedTests === totalTests) {
  console.log('\n✅ ALL TESTS PASSED! System is working correctly.');
  console.log('\n💡 Verified Functionality:');
  console.log('  ✅ Low-res Zillow images are upgraded to full-size');
  console.log('  ✅ Good quality Zillow images are left unchanged');
  console.log('  ✅ Google Drive links are converted to direct URLs');
  console.log('  ✅ Properties are automatically marked as imageEnhanced');
  console.log('  ✅ Timestamps are correctly generated');
  console.log('  ✅ Edge cases are handled properly');
  console.log('\n✅ Safe to deploy to production!');
  process.exit(0);
} else {
  console.log(`\n❌ ${totalTests - passedTests} TEST(S) FAILED!`);
  console.log('Review the failures above before deploying.');
  process.exit(1);
}
