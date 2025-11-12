import { NextRequest, NextResponse } from 'next/server';
import {
  collection,
  query,
  where,
  getDocs,
  documentId
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { requireRole } from '@/lib/auth-helpers';
import {
  ErrorResponses,
  createSuccessResponse,
  logError
} from '@/lib/api-error-handler';

export async function GET(request: NextRequest) {
  // Standardized authentication
  const authResult = await requireRole(request, 'buyer');
  if ('error' in authResult) return authResult.error;
  const { session } = authResult;

  try {
    if (!db) {
      return ErrorResponses.serviceUnavailable('Database not available');
    }

    // Get buyer profile with liked properties
    const profilesQuery = query(
      collection(db, 'buyerProfiles'),
      where('userId', '==', session.user.id)
    );
    const snapshot = await getDocs(profilesQuery);

    if (snapshot.empty) {
      return createSuccessResponse({
        likedProperties: [],
        profile: null,
        total: 0
      });
    }

    const profile = snapshot.docs[0].data();
    const likedPropertyIds = profile.likedPropertyIds || profile.likedProperties || [];

    if (likedPropertyIds.length === 0) {
      return createSuccessResponse({
        likedProperties: [],
        profile,
        total: 0
      });
    }

    // Get property details for liked properties
    const allProperties = [];

    // Batch fetch in groups of 10 (Firestore limit)
    for (let i = 0; i < likedPropertyIds.length; i += 10) {
      const batch = likedPropertyIds.slice(i, i + 10);

      const batchQuery = query(
        collection(db, 'properties'),
        where(documentId(), 'in', batch)
      );

      const batchSnapshot = await getDocs(batchQuery);
      const batchProperties = batchSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isLiked: true
      }));

      allProperties.push(...batchProperties);
    }

    return createSuccessResponse({
      likedProperties: allProperties,
      profile,
      total: allProperties.length
    });

  } catch (error) {
    logError('GET /api/buyer/liked-properties', error, {
      userId: session.user.id
    });
    return ErrorResponses.databaseError('Failed to load liked properties', error);
  }
}
