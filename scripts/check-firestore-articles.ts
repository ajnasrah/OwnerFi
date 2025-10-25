#!/usr/bin/env tsx
// Check what's actually in Firestore right now

import { db } from '../src/lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';

async function checkArticles() {
  console.log('🔍 Checking Firestore Article Collections\n');

  const brands = [
    { name: 'OwnerFi', collection: 'ownerfi_articles' },
    { name: 'Carz', collection: 'carz_articles' },
    { name: 'Vass Distro', collection: 'vassdistro_articles' }
  ];

  for (const brand of brands) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`${brand.name.toUpperCase()}`);
    console.log(`${'='.repeat(80)}\n`);

    try {
      const articlesRef = collection(db, brand.collection);

      // Total articles
      const allSnapshot = await getDocs(articlesRef);
      console.log(`📊 Total Articles: ${allSnapshot.size}`);

      if (allSnapshot.size === 0) {
        console.log('   ❌ NO ARTICLES IN DATABASE\n');
        continue;
      }

      // Unprocessed articles
      const unprocessedQuery = query(articlesRef, where('processed', '==', false));
      const unprocessedSnapshot = await getDocs(unprocessedQuery);
      console.log(`📝 Unprocessed Articles: ${unprocessedSnapshot.size}`);

      // Processed articles
      const processedQuery = query(articlesRef, where('processed', '==', true));
      const processedSnapshot = await getDocs(processedQuery);
      console.log(`✅ Processed Articles: ${processedSnapshot.size}`);

      // Quality scores
      const allArticles = allSnapshot.docs.map(d => d.data());
      const rated = allArticles.filter(a => typeof a.qualityScore === 'number');
      const highQuality = rated.filter(a => a.qualityScore >= 70);
      const unprocessedHighQuality = allArticles.filter(a =>
        !a.processed && typeof a.qualityScore === 'number' && a.qualityScore >= 70
      );

      console.log(`⭐ Rated: ${rated.length}`);
      console.log(`🎯 High Quality (>=70): ${highQuality.length}`);
      console.log(`🚀 Available for Videos (unprocessed + score>=70): ${unprocessedHighQuality.length}`);

      // Show content lengths
      const contentLengths = allArticles.map(a => (a.content || '').length);
      const avgContent = contentLengths.length > 0
        ? Math.round(contentLengths.reduce((a, b) => a + b, 0) / contentLengths.length)
        : 0;

      console.log(`📏 Average Content Length: ${avgContent} chars`);

      // Show samples
      console.log(`\n📄 Sample Unprocessed High-Quality Articles:`);
      unprocessedHighQuality.slice(0, 5).forEach((article, i) => {
        console.log(`\n${i + 1}. ${article.title}`);
        console.log(`   Score: ${article.qualityScore}`);
        console.log(`   Content: ${(article.content || '').length} chars`);
        console.log(`   Published: ${new Date(article.pubDate).toLocaleDateString()}`);
      });

    } catch (error) {
      console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  process.exit(0);
}

checkArticles().catch(console.error);
