import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import {
  collection,
  query,
  getDocs,
  where,
  doc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError } from '@/lib/logger';
import { ExtendedSession } from '@/types/session';

interface Buyer {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  state?: string;
  maxMonthlyPayment?: number;
  maxDownPayment?: number;
  createdAt: string;
}

// GET - Fetch all buyers
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

    // Get all users with role 'buyer'
    const usersQuery = query(
      collection(db, 'users'),
      where('role', '==', 'buyer')
    );

    const usersSnapshot = await getDocs(usersQuery);

    // Get all buyer profiles
    const buyerProfilesSnapshot = await getDocs(collection(db, 'buyerProfiles'));

    // Create a map of buyer profiles by user ID
    const buyerProfilesMap = new Map();
    buyerProfilesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.userId) {
        buyerProfilesMap.set(data.userId, { ...data, profileId: doc.id });
      }
    });

    const buyers: Buyer[] = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const buyerProfile = buyerProfilesMap.get(userDoc.id);

      const buyer: Buyer = {
        id: userDoc.id,
        email: userData.email || 'N/A',
        firstName: buyerProfile?.firstName || userData.firstName,
        lastName: buyerProfile?.lastName || userData.lastName,
        phone: buyerProfile?.phone || userData.phone,
        city: buyerProfile?.preferredCity || buyerProfile?.city || userData.city,
        state: buyerProfile?.preferredState || buyerProfile?.state || userData.state,
        maxMonthlyPayment: buyerProfile?.maxMonthlyPayment,
        maxDownPayment: buyerProfile?.maxDownPayment,
        createdAt: userData.createdAt?.toDate?.()?.toISOString() ||
                   userData.registeredAt?.toDate?.()?.toISOString() ||
                   new Date().toISOString()
      };

      buyers.push(buyer);
    }

    // Sort by creation date (newest first)
    buyers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      buyers,
      total: buyers.length
    });

  } catch (error) {
    await logError('Failed to fetch buyers', {
      action: 'admin_buyers_fetch'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to fetch buyers' },
      { status: 500 }
    );
  }
}

// DELETE - Delete selected buyers
export async function DELETE(request: NextRequest) {
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

    const { buyerIds } = await request.json();

    if (!buyerIds || !Array.isArray(buyerIds) || buyerIds.length === 0) {
      return NextResponse.json(
        { error: 'No buyer IDs provided' },
        { status: 400 }
      );
    }

    // Delete buyers from users collection and their profiles
    let deletedCount = 0;
    const errors: string[] = [];

    for (const buyerId of buyerIds) {
      try {
        // Delete from users collection
        await deleteDoc(doc(db, 'users', buyerId));

        // Also try to delete from buyerProfiles collection
        const profileQuery = query(
          collection(db, 'buyerProfiles'),
          where('userId', '==', buyerId)
        );
        const profileSnapshot = await getDocs(profileQuery);

        for (const profileDoc of profileSnapshot.docs) {
          await deleteDoc(doc(db, 'buyerProfiles', profileDoc.id));
        }

        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete buyer ${buyerId}:`, error);
        errors.push(buyerId);
      }
    }

    if (errors.length > 0) {
      await logError('Failed to delete some buyers', {
        action: 'admin_buyers_delete'
      }, new Error('Partial deletion failure'));

      return NextResponse.json({
        deletedCount,
        failedCount: errors.length,
        message: `Deleted ${deletedCount} buyers, ${errors.length} failed`
      });
    }

    return NextResponse.json({
      deletedCount,
      message: `Successfully deleted ${deletedCount} buyer(s)`
    });

  } catch (error) {
    await logError('Failed to delete buyers', {
      action: 'admin_buyers_delete'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to delete buyers' },
      { status: 500 }
    );
  }
}