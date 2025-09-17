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

interface RealtorStats {
  id: string;
  name: string;
  email: string;
  phone?: string;
  licenseNumber?: string;
  brokerage?: string;
  city?: string;
  state?: string;
  credits: number;
  availableBuyersCount: number;
  totalLeadsPurchased: number;
  lastSignIn?: string;
  createdAt?: string;
  isActive?: boolean;
  subscriptionStatus?: string;
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

    // Get all users with role 'realtor'
    // Temporarily removed orderBy to avoid issues with missing createdAt fields
    const usersQuery = query(
      collection(db, 'users'),
      where('role', '==', 'realtor')
    );

    const usersSnapshot = await getDocs(usersQuery);
    const realtorStats: RealtorStats[] = [];

    // Batch fetch all related data - leadPurchases and buyer profiles only
    const [leadPurchasesSnapshot, buyerProfilesSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'leadPurchases'))),
      getDocs(query(collection(db, 'buyerProfiles'),
        where('isAvailableForPurchase', '==', true),
        where('isActive', '==', true),
        where('profileComplete', '==', true)
      ))
    ]);

    console.log(`Found ${usersSnapshot.docs.length} users with role 'realtor'`);
    console.log(`Found ${leadPurchasesSnapshot.size} lead purchases in 'leadPurchases' collection`);
    console.log(`Found ${buyerProfilesSnapshot.size} available buyer profiles`);

    // Process lead purchases once - track both purchased buyers and realtor counts
    const purchasedBuyerIds = new Set<string>();
    const leadPurchaseCountByUserId = new Map<string, number>();

    leadPurchasesSnapshot.docs.forEach(doc => {
      const data = doc.data();

      // Track purchased buyers
      if (data.buyerId) {
        purchasedBuyerIds.add(data.buyerId);
      }

      // Track by realtor user ID (primary identifier)
      if (data.realtorUserId) {
        const count = leadPurchaseCountByUserId.get(data.realtorUserId) || 0;
        leadPurchaseCountByUserId.set(data.realtorUserId, count + 1);
      } else if (data.realtorId) {
        // Fallback to realtorId if realtorUserId not available
        const count = leadPurchaseCountByUserId.get(data.realtorId) || 0;
        leadPurchaseCountByUserId.set(data.realtorId, count + 1);
      }
    });

    console.log(`Found ${purchasedBuyerIds.size} unique purchased buyers`);

    // Build a map of UNPURCHASED available buyers by state and city
    const availableBuyersByState = new Map<string, number>();
    const availableBuyersByCity = new Map<string, number>();
    let totalUnpurchasedAvailable = 0;

    buyerProfilesSnapshot.docs.forEach(doc => {
      const buyerId = doc.id;

      // Skip if this buyer has been purchased
      if (purchasedBuyerIds.has(buyerId)) {
        return;
      }

      const data = doc.data();
      totalUnpurchasedAvailable++;

      const state = data.preferredState || data.state || 'Unknown';
      const city = data.preferredCity || data.city || 'Unknown';

      // Count by state
      availableBuyersByState.set(state, (availableBuyersByState.get(state) || 0) + 1);

      // Count by city
      availableBuyersByCity.set(city, (availableBuyersByCity.get(city) || 0) + 1);
    });

    console.log(`${totalUnpurchasedAvailable} buyers are available and unpurchased`)

    // Process all realtor users with aggregated data
    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();

        // Get purchase count by user ID
        const purchaseCount = leadPurchaseCountByUserId.get(userDoc.id) || 0;

        // Get credits from realtorData field in user document
        const credits = userData.realtorData?.credits || userData.credits || 0;

        // Extract location info properly
        const primaryCity = userData.realtorData?.serviceArea?.primaryCity;
        const cityName = typeof primaryCity === 'object' ? primaryCity?.name : primaryCity;
        const stateName = typeof primaryCity === 'object' ? primaryCity?.state : userData.realtorData?.serviceArea?.state;

        // Calculate available buyers for this realtor's service area
        let availableInArea = 0;
        if (stateName) {
          // Get buyers in the realtor's state
          availableInArea = availableBuyersByState.get(stateName) || 0;
        } else if (cityName) {
          // Fallback to city if no state
          availableInArea = availableBuyersByCity.get(cityName) || 0;
        }

        const realtorStat: RealtorStats = {
          id: userDoc.id,
          name: userData.realtorData?.firstName && userData.realtorData?.lastName
            ? `${userData.realtorData.firstName} ${userData.realtorData.lastName}`
            : userData.name || userData.email || 'N/A',
          email: userData.email || 'N/A',
          phone: userData.realtorData?.phone || userData.phone,
          licenseNumber: userData.realtorData?.licenseNumber || userData.licenseNumber,
          brokerage: userData.realtorData?.brokerage || userData.brokerage,
          city: cityName || userData.realtorData?.city || userData.city || 'Not set',
          state: stateName || userData.realtorData?.state || userData.state || 'Not set',
          credits: credits,
          availableBuyersCount: availableInArea,
          totalLeadsPurchased: purchaseCount,
          lastSignIn: userData.lastSignIn?.toDate?.()?.toISOString() || userData.lastLoginAt?.toDate?.()?.toISOString(),
          createdAt: userData.createdAt?.toDate?.()?.toISOString() || userData.registeredAt?.toDate?.()?.toISOString(),
          isActive: userData.isActive !== false,
          subscriptionStatus: userData.subscriptionStatus || 'none'
        };

        realtorStats.push(realtorStat);
      } catch (error) {
        console.error(`Error processing realtor ${userDoc.id}:`, error);
      }
    }

    // Sort by total leads purchased (highest first), then by credits as secondary sort
    const sortedRealtors = realtorStats
      .sort((a, b) => {
        if (b.totalLeadsPurchased !== a.totalLeadsPurchased) {
          return b.totalLeadsPurchased - a.totalLeadsPurchased;
        }
        return b.credits - a.credits;
      })
      .slice(0, limit);

    return NextResponse.json({
      realtors: sortedRealtors,
      total: realtorStats.length,
      showing: `${sortedRealtors.length} of ${realtorStats.length} realtors`,
      stats: {
        totalPurchasedBuyers: purchasedBuyerIds.size,
        totalAvailableBuyers: totalUnpurchasedAvailable
      }
    });

  } catch (error) {
    await logError('Failed to fetch realtor stats', {
      action: 'admin_realtors_fetch'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to fetch realtor statistics' },
      { status: 500 }
    );
  }
}