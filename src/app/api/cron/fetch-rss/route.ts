// Cron job to fetch RSS articles daily at 12 PM
// Vercel Cron: Add to vercel.json: { "path": "/api/cron/fetch-rss", "schedule": "0 12 * * *" }

import { NextRequest, NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit as firestoreLimit } from 'firebase/firestore';
import { addArticle, articleExists, articleExistsByContent } from '@/lib/feed-store-firestore';

const parser = new Parser();

// RSS feeds for each brand
const RSS_FEEDS = {
  carz: [
    { name: 'Motor1', url: 'https://www.motor1.com/rss/news/' },
    { name: 'Car and Driver', url: 'https://www.caranddriver.com/rss/all.xml/' },
    { name: 'Autoblog', url: 'https://www.autoblog.com/rss.xml' },
    { name: 'The Drive', url: 'https://www.thedrive.com/rss/news' }
  ],
  ownerfi: [
    { name: 'Realtor News', url: 'https://www.realtor.com/news/rss' },
    { name: 'HousingWire', url: 'https://www.housingwire.com/feed/' },
    { name: 'Mortgage News Daily', url: 'https://www.mortgagenewsdaily.com/rss' }
  ]
};

export const maxDuration = 300; // 5 minutes timeout

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel Cron adds this header)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret';

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('⚠️  Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    console.log('🚀 Starting daily RSS fetch at', new Date().toISOString());

    const results = {
      carz: { fetched: 0, added: 0, duplicates: 0 },
      ownerfi: { fetched: 0, added: 0, duplicates: 0 }
    };

    // Fetch articles for both brands
    for (const brand of ['carz', 'ownerfi'] as const) {
      console.log(`📰 Fetching ${brand} articles...`);

      for (const feed of RSS_FEEDS[brand]) {
        try {
          console.log(`  📡 Fetching from ${feed.name}...`);

          const rssFeed = await parser.parseURL(feed.url);
          results[brand].fetched += rssFeed.items.length;

          // Process each article
          for (const item of rssFeed.items.slice(0, 10)) { // Limit to 10 most recent per feed
            const title = item.title || '';
            const description = item.contentSnippet || item.content || '';
            const link = item.link || '';
            const pubDate = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();

            if (!title || !link) continue;

            // Check if article already exists by link
            const exists = await articleExists(link, brand);
            if (exists) {
              results[brand].duplicates++;
              continue;
            }

            // Check if similar content exists (deduplication)
            const contentExists = await articleExistsByContent(title, description, brand);
            if (contentExists) {
              results[brand].duplicates++;
              continue;
            }

            // Add new article (unprocessed, no quality score yet)
            await addArticle({
              id: `${brand}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              feedId: feed.name,
              title,
              description,
              content: description,
              link,
              pubDate,
              author: item.creator || item.author,
              categories: item.categories || [],
              processed: false,
              videoGenerated: false
            }, brand);

            results[brand].added++;
            console.log(`  ✅ Added: ${title.substring(0, 60)}...`);
          }

        } catch (error) {
          console.error(`  ❌ Error fetching ${feed.name}:`, error);
        }
      }
    }

    console.log('✅ RSS fetch complete:', results);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    });

  } catch (error) {
    console.error('❌ RSS fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
