// Test the admin properties API to verify address mapping is correct
async function testAdminAPI() {
  console.log('\n🧪 Testing Admin Properties API Address Mapping\n');
  console.log('='.repeat(80));

  try {
    // Start dev server check
    console.log('📡 Attempting to connect to localhost:3000...\n');

    const response = await fetch('http://localhost:3000/api/admin/properties?limit=10');

    if (!response.ok) {
      console.error(`❌ API returned ${response.status}: ${response.statusText}`);
      if (response.status === 403) {
        console.error('\n⚠️  This is normal - admin API requires authentication.');
        console.error('We need to check the database directly instead.\n');
      }
      return;
    }

    const data = await response.json();

    console.log(`\n✅ API Response received`);
    console.log(`📊 Properties count: ${data.properties?.length || 0}\n`);

    if (!data.properties || data.properties.length === 0) {
      console.log('⚠️  No properties returned');
      return;
    }

    // Check first 5 properties
    console.log('🔍 Checking address field mapping:\n');

    for (let i = 0; i < Math.min(5, data.properties.length); i++) {
      const prop = data.properties[i];
      console.log(`━━━ Property ${i + 1} ━━━`);
      console.log(`ID: ${prop.id}`);
      console.log(`address field:      "${prop.address}"`);
      console.log(`streetAddress:      "${prop.streetAddress || 'N/A'}"`);
      console.log(`fullAddress:        "${prop.fullAddress || 'N/A'}"`);
      console.log(`city:               "${prop.city || 'N/A'}"`);
      console.log(`state:              "${prop.state || 'N/A'}"`);
      console.log(`zipCode:            "${prop.zipCode || 'N/A'}"`);

      // Check if address field contains street only (no city/state/zip)
      const hasCity = prop.city && prop.address?.toLowerCase().includes(prop.city.toLowerCase());
      const hasComma = prop.address?.includes(',');

      if (hasCity || hasComma) {
        console.log(`❌ FAIL: address field contains city/state/zip (should be street only)`);
      } else if (prop.address && !hasComma) {
        console.log(`✅ PASS: address field is street only (no city/state/zip)`);
      } else {
        console.log(`⚠️  WARN: address field format unclear`);
      }
      console.log();
    }

    // Summary
    const allProperties = data.properties;
    let passCount = 0;
    let failCount = 0;

    for (const prop of allProperties) {
      const hasCity = prop.city && prop.address?.toLowerCase().includes(prop.city.toLowerCase());
      const hasComma = prop.address?.includes(',');

      if (hasCity || hasComma) {
        failCount++;
      } else if (prop.address && !hasComma) {
        passCount++;
      }
    }

    console.log('='.repeat(80));
    console.log('\n📈 TEST SUMMARY:\n');
    console.log(`Total Properties Tested:    ${allProperties.length}`);
    console.log(`✅ Street Only (PASS):      ${passCount}`);
    console.log(`❌ Contains City/Zip (FAIL): ${failCount}`);
    console.log(`Success Rate:               ${((passCount / allProperties.length) * 100).toFixed(1)}%`);
    console.log('\n='.repeat(80));

    if (failCount === 0) {
      console.log('\n🎉 ALL TESTS PASSED! Address mapping is working correctly.');
    } else {
      console.log(`\n⚠️  ${failCount} properties still have full address in address field.`);
      console.log('This suggests some properties in DB still have incorrect streetAddress field.');
    }

  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Connection refused. Dev server not running on localhost:3000');
      console.error('\n💡 Solution: Start the dev server with: npm run dev');
      console.error('Or we can test directly against the database instead.\n');
    } else {
      console.error('❌ Test failed:', error.message);
    }
  }
}

testAdminAPI();
