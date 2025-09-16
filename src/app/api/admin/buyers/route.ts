import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import {
  collection,
  query,
  getDocs,
  where
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
  isPurchased?: boolean;
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
    // Temporarily removed orderBy to avoid issues with missing createdAt fields
    const usersQuery = query(
      collection(db, 'users'),
      where('role', '==', 'buyer')
    );

    const usersSnapshot = await getDocs(usersQuery);
    const buyerStats: BuyerStats[] = [];

    console.log(`Found ${usersSnapshot.docs.length} users with role 'buyer'`);

    // Batch fetch all related data including lead purchases to check if buyer was purchased
    const [buyerProfilesSnapshot, propertyActionsSnapshot, leadPurchasesSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'buyerProfiles'))),
      getDocs(query(collection(db, 'propertyActions'), where('action', '==', 'like'))),
      getDocs(query(collection(db, 'leadPurchases')))
    ]);

    // Build set of purchased buyer IDs
    const purchasedBuyerIds = new Set<string>();
    leadPurchasesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.buyerId) {
        purchasedBuyerIds.add(data.buyerId);
      }
    });

    // Build maps for fast lookup
    const buyerProfileMap = new Map<string, any>();
    buyerProfilesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      // Map by both userId and doc.id for flexibility
      if (data.userId) {
        buyerProfileMap.set(data.userId, {
          firstName: data.firstName,
          lastName: data.lastName,
          city: data.city,
          state: data.state,
          maxDownPayment: data.maxDownPayment,
          maxMonthlyPayment: data.maxMonthlyPayment,
          phone: data.phone,
          likedProperties: data.likedProperties || [],
          isPurchased: purchasedBuyerIds.has(doc.id)
        });
      }
      // Also map by document ID
      buyerProfileMap.set(doc.id, {
        firstName: data.firstName,
        lastName: data.lastName,
        city: data.city,
        state: data.state,
        maxDownPayment: data.maxDownPayment,
        maxMonthlyPayment: data.maxMonthlyPayment,
        phone: data.phone,
        likedProperties: data.likedProperties || [],
        isPurchased: purchasedBuyerIds.has(doc.id)
      });
    });

    // Count likes per buyer
    const likeCountMap = new Map<string, number>();
    propertyActionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.userId) {
        const count = likeCountMap.get(data.userId) || 0;
        likeCountMap.set(data.userId, count + 1);
      }
    });

    // Process all buyer users with aggregated data
    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();
        const profileData = buyerProfileMap.get(userDoc.id);

        // Use liked properties array from profile or count from propertyActions
        const likeCount = profileData?.likedProperties?.length ||
                          likeCountMap.get(userDoc.id) ||
                          0;

        const buyerStat: BuyerStats = {
          id: userDoc.id,
          name: profileData?.firstName && profileData?.lastName
            ? `${profileData.firstName} ${profileData.lastName}`
            : userData.name || userData.email || 'N/A',
          email: userData.email || 'N/A',
          phone: profileData?.phone || userData.phone,
          primaryCity: profileData?.city || userData.city,
          primaryState: profileData?.state || userData.state,
          downPayment: profileData?.maxDownPayment || userData.maxDownPayment,
          monthlyBudget: profileData?.maxMonthlyPayment || userData.maxMonthlyPayment,
          matchedPropertiesCount: 0,
          likedPropertiesCount: likeCount,
          loginCount: userData.loginCount || (profileData ? 1 : 0),
          lastSignIn: userData.lastSignIn?.toDate?.()?.toISOString() || userData.lastLoginAt?.toDate?.()?.toISOString(),
          createdAt: userData.createdAt?.toDate?.()?.toISOString() || userData.registeredAt?.toDate?.()?.toISOString(),
          isActive: userData.isActive !== false,
          isPurchased: profileData?.isPurchased || purchasedBuyerIds.has(userDoc.id)
        };

        buyerStats.push(buyerStat);
      } catch (error) {
        console.error(`Error processing buyer ${userDoc.id}:`, error);
      }
    }

    // Sort by liked properties count (highest first), then by login count as secondary
    const sortedBuyers = buyerStats
      .sort((a, b) => {
        if (b.likedPropertiesCount !== a.likedPropertiesCount) {
          return b.likedPropertiesCount - a.likedPropertiesCount;
        }
        return b.loginCount - a.loginCount;
      })
      .slice(0, limit);

    return NextResponse.json({
      buyers: sortedBuyers,
      total: buyerStats.length,
      showing: `${sortedBuyers.length} of ${buyerStats.length} buyers`,
      stats: {
        totalPurchasedBuyers: purchasedBuyerIds.size,
        totalActiveBuyers: buyerStats.filter(b => b.isActive).length
      }
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