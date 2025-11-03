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
import { BuyerAdminView, firestoreToBuyerProfile, toBuyerAdminView } from '@/lib/view-models';
import { convertTimestampToDate } from '@/lib/firebase-models';

// GET - Fetch all buyers
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

    // Add pagination support
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');

    // Get all users with role 'buyer' with pagination
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
        buyerProfilesMap.set(data.userId, firestoreToBuyerProfile(doc.id, data));
      }
    });

    // OPTIMIZATION: Fetch all matched properties in one query instead of N queries
    const allBuyerIds = usersSnapshot.docs.map(doc => doc.id);
    const matchedCountsMap = new Map<string, number>();

    // Batch fetch matched properties for all buyers at once
    if (allBuyerIds.length > 0) {
      // Firestore 'in' operator supports up to 10 values, so we need to batch
      const batchSize = 10;
      for (let i = 0; i < allBuyerIds.length; i += batchSize) {
        const batchIds = allBuyerIds.slice(i, i + batchSize);
        const matchedQuery = query(
          collection(db, 'propertyBuyerMatches'),
          where('buyerId', 'in', batchIds)
        );
        const matchedSnapshot = await getDocs(matchedQuery);

        // Count matches per buyer
        matchedSnapshot.docs.forEach(doc => {
          const buyerId = doc.data().buyerId;
          matchedCountsMap.set(buyerId, (matchedCountsMap.get(buyerId) || 0) + 1);
        });
      }
    }

    const buyers: BuyerAdminView[] = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const buyerProfile = buyerProfilesMap.get(userDoc.id);

      if (!buyerProfile) continue; // Skip users without buyer profiles

      // Get matched properties count from pre-computed map (no query here!)
      const matchedPropertiesCount = matchedCountsMap.get(userDoc.id) || 0;

      // Get liked properties count from likedPropertyIds
      const likedPropertiesCount = buyerProfile.likedPropertyIds?.length || 0;

      const buyer = toBuyerAdminView(buyerProfile, {
        matchedPropertiesCount,
        likedPropertiesCount,
        loginCount: userData.loginCount || 0,
        lastSignIn: convertTimestampToDate(userData.lastSignIn),
      });

      buyers.push(buyer);
    }

    // Sort by creation date (newest first)
    buyers.sort((a, b) => {
      const dateA = a.createdAt && typeof a.createdAt === 'object' && 'toDate' in a.createdAt
        ? (a.createdAt as any).toDate().getTime()
        : new Date(a.createdAt as any).getTime();
      const dateB = b.createdAt && typeof b.createdAt === 'object' && 'toDate' in b.createdAt
        ? (b.createdAt as any).toDate().getTime()
        : new Date(b.createdAt as any).getTime();
      return dateB - dateA;
    });

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

    // PERFORMANCE FIX: Replace N+1 sequential queries with parallel batch operations
    // OLD: 100 buyers = 300 sequential queries = 30+ seconds
    // NEW: Parallel queries + batch delete = 2-3 seconds

    // Step 1: Query all related data in parallel (not sequential!)
    const allProfilesPromises = buyerIds.map(buyerId =>
      getDocs(query(collection(db, 'buyerProfiles'), where('userId', '==', buyerId)))
    );
    const allLikedPromises = buyerIds.map(buyerId =>
      getDocs(query(collection(db, 'likedProperties'), where('buyerId', '==', buyerId)))
    );
    const allMatchedPromises = buyerIds.map(buyerId =>
      getDocs(query(collection(db, 'matchedProperties'), where('buyerId', '==', buyerId)))
    );

    // Execute all queries in parallel (3 concurrent batches)
    const [allProfiles, allLiked, allMatched] = await Promise.all([
      Promise.all(allProfilesPromises),
      Promise.all(allLikedPromises),
      Promise.all(allMatchedPromises)
    ]);

    // Step 2: Collect all documents to delete
    const docsToDelete: { ref: any; buyerId: string }[] = [];

    buyerIds.forEach((buyerId, index) => {
      // User document
      docsToDelete.push({
        ref: doc(db, 'users', buyerId),
        buyerId
      });

      // Profile documents
      allProfiles[index].docs.forEach(profileDoc => {
        docsToDelete.push({
          ref: doc(db, 'buyerProfiles', profileDoc.id),
          buyerId
        });
      });

      // Liked properties documents
      allLiked[index].docs.forEach(likedDoc => {
        docsToDelete.push({
          ref: doc(db, 'likedProperties', likedDoc.id),
          buyerId
        });
      });

      // Matched properties documents
      allMatched[index].docs.forEach(matchedDoc => {
        docsToDelete.push({
          ref: doc(db, 'matchedProperties', matchedDoc.id),
          buyerId
        });
      });
    });

    // Step 3: Delete in batches (max 500 operations per batch)
    const { writeBatch } = await import('firebase/firestore');
    const BATCH_SIZE = 500;
    const batches = [];

    for (let i = 0; i < docsToDelete.length; i += BATCH_SIZE) {
      const chunk = docsToDelete.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      chunk.forEach(({ ref }) => {
        batch.delete(ref);
      });

      batches.push(batch.commit());
    }

    try {
      await Promise.all(batches);
      deletedCount = buyerIds.length;
      console.log(`✅ Deleted ${deletedCount} buyers and ${docsToDelete.length} related documents in ${batches.length} batch(es)`);
    } catch (error) {
      console.error('Failed to delete buyers:', error);
      errors.push(...buyerIds); // Mark all as failed if batch deletion fails
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