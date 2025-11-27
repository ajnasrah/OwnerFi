/**
 * Test All Facebook Group Scrapers
 *
 * Tests multiple Apify actors on a Facebook group to find the best one
 * for extracting emails from comments.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { ApifyClient } from 'apify-client';

const GROUP_URL = 'https://www.facebook.com/groups/217210172609089';

// Email extraction regex
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

function extractEmails(text: string): string[] {
  if (!text) return [];
  const matches = text.match(EMAIL_REGEX);
  if (!matches) return [];
  return [...new Set(matches.map(e => e.toLowerCase().trim()))];
}

async function testScraper(
  client: ApifyClient,
  actorId: string,
  input: any,
  name: string
): Promise<{ name: string; success: boolean; items: number; emails: string[]; error?: string; sampleData?: any }> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Testing: ${name}`);
  console.log(`   Actor: ${actorId}`);
  console.log(`${'='.repeat(60)}`);

  try {
    console.log('   🚀 Starting scraper...');
    const run = await client.actor(actorId).call(input, {
      timeout: 120, // 2 minute timeout
      memory: 1024
    });

    console.log(`   ✅ Run completed: ${run.status}`);

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    console.log(`   📦 Items returned: ${items.length}`);

    // Extract all emails from all text fields
    const allEmails: Set<string> = new Set();

    items.forEach((item: any) => {
      // Check all possible text fields
      const textFields = [
        item.text,
        item.message,
        item.postText,
        item.content,
        item.body,
        item.comment,
        item.bio,
        item.description,
      ];

      // Also check nested comments
      if (item.comments && Array.isArray(item.comments)) {
        item.comments.forEach((c: any) => {
          textFields.push(c.text, c.message, c.content);
        });
      }

      textFields.forEach(text => {
        if (text) {
          extractEmails(text).forEach(email => allEmails.add(email));
        }
      });
    });

    const emails = [...allEmails];

    console.log(`   📧 Emails found: ${emails.length}`);
    if (emails.length > 0) {
      console.log(`   Sample emails: ${emails.slice(0, 5).join(', ')}`);
    }

    // Show sample data structure
    if (items.length > 0) {
      console.log(`\n   📋 Sample item keys: ${Object.keys(items[0]).join(', ')}`);
    }

    return {
      name,
      success: true,
      items: items.length,
      emails,
      sampleData: items[0],
    };

  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
    return {
      name,
      success: false,
      items: 0,
      emails: [],
      error: error.message,
    };
  }
}

async function main() {
  console.log('🔬 Testing Facebook Group Scrapers');
  console.log(`📍 Group: ${GROUP_URL}\n`);

  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    console.error('❌ APIFY_API_KEY not found in .env.local');
    process.exit(1);
  }

  const client = new ApifyClient({ token: apiKey });

  const results: any[] = [];

  // Test 1: scrapio/facebook-groups-posts-scraper
  results.push(await testScraper(
    client,
    'scrapio/facebook-groups-posts-scraper',
    {
      groupUrls: [GROUP_URL],
      maxPosts: 20,
      includeComments: true,
    },
    'Facebook Group Posts Scraper (scrapio)'
  ));

  // Test 2: apify/facebook-groups-scraper (Official)
  results.push(await testScraper(
    client,
    'apify/facebook-groups-scraper',
    {
      startUrls: [{ url: GROUP_URL }],
      maxPosts: 20,
    },
    'Facebook Groups Scraper (Official Apify)'
  ));

  // Test 3: curious_coder/facebook-post-scraper
  results.push(await testScraper(
    client,
    'curious_coder/facebook-post-scraper',
    {
      groupUrl: GROUP_URL,
      maxPosts: 20,
    },
    'Facebook Post Scraper (curious_coder)'
  ));

  // Test 4: memo23/apify-facebook-group-scraper
  results.push(await testScraper(
    client,
    'memo23/apify-facebook-group-scraper',
    {
      groupUrls: [GROUP_URL],
      maxPosts: 20,
    },
    'Facebook Group Scraper (memo23)'
  ));

  // Test 5: apify/facebook-posts-scraper
  results.push(await testScraper(
    client,
    'apify/facebook-posts-scraper',
    {
      startUrls: [{ url: GROUP_URL }],
      maxPosts: 20,
    },
    'Facebook Posts Scraper (Official Apify)'
  ));

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));

  console.log('\n| Scraper | Status | Items | Emails |');
  console.log('|---------|--------|-------|--------|');

  results.forEach(r => {
    const status = r.success ? '✅' : '❌';
    console.log(`| ${r.name.slice(0, 35).padEnd(35)} | ${status} | ${String(r.items).padStart(5)} | ${String(r.emails.length).padStart(6)} |`);
  });

  // Find best scraper
  const bestForEmails = results
    .filter(r => r.success)
    .sort((a, b) => b.emails.length - a.emails.length)[0];

  const bestForItems = results
    .filter(r => r.success)
    .sort((a, b) => b.items - a.items)[0];

  console.log('\n📈 Recommendations:');
  if (bestForEmails && bestForEmails.emails.length > 0) {
    console.log(`   Best for emails: ${bestForEmails.name} (${bestForEmails.emails.length} emails)`);
  }
  if (bestForItems) {
    console.log(`   Most data: ${bestForItems.name} (${bestForItems.items} items)`);
  }

  // Show all unique emails found
  const allEmails = new Set<string>();
  results.forEach(r => r.emails.forEach((e: string) => allEmails.add(e)));

  if (allEmails.size > 0) {
    console.log(`\n📧 All unique emails found across all scrapers (${allEmails.size}):`);
    [...allEmails].forEach(email => console.log(`   - ${email}`));
  } else {
    console.log('\n⚠️  No emails found in any scraper results');
    console.log('   This could mean:');
    console.log('   - The group posts don\'t have emails in comments');
    console.log('   - The scrapers need authentication (cookies) to access the group');
    console.log('   - The group is private and requires login');
  }

  process.exit(0);
}

main().catch(console.error);
