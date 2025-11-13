/**
 * Unit tests for Zillow scraper deduplication logic
 * Tests the algorithms without requiring Firebase
 */

interface Property {
  zpid: string | number;
  estimate?: number;
  price?: number;
  agentPhoneNumber?: string;
  brokerPhoneNumber?: string;
  importedAt?: Date;
}

interface TestResult {
  test: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function testURLDeduplication() {
  console.log('\n🧪 TEST 1: URL Deduplication');
  console.log('=' .repeat(50));

  // Simulate duplicate URLs (same as real scraper does)
  const urls = [
    'https://zillow.com/property1',
    'https://zillow.com/property2',
    'https://zillow.com/property1', // duplicate
    'https://zillow.com/property3',
    'https://zillow.com/property2', // duplicate
    'https://zillow.com/property4',
    'https://zillow.com/property1', // duplicate again
  ];

  // Real implementation from scraper
  const uniqueUrls = Array.from(new Set(urls));
  const duplicatesRemoved = urls.length - uniqueUrls.length;

  const passed = uniqueUrls.length === 4 && duplicatesRemoved === 3;

  console.log(`   Original URLs: ${urls.length}`);
  console.log(`   Unique URLs: ${uniqueUrls.length}`);
  console.log(`   Duplicates removed: ${duplicatesRemoved}`);
  console.log(`   Expected: 4 unique, 3 duplicates`);
  console.log(`   ${passed ? '✅ PASS' : '❌ FAIL'}`);

  results.push({
    test: 'URL Deduplication',
    passed,
    details: `Removed ${duplicatesRemoved}/${urls.length - 4} expected duplicates`
  });
}

function testZPIDDeduplication() {
  console.log('\n🧪 TEST 2: ZPID Deduplication');
  console.log('=' .repeat(50));

  // Simulate properties with duplicate ZPIDs
  const properties: Property[] = [
    { zpid: '12345', estimate: 500000, importedAt: new Date('2024-01-01') },
    { zpid: '67890', estimate: 400000, importedAt: new Date('2024-01-02') },
    { zpid: '12345', estimate: 510000, importedAt: new Date('2024-01-03') }, // duplicate, newer
    { zpid: '11111', estimate: 300000, importedAt: new Date('2024-01-04') },
    { zpid: '67890', estimate: 420000, importedAt: new Date('2024-01-01') }, // duplicate, older
  ];

  // Real implementation from send-to-ghl
  const zpidMap = new Map();
  for (const property of properties) {
    const zpid = String(property.zpid);
    if (!zpid || zpid === '0') continue;

    const existing = zpidMap.get(zpid);
    if (!existing || (property.importedAt && existing.importedAt && property.importedAt > existing.importedAt)) {
      zpidMap.set(zpid, property);
    }
  }

  const uniqueProperties = Array.from(zpidMap.values());
  const passed = uniqueProperties.length === 3 &&
                zpidMap.get('12345').estimate === 510000 && // Kept newer one
                zpidMap.get('67890').estimate === 400000;   // Kept newer one

  console.log(`   Total properties: ${properties.length}`);
  console.log(`   Unique by ZPID: ${uniqueProperties.length}`);
  console.log(`   Duplicates removed: ${properties.length - uniqueProperties.length}`);
  console.log(`   ZPID 12345 value: $${zpidMap.get('12345').estimate} (kept newer)`);
  console.log(`   ZPID 67890 value: $${zpidMap.get('67890').estimate} (kept newer)`);
  console.log(`   ${passed ? '✅ PASS' : '❌ FAIL'}`);

  results.push({
    test: 'ZPID Deduplication',
    passed,
    details: `Kept ${uniqueProperties.length} unique properties (most recent versions)`
  });
}

function testContactLimit() {
  console.log('\n🧪 TEST 3: Contact-Based Deduplication (Max 3 per contact)');
  console.log('=' .repeat(50));

  // Simulate multiple properties from same agents
  const properties: Property[] = [
    // Agent 1: 5 properties
    { zpid: 1, estimate: 500000, agentPhoneNumber: '555-1111' },
    { zpid: 2, estimate: 400000, agentPhoneNumber: '555-1111' },
    { zpid: 3, estimate: 300000, agentPhoneNumber: '555-1111' },
    { zpid: 4, estimate: 200000, agentPhoneNumber: '555-1111' }, // Should skip
    { zpid: 5, estimate: 100000, agentPhoneNumber: '555-1111' }, // Should skip

    // Agent 2: 2 properties
    { zpid: 6, estimate: 350000, agentPhoneNumber: '555-2222' },
    { zpid: 7, estimate: 250000, agentPhoneNumber: '555-2222' },

    // Agent 3: 4 properties
    { zpid: 8, estimate: 600000, brokerPhoneNumber: '555-3333' },
    { zpid: 9, estimate: 550000, brokerPhoneNumber: '555-3333' },
    { zpid: 10, estimate: 450000, brokerPhoneNumber: '555-3333' },
    { zpid: 11, estimate: 150000, brokerPhoneNumber: '555-3333' }, // Should skip
  ];

  // Real implementation from send-to-ghl
  const contactMap = new Map();
  for (const property of properties) {
    const phone = property.agentPhoneNumber || property.brokerPhoneNumber;
    if (!phone) continue;
    const cleanPhone = phone.replace(/\D/g, '');

    if (!contactMap.has(cleanPhone)) {
      contactMap.set(cleanPhone, []);
    }
    contactMap.get(cleanPhone).push(property);
  }

  const toSend: Property[] = [];
  let propertiesSkipped = 0;

  for (const [phone, contactProperties] of contactMap.entries()) {
    const sorted = contactProperties.sort((a: any, b: any) =>
      (b.estimate || b.price || 0) - (a.estimate || a.price || 0)
    );

    const send = sorted.slice(0, 3);
    const skip = sorted.length - send.length;

    toSend.push(...send);
    propertiesSkipped += skip;
  }

  const passed = toSend.length === 8 && // 3 + 2 + 3
                propertiesSkipped === 3 && // 2 + 0 + 1
                contactMap.size === 3;

  console.log(`   Total properties: ${properties.length}`);
  console.log(`   Unique contacts: ${contactMap.size}`);
  console.log(`   Properties to send: ${toSend.length}`);
  console.log(`   Properties skipped: ${propertiesSkipped}`);
  console.log('\n   Breakdown by contact:');

  let contactNum = 1;
  for (const [phone, contactProperties] of contactMap.entries()) {
    const sorted = contactProperties.sort((a: any, b: any) =>
      (b.estimate || b.price || 0) - (a.estimate || a.price || 0)
    );
    const sendCount = Math.min(3, sorted.length);
    const skipCount = sorted.length - sendCount;

    console.log(`   Contact ${contactNum} (${phone.slice(-4)}): ${contactProperties.length} total, sending ${sendCount}, skipping ${skipCount}`);
    contactNum++;
  }

  console.log(`\n   ${passed ? '✅ PASS' : '❌ FAIL'}`);

  results.push({
    test: 'Contact Limit',
    passed,
    details: `Sent ${toSend.length} properties (${propertiesSkipped} skipped), max 3 per contact`
  });
}

function testCombinedDeduplication() {
  console.log('\n🧪 TEST 4: Combined Deduplication (ZPID + Contact)');
  console.log('=' .repeat(50));

  // Realistic scenario: duplicates + same contact
  const properties: Property[] = [
    // Agent 1 has 3 unique properties, but 2 are duplicates
    { zpid: '100', estimate: 500000, agentPhoneNumber: '555-1111', importedAt: new Date('2024-01-01') },
    { zpid: '101', estimate: 400000, agentPhoneNumber: '555-1111', importedAt: new Date('2024-01-02') },
    { zpid: '102', estimate: 300000, agentPhoneNumber: '555-1111', importedAt: new Date('2024-01-03') },
    { zpid: '100', estimate: 505000, agentPhoneNumber: '555-1111', importedAt: new Date('2024-01-05') }, // Duplicate ZPID, newer
    { zpid: '103', estimate: 250000, agentPhoneNumber: '555-1111', importedAt: new Date('2024-01-04') },
    { zpid: '104', estimate: 200000, agentPhoneNumber: '555-1111', importedAt: new Date('2024-01-06') },
  ];

  // Step 1: ZPID deduplication
  const zpidMap = new Map();
  for (const property of properties) {
    const zpid = String(property.zpid);
    const existing = zpidMap.get(zpid);
    if (!existing || (property.importedAt && existing.importedAt && property.importedAt > existing.importedAt)) {
      zpidMap.set(zpid, property);
    }
  }

  // Step 2: Contact deduplication
  const contactMap = new Map();
  for (const property of zpidMap.values()) {
    const phone = property.agentPhoneNumber || property.brokerPhoneNumber;
    if (!phone) continue;
    const cleanPhone = phone.replace(/\D/g, '');

    if (!contactMap.has(cleanPhone)) {
      contactMap.set(cleanPhone, []);
    }
    contactMap.get(cleanPhone).push(property);
  }

  const toSend: Property[] = [];
  for (const [phone, contactProperties] of contactMap.entries()) {
    const sorted = contactProperties.sort((a: any, b: any) =>
      (b.estimate || b.price || 0) - (a.estimate || a.price || 0)
    );
    toSend.push(...sorted.slice(0, 3));
  }

  const passed = properties.length === 6 &&
                zpidMap.size === 5 &&           // One ZPID duplicate removed
                toSend.length === 3 &&          // Max 3 per contact
                toSend[0].zpid === '100' &&     // Kept newer version
                toSend[0].estimate === 505000;   // With updated estimate

  console.log(`   Original properties: ${properties.length}`);
  console.log(`   After ZPID dedup: ${zpidMap.size} (removed ${properties.length - zpidMap.size} duplicates)`);
  console.log(`   After contact limit: ${toSend.length} (skipped ${zpidMap.size - toSend.length})`);
  console.log(`   Top property ZPID 100: $${toSend[0].estimate} (updated from $500k)`);
  console.log(`   ${passed ? '✅ PASS' : '❌ FAIL'}`);

  results.push({
    test: 'Combined Deduplication',
    passed,
    details: `${properties.length} → ${zpidMap.size} → ${toSend.length} (ZPID dedup → Contact limit)`
  });
}

function testPhoneNormalization() {
  console.log('\n🧪 TEST 5: Phone Number Normalization');
  console.log('=' .repeat(50));

  // Test phone number formats
  const properties: Property[] = [
    { zpid: 1, estimate: 100000, agentPhoneNumber: '(555) 123-4567' },
    { zpid: 2, estimate: 200000, agentPhoneNumber: '555-123-4567' },   // Same number
    { zpid: 3, estimate: 300000, agentPhoneNumber: '5551234567' },     // Same number
    { zpid: 4, estimate: 400000, agentPhoneNumber: '555.123.4567' },   // Same number
    { zpid: 5, estimate: 500000, agentPhoneNumber: '(555)-123-4567' }, // Same number
  ];

  const contactMap = new Map();
  for (const property of properties) {
    const phone = property.agentPhoneNumber || property.brokerPhoneNumber;
    if (!phone) continue;
    const cleanPhone = phone.replace(/\D/g, ''); // Remove non-digits

    if (!contactMap.has(cleanPhone)) {
      contactMap.set(cleanPhone, []);
    }
    contactMap.get(cleanPhone).push(property);
  }

  const passed = contactMap.size === 1 && // All normalized to same number
                contactMap.get('5551234567').length === 5;

  console.log(`   Properties with different formats: ${properties.length}`);
  console.log(`   Unique contacts after normalization: ${contactMap.size}`);
  console.log(`   Formats: (555) 123-4567, 555-123-4567, 5551234567, 555.123.4567, (555)-123-4567`);
  console.log(`   All normalized to: 5551234567`);
  console.log(`   ${passed ? '✅ PASS' : '❌ FAIL'}`);

  results.push({
    test: 'Phone Normalization',
    passed,
    details: `Normalized ${properties.length} different formats to 1 unique contact`
  });
}

function runTests() {
  console.log('\n' + '='.repeat(50));
  console.log('🧪 ZILLOW DEDUPLICATION LOGIC TESTS');
  console.log('='.repeat(50));

  testURLDeduplication();
  testZPIDDeduplication();
  testContactLimit();
  testCombinedDeduplication();
  testPhoneNormalization();

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`\n${icon} ${result.test}`);
    console.log(`   ${result.details}`);
  });

  console.log('\n' + '='.repeat(50));
  if (passed === total) {
    console.log(`✅ ALL TESTS PASSED: ${passed}/${total}`);
    console.log('='.repeat(50) + '\n');
    process.exit(0);
  } else {
    console.log(`❌ SOME TESTS FAILED: ${passed}/${total} passed`);
    console.log('='.repeat(50) + '\n');
    process.exit(1);
  }
}

runTests();
