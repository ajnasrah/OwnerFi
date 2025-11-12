import { NextRequest, NextResponse } from 'next/server';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { requireRole } from '@/lib/auth-helpers';
import {
  ErrorResponses,
  createSuccessResponse,
  parseRequestBody,
  logError
} from '@/lib/api-error-handler';

interface LikePropertyRequest {
  propertyId: string;
  action: 'like' | 'unlike';
}

export async function POST(request: NextRequest) {
  // Standardized authentication
  const authResult = await requireRole(request, 'buyer');
  if ('error' in authResult) return authResult.error;
  const { session } = authResult;

  // Standardized body parsing
  const bodyResult = await parseRequestBody<LikePropertyRequest>(request);
  if (!bodyResult.success) {
    return (bodyResult as { success: false; response: NextResponse }).response;
  }

  const { propertyId, action } = bodyResult.data;

  // Validation
  if (!propertyId || !action) {
    return ErrorResponses.validationError('Missing propertyId or action');
  }

  if (action !== 'like' && action !== 'unlike') {
    return ErrorResponses.validationError('Action must be "like" or "unlike"');
  }

  try {
    if (!db) {
      return ErrorResponses.serviceUnavailable('Database not available');
    }

    // Get buyer profile
    const profilesQuery = query(
      collection(db, 'buyerProfiles'),
      where('userId', '==', session.user.id)
    );
    const snapshot = await getDocs(profilesQuery);

    if (snapshot.empty) {
      return ErrorResponses.notFound('Buyer profile');
    }

    const profileDoc = snapshot.docs[0];

    // Update liked properties array (using likedPropertyIds to match the schema)
    if (action === 'like') {
      await updateDoc(profileDoc.ref, {
        likedPropertyIds: arrayUnion(propertyId),
        likedProperties: arrayUnion(propertyId), // Keep legacy field for backward compat
        updatedAt: serverTimestamp()
      });
    } else {
      await updateDoc(profileDoc.ref, {
        likedPropertyIds: arrayRemove(propertyId),
        likedProperties: arrayRemove(propertyId), // Keep legacy field for backward compat
        updatedAt: serverTimestamp()
      });
    }

    return createSuccessResponse({
      action,
      propertyId,
      message: `Property ${action}d successfully`
    });

  } catch (error) {
    logError('POST /api/buyer/like-property', error, {
      userId: session.user.id,
      propertyId,
      action
    });
    return ErrorResponses.databaseError('Failed to update property preference', error);
  }
}
