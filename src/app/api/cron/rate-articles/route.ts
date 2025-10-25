// Cron job to rate articles daily at 1 PM (1 hour after RSS fetch)
// Rates all unprocessed articles and keeps best 10 from (new articles + existing top 10)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { getCollectionName } from '@/lib/feed-store-firestore';
import { evaluateArticlesBatch } from '@/lib/article-quality-filter';

export const maxDuration = 300; // 5 minutes timeout

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret or Vercel cron User-Agent
    const authHeader = request.headers.get('authorization');
    const userAgent = request.headers.get('user-agent');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret';
    const isVercelCron = userAgent === 'vercel-cron/1.0';

    if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('⚠️  Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    console.log('🚀 Starting daily article rating at', new Date().toISOString());

    const results = {
      carz: await rateAndMergeBrand('carz'),
      ownerfi: await rateAndMergeBrand('ownerfi'),
      vassdistro: await rateAndMergeBrand('vassdistro')
    };

    console.log('✅ Article rating complete:', results);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    });

  } catch (error) {
    console.error('❌ Article rating error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function rateAndMergeBrand(brand: 'carz' | 'ownerfi' | 'vassdistro') {
  console.log(`🤖 [${brand}] Starting rating process...`);

  const collectionName = getCollectionName('ARTICLES', brand);

  // Step 1: Get ALL unprocessed articles
  const unprocessedQuery = query(
    collection(db!, collectionName),
    where('processed', '==', false)
  );

  const snapshot = await getDocs(unprocessedQuery);
  const allArticles = snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  })) as any[];

  console.log(`📊 [${brand}] Found ${allArticles.length} unprocessed articles`);

  if (allArticles.length === 0) {
    return {
      newlyRated: 0,
      totalInQueue: 0,
      deleted: 0
    };
  }

  // Step 2: Separate articles that need rating vs already rated
  const needRating = allArticles.filter(a => a.qualityScore === undefined);
  const alreadyRated = allArticles.filter(a => a.qualityScore !== undefined);

  console.log(`📝 [${brand}] Need rating: ${needRating.length}, Already rated: ${alreadyRated.length}`);

  // Step 3: Rate new articles with AI (optimized batch size)
  let newlyRatedArticles: any[] = [];

  if (needRating.length > 0) {
    console.log(`🤖 [${brand}] Rating ${needRating.length} new articles with OpenAI...`);

    const qualityScores = await evaluateArticlesBatch(
      needRating.map((article: any) => ({
        title: article.title,
        content: article.content || article.description,
        category: brand
      })),
      10 // 10 concurrent API calls for better throughput (optimized)
    );

    // Pair new articles with their scores
    newlyRatedArticles = needRating.map((article: any, index) => ({
      ...article,
      qualityScore: qualityScores[index].score,
      aiReasoning: qualityScores[index].reasoning
    }));

    // Update Firestore with new scores
    console.log(`💾 [${brand}] Updating ${newlyRatedArticles.length} articles with scores...`);
    await Promise.all(
      newlyRatedArticles.map(article =>
        updateDoc(doc(db!, collectionName, article.id), {
          qualityScore: article.qualityScore,
          aiReasoning: article.aiReasoning,
          ratedAt: Date.now()
        })
      )
    );
  }

  // Step 4: Combine newly rated + already rated articles
  const allRatedArticles = [...alreadyRated, ...newlyRatedArticles];

  // Sort by score (highest first)
  allRatedArticles.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));

  console.log(`📊 [${brand}] Top 20 scores: ${allRatedArticles.slice(0, 20).map(a => a.qualityScore).join(', ')}`);

  // Step 5: Keep top 20 (increased from 10 for better buffer), delete the rest
  const toKeep = allRatedArticles.slice(0, 20);
  const toDelete = allRatedArticles.slice(20);

  if (toDelete.length > 0) {
    console.log(`🧹 [${brand}] Deleting ${toDelete.length} low-quality articles...`);
    await Promise.all(
      toDelete.map(article =>
        deleteDoc(doc(db!, collectionName, article.id))
      )
    );
  }

  console.log(`✅ [${brand}] Complete: ${needRating.length} newly rated, ${toKeep.length} kept in queue, ${toDelete.length} deleted`);

  return {
    newlyRated: needRating.length,
    totalInQueue: toKeep.length,
    deleted: toDelete.length,
    topScores: toKeep.map(a => a.qualityScore)
  };
}
