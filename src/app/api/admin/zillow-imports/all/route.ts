import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ExtendedSession } from '@/types/session';

// Initialize Firebase Admin (if not already initialized)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

/**
 * GET /api/admin/zillow-imports/all
 *
 * Returns ALL zillow_imports properties with ownerFinanceVerified=true
 * This is what buyers see on their dashboard
 */
export async function GET(request: NextRequest) {
  try {
    // Admin access control
    const session = await getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '1000');
    const state = searchParams.get('state');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = 50;

    // Build query
    let query = db
      .collection('zillow_imports')
      .where('ownerFinanceVerified', '==', true);

    // Apply filters
    if (state) {
      query = query.where('state', '==', state);
    }

    if (status !== 'all' && status) {
      if (status === 'null') {
        query = query.where('status', '==', null);
      } else {
        query = query.where('status', '==', status);
      }
    }

    // Get total count
    const countSnapshot = await query.get();
    const total = countSnapshot.size;

    // Get paginated results
    const offset = (page - 1) * pageSize;
    const snapshot = await query
      .orderBy('foundAt', 'desc')
      .limit(Math.min(limit, 1000))
      .get();

    const allProperties = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Firestore timestamps
        importedAt: data.importedAt?.toDate?.()?.toISOString() || data.importedAt,
        foundAt: data.foundAt?.toDate?.()?.toISOString() || data.foundAt,
        scrapedAt: data.scrapedAt?.toDate?.()?.toISOString() || data.scrapedAt,
        ghlSentAt: data.ghlSentAt?.toDate?.()?.toISOString() || data.ghlSentAt,
      };
    });

    // Paginate in-memory (or use Firestore pagination for better performance)
    const properties = allProperties.slice(offset, offset + pageSize);

    // Calculate stats
    const stats = {
      total,
      withStatus: allProperties.filter((p: any) => p.status !== null && p.status !== undefined).length,
      withoutStatus: allProperties.filter((p: any) => p.status === null || p.status === undefined).length,
      byState: allProperties.reduce((acc: any, p: any) => {
        acc[p.state] = (acc[p.state] || 0) + 1;
        return acc;
      }, {}),
      byKeyword: allProperties.reduce((acc: any, p: any) => {
        const keyword = p.primaryKeyword || 'Unknown';
        acc[keyword] = (acc[keyword] || 0) + 1;
        return acc;
      }, {}),
    };

    return NextResponse.json({
      success: true,
      properties,
      count: properties.length,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasMore: offset + pageSize < total,
      stats,
    });

  } catch (error: any) {
    console.error('Failed to fetch all zillow_imports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch properties', details: error.message },
      { status: 500 }
    );
  }
}
