/**
 * UNIFIED PHONE NUMBER UTILITIES
 *
 * This is the SINGLE source of truth for phone number handling.
 * All phone operations MUST use these utilities.
 *
 * STANDARD FORMAT: E.164 (+1XXXXXXXXXX for US numbers)
 * Example: +19018319661
 */

/**
 * Normalize phone number to E.164 format (+1XXXXXXXXXX)
 * This is the CANONICAL format stored in the database.
 *
 * @param phone - Phone number in any format
 * @returns Phone number in E.164 format (+1XXXXXXXXXX)
 *
 * @example
 * normalizePhone('9018319661') // '+19018319661'
 * normalizePhone('(901) 831-9661') // '+19018319661'
 * normalizePhone('+1 901-831-9661') // '+19018319661'
 * normalizePhone('+19018319661') // '+19018319661'
 */
export function normalizePhone(phone: string): string {
  if (!phone) {
    throw new Error('Phone number is required');
  }

  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');

  // Validate we have digits
  if (!cleaned) {
    throw new Error('Phone number must contain digits');
  }

  // If it starts with 1 and is 11 digits, add +
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }

  // If it's 10 digits, add +1
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // If original starts with +, return cleaned with +
  if (phone.trim().startsWith('+')) {
    return `+${cleaned}`;
  }

  // Default: assume US number, add +1
  if (cleaned.length >= 10) {
    // Take last 10 digits and add +1
    return `+1${cleaned.slice(-10)}`;
  }

  throw new Error(`Invalid phone number format: ${phone}`);
}

/**
 * Generate all possible phone number formats for database lookup
 * Use this when querying the database for existing users.
 *
 * @param phone - Phone number in any format
 * @returns Array of possible formats
 *
 * @example
 * getAllPhoneFormats('+19018319661')
 * // Returns:
 * // [
 * //   '+19018319661',           // E.164 (canonical)
 * //   '9018319661',             // 10 digits
 * //   '19018319661',            // 11 digits
 * //   '(901) 831-9661'          // Formatted
 * // ]
 */
export function getAllPhoneFormats(phone: string): string[] {
  if (!phone) {
    return [];
  }

  try {
    // First normalize to E.164
    const normalized = normalizePhone(phone);

    // Extract just the digits
    const cleaned = normalized.replace(/\D/g, '');

    // Get last 10 digits (the actual phone number)
    const last10 = cleaned.slice(-10);

    // Generate all possible formats
    const formats = [
      normalized,                                                                    // E.164: +19018319661
      last10,                                                                        // 10 digits: 9018319661
      cleaned,                                                                       // 11 digits: 19018319661
      `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`,          // Formatted: (901) 831-9661
    ];

    // Remove duplicates and return
    return Array.from(new Set(formats));
  } catch (error) {
    // If normalization fails, return empty array
    console.error('Failed to generate phone formats:', error);
    return [];
  }
}

/**
 * Validate phone number format
 *
 * @param phone - Phone number to validate
 * @returns true if valid, false otherwise
 */
export function isValidPhone(phone: string): boolean {
  if (!phone) {
    return false;
  }

  try {
    // Try to normalize - if it succeeds, it's valid
    const normalized = normalizePhone(phone);

    // Additional validation: must be E.164 format with exactly 12 characters (+1 + 10 digits)
    // This is US-specific validation
    return /^\+1\d{10}$/.test(normalized);
  } catch {
    return false;
  }
}

/**
 * Format phone number for display
 *
 * @param phone - Phone number in any format
 * @returns Formatted phone: (XXX) XXX-XXXX
 *
 * @example
 * formatPhoneForDisplay('+19018319661') // '(901) 831-9661'
 */
export function formatPhoneForDisplay(phone: string): string {
  if (!phone) {
    return '';
  }

  try {
    const normalized = normalizePhone(phone);
    const cleaned = normalized.replace(/\D/g, '');
    const last10 = cleaned.slice(-10);

    return `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
  } catch {
    // If normalization fails, return original
    return phone;
  }
}

/**
 * Compare two phone numbers for equality
 *
 * @param phone1 - First phone number
 * @param phone2 - Second phone number
 * @returns true if same number, false otherwise
 *
 * @example
 * arePhoneNumbersEqual('9018319661', '+19018319661') // true
 * arePhoneNumbersEqual('(901) 831-9661', '9018319661') // true
 */
export function arePhoneNumbersEqual(phone1: string, phone2: string): boolean {
  if (!phone1 || !phone2) {
    return false;
  }

  try {
    const normalized1 = normalizePhone(phone1);
    const normalized2 = normalizePhone(phone2);
    return normalized1 === normalized2;
  } catch {
    return false;
  }
}

/**
 * Test suite - Run this to verify all utilities work correctly
 */
export function testPhoneUtils(): void {
  console.log('🧪 Testing Phone Utilities...\n');

  const testCases = [
    // Input -> Expected normalized output
    { input: '9018319661', expected: '+19018319661' },
    { input: '(901) 831-9661', expected: '+19018319661' },
    { input: '+1 901-831-9661', expected: '+19018319661' },
    { input: '+19018319661', expected: '+19018319661' },
    { input: '19018319661', expected: '+19018319661' },
    { input: '1-901-831-9661', expected: '+19018319661' },
    { input: '901.831.9661', expected: '+19018319661' },
  ];

  let passed = 0;
  let failed = 0;

  console.log('Test 1: normalizePhone()');
  testCases.forEach((test, i) => {
    try {
      const result = normalizePhone(test.input);
      if (result === test.expected) {
        console.log(`  ✅ Case ${i + 1}: "${test.input}" -> "${result}"`);
        passed++;
      } else {
        console.log(`  ❌ Case ${i + 1}: "${test.input}" -> "${result}" (expected "${test.expected}")`);
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ Case ${i + 1}: "${test.input}" threw error:`, error);
      failed++;
    }
  });

  console.log('\nTest 2: getAllPhoneFormats()');
  const formats = getAllPhoneFormats('+19018319661');
  console.log('  Formats generated:', formats);
  if (formats.length === 4) {
    console.log('  ✅ Generated 4 formats');
    passed++;
  } else {
    console.log(`  ❌ Expected 4 formats, got ${formats.length}`);
    failed++;
  }

  console.log('\nTest 3: arePhoneNumbersEqual()');
  const equalityTests = [
    { phone1: '9018319661', phone2: '+19018319661', expected: true },
    { phone1: '(901) 831-9661', phone2: '9018319661', expected: true },
    { phone1: '9018319661', phone2: '9018319662', expected: false },
  ];

  equalityTests.forEach((test, i) => {
    const result = arePhoneNumbersEqual(test.phone1, test.phone2);
    if (result === test.expected) {
      console.log(`  ✅ Case ${i + 1}: "${test.phone1}" vs "${test.phone2}" = ${result}`);
      passed++;
    } else {
      console.log(`  ❌ Case ${i + 1}: "${test.phone1}" vs "${test.phone2}" = ${result} (expected ${test.expected})`);
      failed++;
    }
  });

  console.log('\nTest 4: formatPhoneForDisplay()');
  const displayFormat = formatPhoneForDisplay('+19018319661');
  if (displayFormat === '(901) 831-9661') {
    console.log(`  ✅ Display format: ${displayFormat}`);
    passed++;
  } else {
    console.log(`  ❌ Display format: ${displayFormat} (expected "(901) 831-9661")`);
    failed++;
  }

  console.log('\nTest 5: isValidPhone()');
  const validityTests = [
    { phone: '9018319661', expected: true },
    { phone: '+19018319661', expected: true },
    { phone: '12345', expected: false },
    { phone: 'abcd', expected: false },
    { phone: '', expected: false },
  ];

  validityTests.forEach((test, i) => {
    const result = isValidPhone(test.phone);
    if (result === test.expected) {
      console.log(`  ✅ Case ${i + 1}: "${test.phone}" -> ${result}`);
      passed++;
    } else {
      console.log(`  ❌ Case ${i + 1}: "${test.phone}" -> ${result} (expected ${test.expected})`);
      failed++;
    }
  });

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Total: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}\n`);

  if (failed === 0) {
    console.log('✅ ALL TESTS PASSED!\n');
  } else {
    console.log(`❌ ${failed} TESTS FAILED!\n`);
  }
}
