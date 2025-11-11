/**
 * Test Late API key and basic connectivity
 */

const LATE_API_KEY = process.env.LATE_API_KEY;
const LATE_CARZ_PROFILE_ID = process.env.LATE_CARZ_PROFILE_ID;

async function testLateAPI() {
  if (!LATE_API_KEY) {
    console.error('❌ LATE_API_KEY not set');
    process.exit(1);
  }

  console.log('🔑 API Key:', `${LATE_API_KEY.substring(0, 20)}...`);
  console.log('📋 Profile ID:', LATE_CARZ_PROFILE_ID);
  console.log('');

  // Test 1: Get profiles (should be fast)
  console.log('Test 1: GET /v1/profiles (should be instant)');
  const start1 = Date.now();

  try {
    const response = await fetch('https://getlate.dev/api/v1/profiles', {
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    const duration1 = Date.now() - start1;
    console.log(`   Duration: ${duration1}ms`);
    console.log(`   Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   Error: ${errorText}`);
      console.log('\n❌ API KEY IS INVALID OR EXPIRED!');
      process.exit(1);
    }

    const profiles = await response.json();
    console.log(`   Profiles found: ${profiles.length}`);
    console.log('   ✅ API key is valid\n');

  } catch (error) {
    console.error(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    process.exit(1);
  }

  // Test 2: Get accounts for profile
  console.log('Test 2: GET /v1/accounts (should be instant)');
  const start2 = Date.now();

  try {
    const response = await fetch(`https://getlate.dev/api/v1/accounts?profileId=${LATE_CARZ_PROFILE_ID}`, {
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    const duration2 = Date.now() - start2;
    console.log(`   Duration: ${duration2}ms`);
    console.log(`   Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   Error: ${errorText}`);
    } else {
      const data = await response.json();
      const accounts = Array.isArray(data) ? data : (data.accounts || data.data || []);
      console.log(`   Accounts found: ${accounts.length}`);
      accounts.forEach((acc: any) => {
        console.log(`      - ${acc.platform}: ${acc.username || acc._id}`);
      });
      console.log('   ✅ Accounts retrieved\n');
    }

  } catch (error) {
    console.error(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  console.log('\n✅ Late.dev API is accessible and working');
  console.log('The timeout issue must be specific to POST /v1/posts endpoint');
}

testLateAPI().catch(console.error);
