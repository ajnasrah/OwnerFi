// API to rate all articles with AI (SYNCHRONOUS - runs to completion)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

interface RateAllRequest {
  brand: 'carz' | 'ownerfi';
  keepTopN?: number;
}

export const maxDuration = 300; // 5 minutes max (Vercel Pro limit)

export async function POST(request: NextRequest) {
  try {
    // Verify admin session
    const session = await getServerSession(authOptions as any);
    const isAdmin = session?.user && (session.user as any).role === 'admin';

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    const body: RateAllRequest = await request.json();
    const { brand, keepTopN = 10 } = body;

    if (!brand || (brand !== 'carz' && brand !== 'ownerfi')) {
      return NextResponse.json(
        { error: 'Invalid brand. Must be "carz" or "ownerfi"' },
        { status: 400 }
      );
    }

    console.log(`🚀 Starting AI rating for ${brand} articles...`);

    // Run rating SYNCHRONOUSLY and wait for completion
    const result = await rateArticles(brand, keepTopN);

    return NextResponse.json({
      success: true,
      message: `✅ Rated ${result.rated} ${brand} articles, kept top ${result.kept}, deleted ${result.deleted}`,
      ...result
    });

  } catch (error) {
    console.error('❌ Error rating articles:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function rateArticles(brand: 'carz' | 'ownerfi', keepTopN: number) {
  const startTime = Date.now();
  console.log(`🚀 [${brand}] Rating started at ${new Date().toISOString()}`);

  const { db } = await import('@/lib/firebase');
  const { collection, query, where, getDocs, updateDoc, doc, deleteDoc } = await import('firebase/firestore');
  const { getCollectionName } = await import('@/lib/feed-store-firestore');
  const { evaluateArticlesBatch } = await import('@/lib/article-quality-filter');

  if (!db) {
    throw new Error('Firebase not initialized');
  }

  const collectionName = getCollectionName('ARTICLES', brand);
  console.log(`📂 [${brand}] Collection: ${collectionName}`);

  // Get ALL unprocessed articles
  const q = query(
    collection(db, collectionName),
    where('processed', '==', false)
  );

  const snapshot = await getDocs(q);
  const articles = snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  })) as any[];

  console.log(`📊 [${brand}] Found ${articles.length} unprocessed articles`);

  if (articles.length === 0) {
    return {
      brand,
      rated: 0,
      kept: 0,
      deleted: 0,
      duration: Math.round((Date.now() - startTime) / 1000)
    };
  }

  console.log(`🤖 [${brand}] Rating ${articles.length} articles with OpenAI GPT-4o-mini...`);

  // Rate all articles with AI (batches of 5 concurrent calls)
  const qualityScores = await evaluateArticlesBatch(
    articles.map((article: any) => ({
      title: article.title,
      content: article.content || article.description,
      category: brand
    })),
    5
  );

  console.log(`✅ [${brand}] AI rating complete`);

  // Pair articles with scores and sort
  const scoredArticles = articles.map((article: any, index) => ({
    article,
    score: qualityScores[index].score,
    reasoning: qualityScores[index].reasoning
  })).sort((a, b) => b.score - a.score);

  console.log(`📊 [${brand}] Top 10 scores: ${scoredArticles.slice(0, 10).map(a => a.score).join(', ')}`);

  // Update ALL articles with scores
  console.log(`💾 [${brand}] Updating ${scoredArticles.length} articles in Firestore...`);
  await Promise.all(
    scoredArticles.map(item =>
      updateDoc(doc(db, collectionName, item.article.id), {
        qualityScore: item.score,
        aiReasoning: item.reasoning,
        ratedAt: Date.now()
      })
    )
  );

  // Delete articles below top N
  const articlesToKeep = scoredArticles.slice(0, keepTopN);
  const articlesToDelete = scoredArticles.slice(keepTopN);

  if (articlesToDelete.length > 0) {
    console.log(`🧹 [${brand}] Deleting ${articlesToDelete.length} low-quality articles`);
    await Promise.all(
      articlesToDelete.map(item =>
        deleteDoc(doc(db, collectionName, item.article.id))
      )
    );
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`✅ [${brand}] Complete in ${duration}s: Rated ${articles.length}, kept ${articlesToKeep.length}, deleted ${articlesToDelete.length}`);

  return {
    brand,
    rated: articles.length,
    kept: articlesToKeep.length,
    deleted: articlesToDelete.length,
    topScores: articlesToKeep.map(a => a.score).slice(0, 10),
    duration
  };
}
