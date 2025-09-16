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

    console.log(`Found ${usersSnapshot.docs.length} users with role 'realtor'`);

    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();
        console.log(`Processing realtor: ${userData.email || userDoc.id}`);

          // Simplified approach - just get basic profile data without expensive queries
        let profileData = null;
        let creditsData = null;
        let totalLeadsPurchased = 0;
        let availableBuyersCount = 0;

        try {
          // Get realtor profile data
          const profileQuery = query(
            collection(db, 'realtorProfiles'),
            where('userId', '==', userDoc.id)
          );
          const profileSnapshot = await getDocs(profileQuery);
          profileData = profileSnapshot.docs[0]?.data();
        } catch (error) {
          console.warn(`Could not fetch profile for realtor ${userDoc.id}:`, error);
        }

        try {
          // Get credit balance
          const creditsQuery = query(
            collection(db, 'realtorCredits'),
            where('realtorId', '==', userDoc.id)
          );
          const creditsSnapshot = await getDocs(creditsQuery);
          creditsData = creditsSnapshot.docs[0]?.data();
        } catch (error) {
          console.warn(`Could not fetch credits for realtor ${userDoc.id}:`, error);
        }

        try {
          // Count total leads purchased
          const leadsQuery = query(
            collection(db, 'leadPurchases'),
            where('realtorId', '==', userDoc.id)
          );
          const leadsSnapshot = await getDocs(leadsQuery);
          totalLeadsPurchased = leadsSnapshot.size;
        } catch (error) {
          console.warn(`Could not fetch leads for realtor ${userDoc.id}:`, error);
        }

        try {
          // Count available buyers (simplified version)
          const buyersQuery = query(
            collection(db, 'users'),
            where('role', '==', 'buyer')
          );
          const buyersSnapshot = await getDocs(buyersQuery);
          availableBuyersCount = Math.max(0, buyersSnapshot.size - totalLeadsPurchased);
        } catch (error) {
          console.warn(`Could not fetch buyers count for realtor ${userDoc.id}:`, error);
        }

        const realtorStat: RealtorStats = {
          id: userDoc.id,
          name: userData.name || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'N/A',
          email: userData.email || 'N/A',
          phone: userData.phone || profileData?.phoneNumber,
          licenseNumber: profileData?.licenseNumber,
          brokerage: profileData?.brokerage,
          city: profileData?.city || userData.city,
          state: profileData?.state || userData.state,
          credits: creditsData?.balance || userData.credits || 0,
          availableBuyersCount,
          totalLeadsPurchased,
          lastSignIn: userData.lastSignIn?.toDate?.()?.toISOString() || userData.lastLoginAt?.toDate?.()?.toISOString(),
          createdAt: userData.createdAt?.toDate?.()?.toISOString() || userData.registeredAt?.toDate?.()?.toISOString(),
          isActive: userData.isActive !== false,
          subscriptionStatus: userData.subscriptionStatus || creditsData?.subscriptionStatus || 'none'
        };

        realtorStats.push(realtorStat);
      } catch (error) {
        console.error(`Error processing realtor ${userDoc.id}:`, error);
        // Continue processing other realtors even if one fails
      }
    }

    // Sort by creation date (newest first) and limit
    const sortedRealtors = realtorStats
      .sort((a, b) => (new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()))
      .slice(0, limit);

    return NextResponse.json({
      realtors: sortedRealtors,
      total: realtorStats.length,
      showing: `${sortedRealtors.length} of ${realtorStats.length} realtors`
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