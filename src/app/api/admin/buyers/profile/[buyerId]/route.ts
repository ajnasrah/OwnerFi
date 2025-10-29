import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import {
  collection,
  query,
  getDocs,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError } from '@/lib/logger';
import { ExtendedSession } from '@/types/session';
import { firestoreToBuyerProfile } from '@/lib/view-models';

// GET - Fetch single buyer profile for admin preview
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ buyerId: string }> }
) {
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

    // Await params in Next.js 15+
    const { buyerId } = await params;

    // Get buyer profile
    const profileQuery = query(
      collection(db, 'buyerProfiles'),
      where('id', '==', buyerId)
    );
    const profileSnapshot = await getDocs(profileQuery);

    if (profileSnapshot.empty) {
      return NextResponse.json(
        { error: 'Buyer profile not found' },
        { status: 404 }
      );
    }

    const profileDoc = profileSnapshot.docs[0];
    const profile = firestoreToBuyerProfile(profileDoc.id, profileDoc.data());

    return NextResponse.json({
      profile,
    });

  } catch (error) {
    await logError('Failed to fetch buyer profile', {
      action: 'admin_buyer_profile_fetch'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to fetch buyer profile' },
      { status: 500 }
    );
  }
}
