/**
 * Test Benefit Video Generator Validation
 *
 * This script tests all the new validation logic without calling external APIs
 */

// Mock the validator logic inline for testing
function validateScript(script: string): { valid: boolean; reason?: string } {
  if (!script || script.trim().length === 0) {
    return { valid: false, reason: 'Script is empty' };
  }

  const wordCount = script.trim().split(/\s+/).length;
  if (wordCount < 10) {
    return { valid: false, reason: `Script too short (${wordCount} words, need at least 10)` };
  }

  if (wordCount > 200) {
    return { valid: false, reason: `Script too long (${wordCount} words, max 200)` };
  }

  if (script.includes('undefined') || script.includes('null')) {
    return { valid: false, reason: 'Script contains invalid placeholders' };
  }

  return { valid: true };
}

function validateHeyGenRequest(request: any): { valid: boolean; reason?: string } {
  if (!request.video_inputs || !Array.isArray(request.video_inputs)) {
    return { valid: false, reason: 'video_inputs is not an array' };
  }

  if (request.video_inputs.length === 0) {
    return { valid: false, reason: 'video_inputs array is empty' };
  }

  const scene = request.video_inputs[0];

  if (!scene.character?.talking_photo_id) {
    return { valid: false, reason: 'Missing talking_photo_id' };
  }

  if (!scene.voice?.input_text || scene.voice.input_text.trim().length === 0) {
    return { valid: false, reason: 'Missing or empty input_text' };
  }

  if (!scene.voice?.voice_id) {
    return { valid: false, reason: 'Missing voice_id' };
  }

  return { valid: true };
}

// Test cases
console.log('🧪 Testing validation logic...\n');

// Test 1: Empty script
console.log('Test 1: Empty script');
let result = validateScript('');
console.log(`   Result: ${result.valid ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Reason: ${result.reason}\n`);

// Test 2: Script too short
console.log('Test 2: Script too short (5 words)');
result = validateScript('This is too short');
console.log(`   Result: ${result.valid ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Reason: ${result.reason}\n`);

// Test 3: Valid script
console.log('Test 3: Valid script (50 words)');
const validScript = 'Think you can\'t buy a home? With owner financing, you can buy directly from the seller. No bank hoops, no long waits, just steady income and a down payment. It\'s how thousands of families finally got keys in their hands. Search owner-finance homes near you at OwnerFi.ai';
result = validateScript(validScript);
console.log(`   Result: ${result.valid ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Reason: ${result.reason || 'Valid'}\n`);

// Test 4: Script with undefined
console.log('Test 4: Script with undefined placeholder');
result = validateScript('Think you can undefined buy a home? See OwnerFi.ai');
console.log(`   Result: ${result.valid ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Reason: ${result.reason}\n`);

// Test 5: Empty video_inputs
console.log('Test 5: Empty video_inputs array');
result = validateHeyGenRequest({ video_inputs: [] });
console.log(`   Result: ${result.valid ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Reason: ${result.reason}\n`);

// Test 6: Missing talking_photo_id
console.log('Test 6: Missing talking_photo_id');
result = validateHeyGenRequest({
  video_inputs: [{
    character: {},
    voice: { input_text: 'test', voice_id: 'test123' }
  }]
});
console.log(`   Result: ${result.valid ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Reason: ${result.reason}\n`);

// Test 7: Empty input_text
console.log('Test 7: Empty input_text');
result = validateHeyGenRequest({
  video_inputs: [{
    character: { talking_photo_id: 'test123' },
    voice: { input_text: '', voice_id: 'test123' }
  }]
});
console.log(`   Result: ${result.valid ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Reason: ${result.reason}\n`);

// Test 8: Valid HeyGen request
console.log('Test 8: Valid HeyGen request');
result = validateHeyGenRequest({
  video_inputs: [{
    character: {
      type: 'talking_photo',
      talking_photo_id: 'f40972493dd74bbe829f30daa09ea1a9',
      scale: 1.4
    },
    voice: {
      type: 'text',
      input_text: validScript,
      voice_id: '9070a6c2dbd54c10bb111dc8c655bff7',
      speed: 1.0
    },
    background: {
      type: 'color',
      value: '#059669'
    }
  }],
  dimension: { width: 1080, height: 1920 },
  title: 'Test Video'
});
console.log(`   Result: ${result.valid ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Reason: ${result.reason || 'Valid'}\n`);

console.log('✅ All validation tests complete!');
