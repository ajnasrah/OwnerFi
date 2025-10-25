#!/usr/bin/env tsx
// Check article status in Firestore for debugging

import { db } from '../src/lib/firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

async function checkArticleStatus() {
  console.log('🔍 Checking OwnerFi Article Status...\n');

  try {
    const articlesRef = collection(db, 'ownerfi_articles');

    // Check total articles
    const allSnapshot = await getDocs(articlesRef);
    console.log(`📊 Total Articles: ${allSnapshot.size}`);

    if (allSnapshot.size === 0) {
      console.log('\n❌ NO ARTICLES IN DATABASE');
      console.log('\n📝 SOLUTION: Run the RSS feed fetcher:');
      console.log('   curl -X GET https://ownerfi.ai/api/cron/fetch-feeds');
      process.exit(0);
    }

    // Check unprocessed articles
    const unprocessedQuery = query(articlesRef, where('processed', '==', false));
    const unprocessedSnapshot = await getDocs(unprocessedQuery);
    console.log(`📝 Unprocessed Articles: ${unprocessedSnapshot.size}`);

    // Check rated articles
    let ratedCount = 0;
    let unratedCount = 0;
    let highQualityCount = 0;

    const allArticles = allSnapshot.docs.map(doc => doc.data());

    for (const article of allArticles) {
      if (typeof article.qualityScore === 'number') {
        ratedCount++;
        if (article.qualityScore >= 70) {
          highQualityCount++;
        }
      } else {
        unratedCount++;
      }
    }

    console.log(`⭐ Rated Articles: ${ratedCount}`);
    console.log(`❓ Unrated Articles: ${unratedCount}`);
    console.log(`🎯 High Quality (>=70): ${highQualityCount}`);

    if (unratedCount > 0) {
      console.log('\n⚠️  You have unrated articles!');
      console.log('\n📝 SOLUTION: Run the article rating cron:');
      console.log('   curl -X GET https://ownerfi.ai/api/cron/rate-articles');
    }

    if (highQualityCount === 0 && ratedCount > 0) {
      console.log('\n⚠️  All rated articles scored below 70!');
      console.log('\n📊 Quality Score Distribution:');

      const scores = allArticles
        .filter(a => typeof a.qualityScore === 'number')
        .map(a => a.qualityScore)
        .sort((a, b) => b - a);

      if (scores.length > 0) {
        console.log(`   Highest: ${scores[0]}`);
        console.log(`   Average: ${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}`);
        console.log(`   Lowest: ${scores[scores.length - 1]}`);
      }

      console.log('\n📝 SOLUTIONS:');
      console.log('   1. Lower threshold temporarily (in feed-store-firestore.ts line 263)');
      console.log('   2. Check if feeds are providing good content');
      console.log('   3. Run: npx tsx scripts/analyze-rss-feeds.ts');
    }

    // Show sample articles
    console.log('\n📄 Sample Unprocessed Articles:');
    const sampleQuery = query(
      articlesRef,
      where('processed', '==', false),
      orderBy('pubDate', 'desc'),
      limit(5)
    );

    const sampleSnapshot = await getDocs(sampleQuery);
    sampleSnapshot.docs.forEach((doc, index) => {
      const article = doc.data();
      const contentLength = article.content?.length || 0;
      const score = article.qualityScore || 'not rated';

      console.log(`\n${index + 1}. ${article.title.substring(0, 60)}...`);
      console.log(`   Content: ${contentLength} chars`);
      console.log(`   Quality Score: ${score}`);
      console.log(`   Published: ${new Date(article.pubDate).toLocaleDateString()}`);
    });

    console.log('\n✅ Diagnosis complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkArticleStatus();
