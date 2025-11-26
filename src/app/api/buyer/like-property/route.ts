import { NextRequest, NextResponse } from 'next/server';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  setDoc,
  doc,
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
import { PropertyInteraction } from '@/lib/firebase-models';

interface LikePropertyRequest {
  propertyId: string;
  action: 'like' | 'unlike';

  // 🆕 Optional: Property context at time of like (for ML training)
  propertyContext?: {
    monthlyPayment: number;
    downPayment: number;
    bedrooms: number;
    bathrooms: number;
    squareFeet?: number;
    city: string;
    source?: 'curated' | 'zillow';
  };
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

  const { propertyId, action, propertyContext } = bodyResult.data;

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

    const buyerId = snapshot.docs[0].id;
    const profileDoc = snapshot.docs[0];
    const profile = snapshot.docs[0].data();

    // Update liked properties array (using likedPropertyIds to match the schema)
    if (action === 'like') {
      // 1. Add to quick lookup array
      await updateDoc(profileDoc.ref, {
        likedPropertyIds: arrayUnion(propertyId),
        likedProperties: arrayUnion(propertyId), // Keep legacy field for backward compat
        updatedAt: serverTimestamp()
      });

      // 🆕 2. Store detailed interaction in subcollection (for ML and algorithm improvements)
      const interactionId = `${propertyId}_${Date.now()}`;
      const interaction: PropertyInteraction = {
        propertyId,
        timestamp: serverTimestamp() as any,
        context: propertyContext ? {
          // Property details
          monthlyPayment: propertyContext.monthlyPayment,
          downPayment: propertyContext.downPayment,
          bedrooms: propertyContext.bedrooms,
          bathrooms: propertyContext.bathrooms,
          squareFeet: propertyContext.squareFeet,
          city: propertyContext.city,

          source: propertyContext.source || 'curated',
        } : undefined,
      };

      await setDoc(
        doc(db, 'propertyInteractions', buyerId, 'liked', interactionId),
        interaction
      );

      console.log(`✅ [LIKE] User ${buyerId} liked property ${propertyId}`);
    } else {
      await updateDoc(profileDoc.ref, {
        likedPropertyIds: arrayRemove(propertyId),
        likedProperties: arrayRemove(propertyId), // Keep legacy field for backward compat
        updatedAt: serverTimestamp()
      });

      console.log(`✅ [UNLIKE] User ${buyerId} unliked property ${propertyId}`);
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
