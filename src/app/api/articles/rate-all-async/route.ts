// API to rate all articles with AI in the background (non-blocking)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

interface RateAllRequest {
  brand: 'carz' | 'ownerfi';
  keepTopN?: number;
}

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
    const { brand, keepTopN = 50 } = body;

    if (!brand || (brand !== 'carz' && brand !== 'ownerfi')) {
      return NextResponse.json(
        { error: 'Invalid brand. Must be "carz" or "ownerfi"' },
        { status: 400 }
      );
    }

    console.log(`🚀 Starting background AI rating for ${brand} articles...`);

    // Start the rating process in the background (fire and forget)
    setImmediate(async () => {
      try {
        await rateArticlesInBackground(brand, keepTopN);
      } catch (error) {
        console.error('❌ Background rating failed:', error);
      }
    });

    // Return immediately
    return NextResponse.json({
      success: true,
      message: `Started rating ${brand} articles in background. Check logs for progress.`,
      brand,
      keepTopN,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error starting background rating:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function rateArticlesInBackground(brand: 'carz' | 'ownerfi', keepTopN: number) {
  const { db } = await import('@/lib/firebase');
  const { collection, query, where, getDocs, updateDoc, doc, deleteDoc } = await import('firebase/firestore');
  const { getCollectionName } = await import('@/lib/feed-store-firestore');
  const { evaluateArticlesBatch } = await import('@/lib/article-quality-filter');

  if (!db) {
    console.error('❌ Firebase not initialized');
    return;
  }

  const collectionName = getCollectionName('ARTICLES', brand);

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

  if (articles.length === 0) {
    console.log(`ℹ️  ${brand}: No articles to rate`);
    return;
  }

  console.log(`🤖 ${brand}: Rating ${articles.length} articles with AI...`);

  // Rate all articles with AI
  const qualityScores = await evaluateArticlesBatch(
    articles.map((article: any) => ({
      title: article.title,
      content: article.content || article.description,
      category: brand
    })),
    5 // Max 5 concurrent API calls
  );

  // Pair articles with their scores
  const scoredArticles = articles.map((article: any, index) => ({
    article,
    score: qualityScores[index].score,
    reasoning: qualityScores[index].reasoning
  }));

  // Sort by score (highest first)
  scoredArticles.sort((a, b) => b.score - a.score);

  // Update quality scores in Firestore for all articles
  const updatePromises = scoredArticles.map(item =>
    updateDoc(doc(db, collectionName, item.article.id), {
      qualityScore: item.score,
      aiReasoning: item.reasoning,
      ratedAt: Date.now()
    })
  );
  await Promise.all(updatePromises);

  // Keep top N, delete the rest
  const articlesToKeep = scoredArticles.slice(0, keepTopN);
  const articlesToDelete = scoredArticles.slice(keepTopN);

  console.log(`📊 ${brand}: Top ${articlesToKeep.length} scores: ${articlesToKeep.map(a => a.score).join(', ')}`);

  if (articlesToDelete.length > 0) {
    console.log(`🧹 ${brand}: Deleting ${articlesToDelete.length} low-quality articles`);

    for (const item of articlesToDelete) {
      await deleteDoc(doc(db, collectionName, item.article.id));
    }
  }

  console.log(`✅ ${brand}: Background rating complete! Rated ${articles.length}, kept ${articlesToKeep.length}, deleted ${articlesToDelete.length}`);
}
