#!/usr/bin/env tsx
// Reset article database - delete all articles and reinitialize with fresh fetches

import { db } from '../src/lib/firebase';
import { collection, getDocs, deleteDoc, writeBatch, doc } from 'firebase/firestore';
import { OWNERFI_FEEDS, CARZ_FEEDS } from '../src/config/feed-sources';
import { processFeedSource } from '../src/lib/rss-fetcher';

async function deleteAllArticles() {
  console.log('🗑️  Deleting all articles from database...\n');

  const brands = ['ownerfi', 'carz'];
  let totalDeleted = 0;

  for (const brand of brands) {
    const collectionName = `${brand}_articles`;
    const articlesRef = collection(db, collectionName);

    console.log(`📁 Deleting from ${collectionName}...`);

    const snapshot = await getDocs(articlesRef);
    console.log(`   Found ${snapshot.size} articles`);

    // Delete in batches of 500 (Firestore limit)
    const batches: any[] = [];
    let currentBatch = writeBatch(db);
    let operationCount = 0;

    snapshot.docs.forEach((docSnap) => {
      currentBatch.delete(docSnap.ref);
      operationCount++;

      if (operationCount === 500) {
        batches.push(currentBatch);
        currentBatch = writeBatch(db);
        operationCount = 0;
      }
    });

    if (operationCount > 0) {
      batches.push(currentBatch);
    }

    // Commit all batches
    await Promise.all(batches.map(batch => batch.commit()));

    console.log(`   ❌ Deleted ${snapshot.size} articles\n`);
    totalDeleted += snapshot.size;
  }

  console.log(`✅ Total deleted: ${totalDeleted} articles\n`);
}

async function fetchFreshArticles() {
  console.log('📰 Fetching fresh articles from working RSS feeds...\n');

  const allFeeds = [
    ...OWNERFI_FEEDS.map(f => ({ ...f, articlesProcessed: 0 })),
    ...CARZ_FEEDS.map(f => ({ ...f, articlesProcessed: 0 })),
    ...VASSDISTRO_FEEDS.map(f => ({ ...f, articlesProcessed: 0 }))
  ];

  console.log(`📊 Fetching from ${allFeeds.length} working feeds:\n`);

  let totalNew = 0;

  for (const feed of allFeeds) {
    console.log(`   Fetching: ${feed.name}...`);

    try {
      const result = await processFeedSource(feed);

      if (result.success) {
        console.log(`   ✅ ${result.newArticles} new articles`);
        totalNew += result.newArticles;
      } else {
        console.log(`   ❌ Error: ${result.error}`);
      }
    } catch (error) {
      console.log(`   ❌ Exception: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n✅ Total new articles fetched: ${totalNew}\n`);
}

async function main() {
  console.log('=' .repeat(80));
  console.log('ARTICLE DATABASE RESET');
  console.log('=' .repeat(80) + '\n');

  try {
    // Step 1: Delete all old articles
    await deleteAllArticles();

    // Step 2: Fetch fresh from working feeds
    await fetchFreshArticles();

    console.log('=' .repeat(80));
    console.log('✅ DATABASE RESET COMPLETE');
    console.log('=' .repeat(80) + '\n');

    console.log('📝 NEXT STEPS:');
    console.log('   1. Rate articles: curl https://ownerfi.ai/api/cron/rate-articles \\');
    console.log('        -H "Authorization: Bearer $CRON_SECRET"');
    console.log('   2. Test workflow: POST /api/workflow/complete-viral\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
