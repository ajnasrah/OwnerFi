// Diagnostic endpoint to check article rating status
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit as firestoreLimit } from 'firebase/firestore';

export async function GET(_request: NextRequest) {
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

    if (!db) {
      return NextResponse.json(
        { error: 'Firebase not initialized' },
        { status: 500 }
      );
    }

    const diagnostics = {
      timestamp: new Date().toISOString(),
      carz: await getBrandDiagnostics('carz'),
      ownerfi: await getBrandDiagnostics('ownerfi')
    };

    return NextResponse.json(diagnostics);

  } catch (error) {
    console.error('❌ Diagnostic error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function getBrandDiagnostics(brand: 'carz' | 'ownerfi') {
  const collectionName = brand === 'carz' ? 'carz_articles' : 'ownerfi_articles';

  // Get all articles
  const allQuery = query(collection(db!, collectionName), firestoreLimit(200));
  const allSnapshot = await getDocs(allQuery);
  const total = allSnapshot.size;

  // Get unprocessed
  const unprocessedQuery = query(
    collection(db!, collectionName),
    where('processed', '==', false)
  );
  const unprocessedSnapshot = await getDocs(unprocessedQuery);
  const unprocessed = unprocessedSnapshot.size;

  // Get articles with scores
  const articles = unprocessedSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as any[];

  const withScores = articles.filter(a => a.qualityScore !== undefined).length;
  const withoutScores = articles.filter(a => a.qualityScore === undefined).length;

  // Get sample of articles
  const sample = articles.slice(0, 5).map(a => ({
    id: a.id,
    title: a.title?.substring(0, 50) + '...',
    hasScore: a.qualityScore !== undefined,
    score: a.qualityScore,
    processed: a.processed,
    ratedAt: a.ratedAt ? new Date(a.ratedAt).toISOString() : null
  }));

  return {
    total,
    unprocessed,
    withScores,
    withoutScores,
    sample
  };
}
