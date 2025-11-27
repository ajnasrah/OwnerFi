/**
 * Test Facebook Group Scrapers on Memphis REI Group
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { ApifyClient } from 'apify-client';

const GROUP_URL = 'https://www.facebook.com/groups/MemphisRealEstateInvestors/';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

function extractEmails(text: string): string[] {
  if (!text) return [];
  const matches = text.match(EMAIL_REGEX);
  if (!matches) return [];
  return [...new Set(matches.map(e => e.toLowerCase().trim()))];
}

async function main() {
  console.log('🔬 Testing on Memphis Real Estate Investors Group');
  console.log(`📍 ${GROUP_URL}\n`);

  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    console.error('❌ APIFY_API_KEY not found');
    process.exit(1);
  }

  const client = new ApifyClient({ token: apiKey });

  // Test the official Apify scrapers (free to use)
  const scrapers = [
    {
      name: 'Facebook Groups Scraper (Official)',
      actorId: 'apify/facebook-groups-scraper',
      input: {
        startUrls: [{ url: GROUP_URL }],
        maxPosts: 30,
      }
    },
    {
      name: 'Facebook Posts Scraper (Official)',
      actorId: 'apify/facebook-posts-scraper',
      input: {
        startUrls: [{ url: GROUP_URL }],
        maxPosts: 30,
      }
    },
    {
      name: 'Facebook Pages Scraper (Official)',
      actorId: 'apify/facebook-pages-scraper',
      input: {
        startUrls: [{ url: GROUP_URL }],
        maxPosts: 30,
      }
    }
  ];

  for (const scraper of scrapers) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🧪 ${scraper.name}`);
    console.log(`   Actor: ${scraper.actorId}`);
    console.log('='.repeat(50));

    try {
      console.log('   🚀 Starting...');

      const run = await client.actor(scraper.actorId).call(scraper.input, {
        timeout: 120,
        memory: 1024
      });

      console.log(`   ✅ Status: ${run.status}`);

      const { items } = await client.dataset(run.defaultDatasetId).listItems();
      console.log(`   📦 Items: ${items.length}`);

      if (items.length > 0) {
        const sample = items[0] as any;
        console.log(`   📋 Keys: ${Object.keys(sample).slice(0, 10).join(', ')}`);

        // Check for errors
        if (sample.error) {
          console.log(`   ⚠️  Error: ${sample.error}`);
          console.log(`   📝 ${sample.errorDescription || ''}`);
        }

        // Look for post content
        if (sample.text || sample.message || sample.postText) {
          console.log(`   📝 Has post text: YES`);
        }

        // Extract emails
        const allEmails: Set<string> = new Set();
        items.forEach((item: any) => {
          const fields = [item.text, item.message, item.postText, item.content, item.description];

          // Check comments
          if (item.comments) {
            item.comments.forEach((c: any) => {
              fields.push(c.text, c.message);
            });
          }

          fields.forEach(f => {
            if (f) extractEmails(f).forEach(e => allEmails.add(e));
          });
        });

        if (allEmails.size > 0) {
          console.log(`   📧 Emails found: ${allEmails.size}`);
          [...allEmails].slice(0, 5).forEach(e => console.log(`      - ${e}`));
        }

        // Show sample data
        console.log(`\n   📄 Sample data:`);
        console.log(JSON.stringify(sample, null, 2).split('\n').slice(0, 20).join('\n'));
      }

    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n✅ Done');
  process.exit(0);
}

main().catch(console.error);
