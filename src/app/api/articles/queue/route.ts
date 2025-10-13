// API to fetch unprocessed articles queue for both brands
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, limit as firestoreLimit } from 'firebase/firestore';

interface Article {
  id: string;
  title: string;
  description: string;
  link: string;
  pubDate: number;
  processed: boolean;
  qualityScore?: number;
  aiReasoning?: string;
  feedId: string;
  categories: string[];
  author?: string;
}

export async function GET(request: NextRequest) {
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

    // Fetch unprocessed articles for both brands
    const carzArticles: Article[] = [];
    const ownerfiArticles: Article[] = [];

    // Get Carz articles
    const carzQuery = query(
      collection(db, 'carz_articles'),
      where('processed', '==', false),
      orderBy('pubDate', 'desc'),
      firestoreLimit(50)
    );

    const carzSnapshot = await getDocs(carzQuery);
    carzSnapshot.docs.forEach(doc => {
      const data = doc.data();
      carzArticles.push({
        id: doc.id,
        title: data.title || '',
        description: data.description || '',
        link: data.link || '',
        pubDate: data.pubDate || Date.now(),
        processed: data.processed || false,
        qualityScore: data.qualityScore,
        aiReasoning: data.aiReasoning,
        feedId: data.feedId || '',
        categories: data.categories || [],
        author: data.author
      });
    });

    // Get OwnerFi articles
    const ownerfiQuery = query(
      collection(db, 'ownerfi_articles'),
      where('processed', '==', false),
      orderBy('pubDate', 'desc'),
      firestoreLimit(50)
    );

    const ownerfiSnapshot = await getDocs(ownerfiQuery);
    ownerfiSnapshot.docs.forEach(doc => {
      const data = doc.data();
      ownerfiArticles.push({
        id: doc.id,
        title: data.title || '',
        description: data.description || '',
        link: data.link || '',
        pubDate: data.pubDate || Date.now(),
        processed: data.processed || false,
        qualityScore: data.qualityScore,
        aiReasoning: data.aiReasoning,
        feedId: data.feedId || '',
        categories: data.categories || [],
        author: data.author
      });
    });

    // Sort by quality score (if available) then by date
    const sortArticles = (articles: Article[]) => {
      return articles.sort((a, b) => {
        // If both have quality scores, sort by score
        if (a.qualityScore && b.qualityScore) {
          return b.qualityScore - a.qualityScore;
        }
        // If only one has quality score, prioritize it
        if (a.qualityScore) return -1;
        if (b.qualityScore) return 1;
        // Otherwise sort by date
        return b.pubDate - a.pubDate;
      });
    };

    return NextResponse.json({
      success: true,
      articles: {
        carz: sortArticles(carzArticles),
        ownerfi: sortArticles(ownerfiArticles)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching articles:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
