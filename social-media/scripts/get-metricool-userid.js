// Get Metricool User ID using API Key
// Run this script to retrieve your User ID

require('dotenv').config({ path: '.env.local' });

const METRICOOL_API_KEY = process.env.METRICOOL_API_KEY;

async function getMetricoolUserId() {
  console.log('🔍 Finding your Metricool User ID...\n');

  if (!METRICOOL_API_KEY) {
    console.error('❌ Error: METRICOOL_API_KEY not found in .env.local');
    console.log('\nMake sure you have:');
    console.log('  METRICOOL_API_KEY=your_api_key_here');
    console.log('\nIn your .env.local file');
    return;
  }

  console.log('✅ API Key found:', METRICOOL_API_KEY.substring(0, 10) + '...\n');

  try {
    // Method 1: Get user info from /user endpoint
    console.log('Method 1: Trying /user endpoint...');

    const userResponse = await fetch('https://api.metricool.com/v1/user', {
      method: 'GET',
      headers: {
        'X-Mc-Auth': METRICOOL_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (userResponse.ok) {
      const userData = await userResponse.json();
      console.log('✅ User data retrieved!\n');
      console.log('Full Response:', JSON.stringify(userData, null, 2));

      // Try to find userId in response
      const userId = userData.userId || userData.user_id || userData.id || userData.data?.userId || userData.data?.id;

      if (userId) {
        console.log('\n🎉 SUCCESS! Your User ID is:');
        console.log('═══════════════════════════════════════');
        console.log(`   ${userId}`);
        console.log('═══════════════════════════════════════\n');

        console.log('Add this to your .env.local:');
        console.log(`METRICOOL_USER_ID=${userId}\n`);
        return;
      }
    }

    // Method 2: Try /accounts endpoint
    console.log('\nMethod 2: Trying /accounts endpoint...');

    const accountsResponse = await fetch('https://api.metricool.com/v1/accounts', {
      method: 'GET',
      headers: {
        'X-Mc-Auth': METRICOOL_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (accountsResponse.ok) {
      const accountsData = await accountsResponse.json();
      console.log('✅ Accounts data retrieved!\n');
      console.log('Full Response:', JSON.stringify(accountsData, null, 2));

      const userId = accountsData.userId || accountsData.user_id || accountsData.data?.userId;

      if (userId) {
        console.log('\n🎉 SUCCESS! Your User ID is:');
        console.log('═══════════════════════════════════════');
        console.log(`   ${userId}`);
        console.log('═══════════════════════════════════════\n');

        console.log('Add this to your .env.local:');
        console.log(`METRICOOL_USER_ID=${userId}\n`);
        return;
      }
    }

    // Method 3: Try /brands endpoint
    console.log('\nMethod 3: Trying /brands endpoint...');

    const brandsResponse = await fetch('https://api.metricool.com/v1/brands', {
      method: 'GET',
      headers: {
        'X-Mc-Auth': METRICOOL_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (brandsResponse.ok) {
      const brandsData = await brandsResponse.json();
      console.log('✅ Brands data retrieved!\n');
      console.log('Full Response:', JSON.stringify(brandsData, null, 2));

      const userId = brandsData.userId || brandsData.user_id || brandsData.data?.userId;

      if (userId) {
        console.log('\n🎉 SUCCESS! Your User ID is:');
        console.log('═══════════════════════════════════════');
        console.log(`   ${userId}`);
        console.log('═══════════════════════════════════════\n');

        console.log('Add this to your .env.local:');
        console.log(`METRICOOL_USER_ID=${userId}\n`);
        return;
      }
    }

    // If all methods failed
    console.log('\n⚠️  Could not automatically find User ID from API responses.');
    console.log('\n📋 Manual Methods to Find Your User ID:\n');

    console.log('Option 1: Browser Developer Tools');
    console.log('  1. Go to https://app.metricool.com/');
    console.log('  2. Log in to your account');
    console.log('  3. Open DevTools (F12 or Right-click > Inspect)');
    console.log('  4. Go to Network tab');
    console.log('  5. Refresh the page');
    console.log('  6. Look for API calls to metricool.com');
    console.log('  7. Check the request parameters for "userId" or "user_id"\n');

    console.log('Option 2: Contact Metricool Support');
    console.log('  1. Email: support@metricool.com');
    console.log('  2. Ask for your API User ID');
    console.log('  3. Mention you need it for API integration\n');

    console.log('Option 3: Check Metricool Settings');
    console.log('  1. Go to https://app.metricool.com/');
    console.log('  2. Settings > Account > API');
    console.log('  3. Look for User ID or Account ID\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);

    if (error.message.includes('fetch')) {
      console.log('\n💡 Tip: Make sure you have internet connection');
    }

    console.log('\n📋 Try Manual Methods:\n');
    console.log('1. Log in to https://app.metricool.com/');
    console.log('2. Open browser DevTools (F12)');
    console.log('3. Go to Network tab');
    console.log('4. Refresh page');
    console.log('5. Look for API calls containing "userId"');
  }
}

getMetricoolUserId();
