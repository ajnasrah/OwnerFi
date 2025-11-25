import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ExtendedSession } from '@/types/session';

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

    // Get counts in parallel
    const [propertiesSnapshot, buyersSnapshot, realtorsSnapshot, disputesSnapshot] = await Promise.all([
      getDocs(collection(db, 'properties')),
      getDocs(collection(db, 'buyers')),
      getDocs(collection(db, 'realtors')),
      getDocs(query(collection(db, 'disputes'), where('status', '==', 'pending')))
    ]);

    return NextResponse.json({
      totalProperties: propertiesSnapshot.size,
      totalBuyers: buyersSnapshot.size,
      totalRealtors: realtorsSnapshot.size,
      pendingDisputes: disputesSnapshot.size
    });

  } catch (error) {
    console.error('Failed to fetch admin stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
