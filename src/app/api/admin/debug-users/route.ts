import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import {
  collection,
  query,
  getDocs,
  where,
  limit as firestoreLimit
} from 'firebase/firestore';
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = await getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    // Get first 10 users to debug
    const usersQuery = query(
      collection(db, 'users'),
      firestoreLimit(10)
    );

    const usersSnapshot = await getDocs(usersQuery);
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Count users by role
    const buyersQuery = query(
      collection(db, 'users'),
      where('role', '==', 'buyer')
    );
    const buyersSnapshot = await getDocs(buyersQuery);

    const realtorsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'realtor')
    );
    const realtorsSnapshot = await getDocs(realtorsQuery);

    const adminQuery = query(
      collection(db, 'users'),
      where('role', '==', 'admin')
    );
    const adminSnapshot = await getDocs(adminQuery);

    return NextResponse.json({
      totalUsers: usersSnapshot.size,
      buyerCount: buyersSnapshot.size,
      realtorCount: realtorsSnapshot.size,
      adminCount: adminSnapshot.size,
      sampleUsers: users,
      buyerIds: buyersSnapshot.docs.slice(0, 5).map(doc => ({
        id: doc.id,
        email: doc.data().email,
        role: doc.data().role,
        name: doc.data().name,
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString()
      })),
      realtorIds: realtorsSnapshot.docs.slice(0, 5).map(doc => ({
        id: doc.id,
        email: doc.data().email,
        role: doc.data().role,
        name: doc.data().name,
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString()
      }))
    });

  } catch (error) {
    console.error('Debug users error:', error);
    return NextResponse.json(
      { error: 'Failed to debug users', details: (error as Error).message },
      { status: 500 }
    );
  }
}