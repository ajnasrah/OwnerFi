/**
 * Test Facebook Lead Scraper
 *
 * Tests the scraper locally before deploying
 *
 * Usage:
 *   npx tsx scripts/test-facebook-scraper.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ApifyClient } from 'apify-client';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

// Email extraction regex
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

function extractEmails(text: string): string[] {
  if (!text) return [];
  const matches = text.match(EMAIL_REGEX);
  if (!matches) return [];

  const uniqueEmails = [...new Set(matches.map(email => email.toLowerCase().trim()))];

  return uniqueEmails.filter(email => {
    if (email.includes('example.com') || email.includes('test.com')) return false;
    if (email.length < 6) return false;
    if (email.includes('xxx') || email.includes('___')) return false;
    return true;
  });
}

async function main() {
  console.log('🧪 Testing Facebook Lead Scraper\n');

  // Check environment
  const apiKey = process.env.APIFY_API_KEY;
  const cronSecret = process.env.CRON_SECRET;

  console.log('Environment Check:');
  console.log(`  APIFY_API_KEY: ${apiKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`  CRON_SECRET: ${cronSecret ? '✅ Set' : '❌ Missing'}`);
  console.log(`  GHL_API_KEY: ${process.env.GHL_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`  GHL_LOCATION_ID: ${process.env.GHL_LOCATION_ID ? '✅ Set' : '❌ Missing'}`);
  console.log('');

  if (!apiKey) {
    console.error('❌ APIFY_API_KEY is required');
    process.exit(1);
  }

  // Check configured posts
  const configDoc = await db.collection('scraper_config').doc('facebook_posts').get();
  const posts = configDoc.exists ? (configDoc.data()?.posts || []) : [];

  console.log(`📱 Configured Posts: ${posts.length}`);

  if (posts.length === 0) {
    console.log('\n⚠️  No Facebook posts configured!');
    console.log('Add posts with: npx tsx scripts/manage-facebook-posts.ts add <url> <groupName>');
    console.log('\nExample:');
    console.log('  npx tsx scripts/manage-facebook-posts.ts add "https://facebook.com/groups/123/posts/456" "Creative Financing TN"');
    process.exit(0);
  }

  posts.forEach((post: any, i: number) => {
    console.log(`  ${i + 1}. ${post.groupName}: ${post.url.slice(0, 60)}...`);
  });

  console.log('\n--- Testing First Post ---\n');

  const testPost = posts[0];
  console.log(`Scraping: ${testPost.groupName}`);
  console.log(`URL: ${testPost.url}\n`);

  try {
    const client = new ApifyClient({ token: apiKey });

    // Run scraper with small limit for testing
    const scraperInput = {
      startUrls: [{ url: testPost.url }],
      maxComments: 50, // Small limit for testing
      sortBy: 'NEWEST',
    };

    console.log('🚀 Starting Apify scraper (max 50 comments for test)...\n');

    const run = await client.actor('apify/facebook-comments-scraper').call(scraperInput);
    const { items: comments } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`📝 Scraped ${comments.length} comments\n`);

    // Extract and display emails
    let totalEmails = 0;
    const allEmails: Set<string> = new Set();

    console.log('Sample comments with emails:');
    console.log('─'.repeat(50));

    for (const comment of comments) {
      const commentData = comment as any;
      const text = commentData.text || commentData.message || '';
      const author = commentData.authorName || commentData.profileName || 'Unknown';

      const emails = extractEmails(text);

      if (emails.length > 0) {
        totalEmails += emails.length;
        emails.forEach(e => allEmails.add(e));

        console.log(`\n👤 ${author}`);
        console.log(`   Comment: "${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"`);
        console.log(`   📧 Emails: ${emails.join(', ')}`);
      }
    }

    console.log('\n' + '─'.repeat(50));
    console.log(`\n📊 Results:`);
    console.log(`   Comments scraped: ${comments.length}`);
    console.log(`   Comments with emails: ${totalEmails > 0 ? 'Found!' : 'None'}`);
    console.log(`   Total emails extracted: ${totalEmails}`);
    console.log(`   Unique emails: ${allEmails.size}`);

    if (allEmails.size > 0) {
      console.log(`\n📧 All unique emails found:`);
      [...allEmails].forEach(email => console.log(`   - ${email}`));
    }

    // Check existing leads in DB
    const existingLeads = await db.collection('facebook_buyer_leads').count().get();
    console.log(`\n📦 Existing leads in database: ${existingLeads.data().count}`);

    console.log('\n✅ Test complete!');
    console.log('\nTo run the full scraper:');
    console.log(`  curl -H "Authorization: Bearer ${cronSecret}" http://localhost:3000/api/cron/scrape-facebook-leads`);

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

main().catch(console.error);
