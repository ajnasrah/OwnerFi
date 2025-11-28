import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ExtendedSession } from '@/types/session';

// Simple in-memory cache for stats (5 minute TTL)
const statsCache: { data: object | null; timestamp: number } = { data: null, timestamp: 0 };
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const session = await getServerSession(authOptions as unknown as Parameters<typeof getServerSession>[0]) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    // Check cache first
    if (statsCache.data && (Date.now() - statsCache.timestamp) < CACHE_TTL_MS) {
      return NextResponse.json({ ...statsCache.data, cached: true });
    }

    // Use getCountFromServer - much more efficient than loading all docs
    // This only counts documents, doesn't load them into memory
    // FIXED: Count from correct collections:
    // - Properties: both 'properties' (isActive=true) AND 'zillow_imports' (ownerFinanceVerified=true)
    // - Buyers: buyerProfiles collection (only buyers with completed profiles are shown)
    // - Realtors: users with role='realtor'
    // - Disputes: leadDisputes collection
    const [propertiesCount, zillowCount, buyersCount, realtorsCount, disputesCount] = await Promise.all([
      getCountFromServer(query(collection(db, 'properties'), where('isActive', '==', true))),
      getCountFromServer(query(collection(db, 'zillow_imports'), where('ownerFinanceVerified', '==', true))),
      getCountFromServer(collection(db, 'buyerProfiles')),
      getCountFromServer(query(collection(db, 'users'), where('role', '==', 'realtor'))),
      getCountFromServer(query(collection(db, 'leadDisputes'), where('status', '==', 'pending')))
    ]);

    const stats = {
      totalProperties: propertiesCount.data().count + zillowCount.data().count,
      totalBuyers: buyersCount.data().count,
      totalRealtors: realtorsCount.data().count,
      pendingDisputes: disputesCount.data().count
    };

    // Update cache
    statsCache.data = stats;
    statsCache.timestamp = Date.now();

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Failed to fetch admin stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
