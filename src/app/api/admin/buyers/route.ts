import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import {
  collection,
  query,
  getDocs,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError } from '@/lib/logger';
import { ExtendedSession } from '@/types/session';

interface BuyerStats {
  id: string;
  name: string;
  email: string;
  phone?: string;
  primaryCity?: string;
  primaryState?: string;
  downPayment?: number;
  monthlyBudget?: number;
  matchedPropertiesCount: number;
  likedPropertiesCount: number;
  loginCount: number;
  lastSignIn?: string;
  createdAt?: string;
  isActive?: boolean;
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');

    // Get all users with role 'buyer'
    const usersQuery = query(
      collection(db, 'users'),
      where('role', '==', 'buyer'),
      orderBy('createdAt', 'desc')
    );

    const usersSnapshot = await getDocs(usersQuery);
    const buyerStats: BuyerStats[] = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();

      // Get buyer profile data
      const profileQuery = query(
        collection(db, 'buyerProfiles'),
        where('userId', '==', userDoc.id)
      );
      const profileSnapshot = await getDocs(profileQuery);
      const profileData = profileSnapshot.docs[0]?.data();

      // Count matched properties
      const matchedPropertiesQuery = query(
        collection(db, 'propertyMatches'),
        where('buyerId', '==', userDoc.id)
      );
      const matchedPropertiesSnapshot = await getDocs(matchedPropertiesQuery);

      // Count liked properties
      const likedPropertiesQuery = query(
        collection(db, 'propertyActions'),
        where('userId', '==', userDoc.id),
        where('action', '==', 'like')
      );
      const likedPropertiesSnapshot = await getDocs(likedPropertiesQuery);

      // Get login count from user sessions (if available)
      let loginCount = 0;
      try {
        const sessionsQuery = query(
          collection(db, 'userSessions'),
          where('userId', '==', userDoc.id)
        );
        const sessionsSnapshot = await getDocs(sessionsQuery);
        loginCount = sessionsSnapshot.size;
      } catch {
        // Sessions collection might not exist, default to 0
        loginCount = userData.loginCount || 0;
      }

      const buyerStat: BuyerStats = {
        id: userDoc.id,
        name: userData.name || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'N/A',
        email: userData.email || 'N/A',
        phone: userData.phone || profileData?.phoneNumber,
        primaryCity: profileData?.primaryCity || userData.city,
        primaryState: profileData?.primaryState || userData.state,
        downPayment: profileData?.maxDownPayment || userData.maxDownPayment,
        monthlyBudget: profileData?.maxMonthlyPayment || userData.maxMonthlyPayment,
        matchedPropertiesCount: matchedPropertiesSnapshot.size,
        likedPropertiesCount: likedPropertiesSnapshot.size,
        loginCount,
        lastSignIn: userData.lastSignIn?.toDate?.()?.toISOString() || userData.lastLoginAt?.toDate?.()?.toISOString(),
        createdAt: userData.createdAt?.toDate?.()?.toISOString() || userData.registeredAt?.toDate?.()?.toISOString(),
        isActive: userData.isActive !== false
      };

      buyerStats.push(buyerStat);
    }

    // Sort by creation date (newest first) and limit
    const sortedBuyers = buyerStats
      .sort((a, b) => (new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()))
      .slice(0, limit);

    return NextResponse.json({
      buyers: sortedBuyers,
      total: buyerStats.length,
      showing: `${sortedBuyers.length} of ${buyerStats.length} buyers`
    });

  } catch (error) {
    await logError('Failed to fetch buyer stats', {
      action: 'admin_buyers_fetch'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to fetch buyer statistics' },
      { status: 500 }
    );
  }
}