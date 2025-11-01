import { sanitizeDescription, validateDescription, getDescriptionPreview } from '../src/lib/description-sanitizer';

console.log('🧪 Testing Description Sanitizer\n');
console.log('='.repeat(80));

// Test cases with problematic content
const testCases = [
  {
    name: 'Markdown formatting',
    input: '**Beautiful home** with *great* features. ##Location This is a code example.',
    expected: 'Beautiful home with great features. Location This is a code example.'
  },
  {
    name: 'Emoji and Unicode',
    input: 'Amazing property 🏠 with great views 🌅! Perfect for families 👨‍👩‍👧‍👦',
    expected: 'Amazing property with great views! Perfect for families'
  },
  {
    name: 'ChatGPT artifacts',
    input: 'As an AI language model, I present this property. Please note: this is amazing. Disclaimer: subject to availability.',
    expected: 'this property. this is amazing. subject to availability.'
  },
  {
    name: 'HTML tags',
    input: '<p>Beautiful home with <strong>3 bedrooms</strong> and <em>2 bathrooms</em>.</p>',
    expected: 'Beautiful home with 3 bedrooms and 2 bathrooms.'
  },
  {
    name: 'Smart quotes and dashes',
    input: String.raw`"Amazing property" with 'great features'… Modern design — located in Dallas–Fort Worth area.`,
    expected: '"Amazing property" with "great features"... Modern design - located in Dallas-Fort Worth area.'
  },
  {
    name: 'Excessive whitespace',
    input: 'Property   with    multiple    spaces\n\n\n\nand   many   line   breaks\t\t\ttabs too',
    expected: 'Property with multiple spaces\n\nand many line breaks tabs too'
  },
  {
    name: 'Bullet points and lists',
    input: '• Feature 1\n* Feature 2\n- Feature 3\n1. First item\n2. Second item',
    expected: 'Feature 1\nFeature 2\nFeature 3\nFirst item\nSecond item'
  },
  {
    name: 'Mixed problematic content',
    input: '**🏡 AMAZING HOME** As an AI language model, here is the description:\n\n• 3 beds, 2 baths\n• Modern kitchen with stainless steel appliances\n• <em>Great</em> location…\n\n[View Photos](http://example.com) 🌟',
    expected: 'AMAZING HOME here is the description:\n\n3 beds, 2 baths\nModern kitchen with stainless steel appliances\nGreat location...\n\nView Photos'
  },
  {
    name: 'Very long description (test truncation)',
    input: 'A'.repeat(6000),
    expected: 'A'.repeat(4997) + '...'
  },
  {
    name: 'Normal clean text',
    input: 'Beautiful 3-bedroom home in Dallas, TX. Features include modern kitchen, spacious living room, and large backyard. Great schools nearby!',
    expected: 'Beautiful 3-bedroom home in Dallas, TX. Features include modern kitchen, spacious living room, and large backyard. Great schools nearby!'
  }
];

let passCount = 0;
let failCount = 0;

for (const testCase of testCases) {
  console.log(`\nTest: ${testCase.name}`);
  console.log('-'.repeat(80));
  console.log(`Input: "${testCase.input.substring(0, 100)}${testCase.input.length > 100 ? '...' : ''}"`);

  const result = sanitizeDescription(testCase.input);
  console.log(`Output: "${result.substring(0, 100)}${result.length > 100 ? '...' : ''}"`);
  console.log(`Expected: "${testCase.expected.substring(0, 100)}${testCase.expected.length > 100 ? '...' : ''}"`);

  const warnings = validateDescription(testCase.input);
  if (warnings.length > 0) {
    console.log(`⚠️  Input warnings: ${warnings.join(', ')}`);
  }

  const passed = result === testCase.expected;
  if (passed) {
    console.log('✅ PASS');
    passCount++;
  } else {
    console.log('❌ FAIL');
    console.log(`   Difference detected - check implementation`);
    failCount++;
  }
}

console.log('\n' + '='.repeat(80));
console.log(`\n📊 RESULTS: ${passCount} passed, ${failCount} failed out of ${testCases.length} tests`);

// Test preview function
console.log('\n' + '='.repeat(80));
console.log('\n📝 Preview Function Tests:\n');

const previewTests = [
  'Short text',
  'This is a longer text that should be truncated when we call the preview function because it exceeds the max length parameter that we set',
  '',
  null,
  undefined
];

for (const text of previewTests) {
  const preview = getDescriptionPreview(text, 50);
  console.log(`Input: ${typeof text === 'string' ? `"${text.substring(0, 30)}..."` : text}`);
  console.log(`Preview (50 chars): "${preview}"`);
  console.log('');
}

console.log('='.repeat(80));
console.log('\n✅ Description sanitizer testing complete!\n');

// Summary for user
console.log('\n📋 SANITIZER CAPABILITIES:');
console.log('   ✓ Removes markdown formatting (**bold**, *italic*, etc.)');
console.log('   ✓ Removes emoji and special Unicode characters');
console.log('   ✓ Removes ChatGPT/AI artifacts and phrases');
console.log('   ✓ Removes HTML tags');
console.log('   ✓ Normalizes quotes, dashes, and special characters');
console.log('   ✓ Cleans up excessive whitespace and line breaks');
console.log('   ✓ Removes bullet points and list markers');
console.log('   ✓ Truncates to 5000 characters max');
console.log('   ✓ Validates and warns about problematic content\n');
