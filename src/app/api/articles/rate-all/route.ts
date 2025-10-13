// API to rate all articles with AI and keep only top N
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { rateAndCleanupArticles } from '@/lib/feed-store-firestore';

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

    console.log(`🤖 Rating all ${brand} articles and keeping top ${keepTopN}...`);

    // Rate all articles and cleanup
    const results = await rateAndCleanupArticles(keepTopN);

    const brandResults = results[brand];

    console.log(`✅ Rated ${brandResults.rated} articles, kept ${brandResults.kept}, deleted ${brandResults.deleted}`);

    return NextResponse.json({
      success: true,
      results: brandResults,
      message: `Rated ${brandResults.rated} articles, kept top ${brandResults.kept}`,
      timestamp: new Date().toISOString()
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
