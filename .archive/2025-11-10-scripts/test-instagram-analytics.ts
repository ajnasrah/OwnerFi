/**
 * Test Instagram Analytics Integration
 *
 * Run with: npx tsx scripts/test-instagram-analytics.ts
 */

import { fetchInstagramAccountInsights, syncInstagramAnalytics } from '../src/lib/instagram-analytics';

async function testInstagramAnalytics() {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const instagramBusinessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID_OWNERFI;

  if (!accessToken) {
    console.error('❌ META_ACCESS_TOKEN not found in .env.local');
    return;
  }

  if (!instagramBusinessAccountId) {
    console.error('❌ INSTAGRAM_BUSINESS_ACCOUNT_ID_OWNERFI not set in .env.local');
    console.log('\n📝 To get your Instagram Business Account ID:');
    console.log('1. Go to https://developers.facebook.com/tools/explorer/');
    console.log('2. Select your OwnerFi app');
    console.log('3. Make a GET request to: me/accounts');
    console.log('4. For each page, make a GET request to: {page-id}?fields=instagram_business_account');
    console.log('5. Copy the instagram_business_account.id value\n');
    return;
  }

  console.log('🧪 Testing Instagram Analytics Integration...\n');

  // Test 1: Fetch account insights
  console.log('📊 Test 1: Fetching account insights...');
  const accountInsights = await fetchInstagramAccountInsights(
    instagramBusinessAccountId,
    accessToken,
    'day'
  );

  if (accountInsights) {
    console.log('✅ Account insights fetched successfully:');
    console.log(`   Reach: ${accountInsights.reach}`);
    console.log(`   Impressions: ${accountInsights.impressions}`);
    console.log(`   Profile Views: ${accountInsights.profile_views}`);
    console.log(`   Followers: ${accountInsights.follower_count}`);
    console.log(`   Website Clicks: ${accountInsights.website_clicks}\n`);
  } else {
    console.log('❌ Failed to fetch account insights\n');
  }

  // Test 2: Sync all analytics
  console.log('📊 Test 2: Syncing all Instagram analytics...');
  const result = await syncInstagramAnalytics(
    'ownerfi',
    instagramBusinessAccountId,
    accessToken
  );

  if (result.success) {
    console.log(`✅ Sync completed!`);
    console.log(`   Posts synced: ${result.syncedPosts}`);
    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
      result.errors.forEach(err => console.log(`     - ${err}`));
    }
  } else {
    console.log('❌ Sync failed');
    console.log(`   Errors:`, result.errors);
  }
}

testInstagramAnalytics().catch(console.error);
