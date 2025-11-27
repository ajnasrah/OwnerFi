/**
 * Test ALL available Facebook Group scrapers
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { ApifyClient } from 'apify-client';

const GROUP_URL = 'https://www.facebook.com/groups/MemphisRealEstateInvestors/';

async function testActor(client: ApifyClient, actorId: string, input: any, name: string) {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`🧪 ${name}`);
  console.log(`   ${actorId}`);

  try {
    const run = await client.actor(actorId).call(input, { timeout: 90, memory: 512 });
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`   ✅ ${run.status} | ${items.length} items`);

    if (items.length > 0) {
      const sample = items[0] as any;

      if (sample.error) {
        console.log(`   ⚠️  ${sample.error}: ${sample.errorDescription || ''}`);
      } else {
        console.log(`   📋 Keys: ${Object.keys(sample).slice(0, 8).join(', ')}`);

        // Check for useful data
        const hasText = sample.text || sample.message || sample.postText || sample.content;
        const hasComments = sample.comments && sample.comments.length > 0;
        const hasPosts = sample.posts && sample.posts.length > 0;

        if (hasText) console.log(`   📝 Has text content`);
        if (hasComments) console.log(`   💬 Has comments: ${sample.comments.length}`);
        if (hasPosts) console.log(`   📰 Has posts: ${sample.posts.length}`);

        // Show snippet
        const textContent = sample.text || sample.message || sample.postText || '';
        if (textContent) {
          console.log(`   📄 "${textContent.slice(0, 100)}..."`);
        }
      }
    }

    return { success: true, items: items.length, data: items[0] };
  } catch (error: any) {
    const msg = error.message || '';
    if (msg.includes('rent')) {
      console.log(`   💰 Requires paid rental`);
    } else {
      console.log(`   ❌ ${msg.slice(0, 80)}`);
    }
    return { success: false, error: msg };
  }
}

async function main() {
  console.log('🔬 Testing ALL Facebook Group Scrapers');
  console.log(`📍 ${GROUP_URL}\n`);

  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    console.error('❌ APIFY_API_KEY not found');
    process.exit(1);
  }

  const client = new ApifyClient({ token: apiKey });

  // All known Facebook group-related scrapers
  const tests = [
    // Official Apify
    ['apify/facebook-groups-scraper', { startUrls: [{ url: GROUP_URL }], maxPosts: 10 }],
    ['apify/facebook-posts-scraper', { startUrls: [{ url: GROUP_URL }], maxPosts: 10 }],
    ['apify/facebook-pages-scraper', { startUrls: [{ url: GROUP_URL }], maxPosts: 10 }],
    ['apify/facebook-comments-scraper', { startUrls: [{ url: GROUP_URL }], maxComments: 50 }],

    // Third party - various input formats
    ['scrapio/facebook-groups-posts-scraper', { groupUrls: [GROUP_URL], maxPosts: 10 }],
    ['curious_coder/facebook-post-scraper', { groupUrl: GROUP_URL, maxPosts: 10 }],
    ['memo23/apify-facebook-group-scraper', { groupUrls: [GROUP_URL], maxPosts: 10 }],
    ['caprolok/facebook-groups-scraper', { startUrls: [{ url: GROUP_URL }], maxPosts: 10 }],
    ['scrapier/facebook-group-post-scraper', { groupUrl: GROUP_URL, maxPosts: 10 }],
    ['easyapi/facebook-groups-search-scraper', { searchQuery: 'Memphis Real Estate', maxGroups: 5 }],

    // Member scrapers
    ['curious_coder/facebook-group-member-scraper', { groupUrl: GROUP_URL, maxMembers: 20 }],
  ];

  const results: any[] = [];

  for (const [actorId, input] of tests) {
    const result = await testActor(client, actorId as string, input, actorId as string);
    results.push({ actorId, ...result });

    // Small delay between tests
    await new Promise(r => setTimeout(r, 1000));
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log('📊 SUMMARY');
  console.log('='.repeat(50));

  const working = results.filter(r => r.success && r.items > 0 && !r.data?.error);
  const needsPaid = results.filter(r => r.error?.includes('rent'));
  const failed = results.filter(r => !r.success && !r.error?.includes('rent'));

  console.log(`\n✅ Working (${working.length}):`);
  working.forEach(r => console.log(`   - ${r.actorId}: ${r.items} items`));

  console.log(`\n💰 Needs Paid Rental (${needsPaid.length}):`);
  needsPaid.forEach(r => console.log(`   - ${r.actorId}`));

  console.log(`\n❌ Failed/Private (${failed.length}):`);
  failed.forEach(r => console.log(`   - ${r.actorId}`));

  process.exit(0);
}

main().catch(console.error);
