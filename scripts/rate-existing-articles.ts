#!/usr/bin/env ts-node
/**
 * One-time script to rate all existing articles with AI
 * This will score all unprocessed articles and save the scores to Firestore
 *
 * Usage: npx ts-node scripts/rate-existing-articles.ts
 */

import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { evaluateArticlesBatch } from '../src/lib/article-quality-filter';

interface Article {
  id: string;
  title: string;
  description: string;
  content: string;
  pubDate: number;
  processed: boolean;
  qualityScore?: number;
  aiReasoning?: string;
}

async function rateArticles(brand: 'carz' | 'ownerfi') {
  console.log(`\n🤖 Rating ${brand} articles...`);

  const collectionName = brand === 'carz' ? 'carz_articles' : 'ownerfi_articles';

  // Get all unprocessed articles
  const q = query(
    collection(db, collectionName),
    where('processed', '==', false)
  );

  const snapshot = await getDocs(q);
  const articles = snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  })) as Article[];

  console.log(`   Found ${articles.length} unprocessed articles`);

  if (articles.length === 0) {
    console.log(`   ✅ No articles to rate`);
    return { rated: 0, kept: articles.length, deleted: 0 };
  }

  // Rate in batches to avoid overwhelming the API
  const batchSize = 10;
  let totalRated = 0;

  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);
    console.log(`   📊 Rating batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(articles.length / batchSize)} (${batch.length} articles)...`);

    try {
      const qualityScores = await evaluateArticlesBatch(
        batch.map(article => ({
          title: article.title,
          content: article.content || article.description,
          category: brand
        })),
        3 // Max 3 concurrent API calls
      );

      // Update articles with scores
      const updatePromises = batch.map((article, index) => {
        const score = qualityScores[index];
        return updateDoc(doc(db, collectionName, article.id), {
          qualityScore: score.score,
          aiReasoning: score.reasoning,
          ratedAt: Date.now()
        });
      });

      await Promise.all(updatePromises);
      totalRated += batch.length;

      console.log(`   ✅ Rated ${batch.length} articles`);

      // Show top scores in this batch
      const batchScores = qualityScores.map(s => s.score).sort((a, b) => b - a);
      console.log(`      Top scores: ${batchScores.slice(0, 5).join(', ')}`);

      // Small delay between batches to avoid rate limits
      if (i + batchSize < articles.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`   ❌ Error rating batch:`, error);
      // Continue with next batch
    }
  }

  console.log(`\n✅ ${brand}: Rated ${totalRated}/${articles.length} articles`);
  return { rated: totalRated, kept: articles.length, deleted: 0 };
}

async function main() {
  console.log('🚀 Starting AI article rating...\n');

  if (!db) {
    console.error('❌ Firebase not initialized');
    process.exit(1);
  }

  try {
    // Rate Carz articles
    const carzResults = await rateArticles('carz');

    // Rate OwnerFi articles
    const ownerfiResults = await rateArticles('ownerfi');

    console.log('\n\n📊 Final Results:');
    console.log(`   Carz: Rated ${carzResults.rated} articles`);
    console.log(`   OwnerFi: Rated ${ownerfiResults.rated} articles`);
    console.log(`   Total: ${carzResults.rated + ownerfiResults.rated} articles\n`);

    console.log('✅ Done! Check the Articles page to see the scores.');

  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

main();
