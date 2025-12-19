/**
 * PASS PROPERTY API
 *
 * Allows buyers to pass/skip properties they're not interested in.
 * Stores both quick lookup arrays AND detailed interactions for ML.
 *
 * Two-layer storage:
 * 1. Quick lookup: passedPropertyIds array in buyerProfile (for filtering)
 * 2. Detailed tracking: propertyInteractions/{buyerId}/passed/{interactionId} (for ML)
 */

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

interface PassPropertyRequest {
  propertyId: string;
  action: 'pass' | 'unpass';

  // Optional: Property context at time of pass (for ML training)
  propertyContext?: {
    monthlyPayment: number;
    downPayment: number;
    bedrooms: number;
    bathrooms: number;
    squareFeet?: number;
    city: string;
    source?: 'curated' | 'zillow';
  };

  // Optional: Why they passed (for preference learning)
  passReason?: 'too_expensive' | 'wrong_location' | 'too_small' | 'needs_work' | 'other';
}

export async function POST(request: NextRequest) {
  // Standardized authentication - allow buyers, realtors, and admins to pass properties
  const authResult = await requireRole(request, ['buyer', 'realtor', 'admin']);
  if ('error' in authResult) {
    console.error('[pass-property] Auth failed - user not authenticated or wrong role');
    return authResult.error;
  }
  const { session } = authResult;

  // Standardized body parsing
  const bodyResult = await parseRequestBody<PassPropertyRequest>(request);
  if (!bodyResult.success) {
    return (bodyResult as { success: false; response: NextResponse }).response;
  }

  const { propertyId, action, propertyContext, passReason } = bodyResult.data;

  // Validation
  if (!propertyId || !action) {
    return ErrorResponses.validationError('Missing propertyId or action');
  }

  if (action !== 'pass' && action !== 'unpass') {
    return ErrorResponses.validationError('Action must be "pass" or "unpass"');
  }

  try {
    if (!db) {
      return ErrorResponses.serviceUnavailable('Database not available');
    }

    // Get user profile (buyer or realtor)
    // First try buyerProfiles, then realtorProfiles
    let profileRef: ReturnType<typeof doc> | null = null;
    let profileId: string = '';

    const buyerProfilesQuery = query(
      collection(db, 'buyerProfiles'),
      where('userId', '==', session.user.id)
    );
    const buyerSnapshot = await getDocs(buyerProfilesQuery);

    if (!buyerSnapshot.empty) {
      profileRef = buyerSnapshot.docs[0].ref;
      profileId = buyerSnapshot.docs[0].id;
    } else {
      // Try realtor profile
      const realtorProfilesQuery = query(
        collection(db, 'realtorProfiles'),
        where('userId', '==', session.user.id)
      );
      const realtorSnapshot = await getDocs(realtorProfilesQuery);

      if (!realtorSnapshot.empty) {
        profileRef = realtorSnapshot.docs[0].ref;
        profileId = realtorSnapshot.docs[0].id;
      }
    }

    if (!profileRef) {
      console.error(`[pass-property] No profile found for user ${session.user.id}`);
      return ErrorResponses.notFound('User profile');
    }

    const buyerId = profileId; // Keep variable name for compatibility

    if (action === 'pass') {
      // 1. Add to quick lookup array (for fast filtering in properties API)
      await updateDoc(profileRef, {
        passedPropertyIds: arrayUnion(propertyId),
        updatedAt: serverTimestamp()
      });

      // 2. Store detailed interaction in subcollection (for ML and algorithm improvements)
      const interactionId = `${propertyId}_${Date.now()}`;

      // Build context object, filtering out undefined values
      const context = propertyContext ? Object.fromEntries(
        Object.entries({
          monthlyPayment: propertyContext.monthlyPayment,
          downPayment: propertyContext.downPayment,
          bedrooms: propertyContext.bedrooms,
          bathrooms: propertyContext.bathrooms,
          squareFeet: propertyContext.squareFeet,
          city: propertyContext.city,
          source: propertyContext.source || 'curated',
        }).filter(([, v]) => v !== undefined)
      ) : undefined;

      const interaction: PropertyInteraction = {
        propertyId,
        timestamp: serverTimestamp() as any,
        passReason: passReason || null,
        context: context && Object.keys(context).length > 0 ? context : undefined,
      };

      // Filter out undefined from top level too
      const cleanInteraction = Object.fromEntries(
        Object.entries(interaction).filter(([, v]) => v !== undefined)
      );

      await setDoc(
        doc(db, 'propertyInteractions', buyerId, 'passed', interactionId),
        cleanInteraction
      );

      console.log(`✅ [PASS] User ${buyerId} passed property ${propertyId} (reason: ${passReason || 'not specified'})`);

    } else if (action === 'unpass') {
      // Remove from quick lookup array
      // Note: We don't delete the detailed interaction (keep for ML training data)
      await updateDoc(profileRef, {
        passedPropertyIds: arrayRemove(propertyId),
        updatedAt: serverTimestamp()
      });

      console.log(`✅ [UNPASS] User ${buyerId} un-passed property ${propertyId}`);
    }

    return createSuccessResponse({
      action,
      propertyId,
      message: `Property ${action}ed successfully`
    });

  } catch (error) {
    logError('POST /api/buyer/pass-property', error, {
      userId: session.user.id,
      propertyId,
      action
    });
    return ErrorResponses.databaseError('Failed to update property preference', error);
  }
}

// DELETE endpoint to clear all passed properties
export async function DELETE(request: NextRequest) {
  // Standardized authentication
  const authResult = await requireRole(request, ['buyer', 'realtor', 'admin']);
  if ('error' in authResult) {
    return authResult.error;
  }
  const { session } = authResult;

  try {
    if (!db) {
      return ErrorResponses.serviceUnavailable('Database not available');
    }

    // Get user profile (buyer or realtor)
    let profileRef: ReturnType<typeof doc> | null = null;
    let profileId: string = '';

    const buyerProfilesQuery = query(
      collection(db, 'buyerProfiles'),
      where('userId', '==', session.user.id)
    );
    const buyerSnapshot = await getDocs(buyerProfilesQuery);

    if (!buyerSnapshot.empty) {
      profileRef = buyerSnapshot.docs[0].ref;
      profileId = buyerSnapshot.docs[0].id;
    } else {
      // Try realtor profile
      const realtorProfilesQuery = query(
        collection(db, 'realtorProfiles'),
        where('userId', '==', session.user.id)
      );
      const realtorSnapshot = await getDocs(realtorProfilesQuery);

      if (!realtorSnapshot.empty) {
        profileRef = realtorSnapshot.docs[0].ref;
        profileId = realtorSnapshot.docs[0].id;
      }
    }

    if (!profileRef) {
      return ErrorResponses.notFound('User profile');
    }

    // Clear all passed properties
    await updateDoc(profileRef, {
      passedPropertyIds: [],
      updatedAt: serverTimestamp()
    });

    console.log(`✅ [CLEAR-PASSED] User ${profileId} cleared all passed properties`);

    return createSuccessResponse({
      message: 'All passed properties cleared successfully'
    });

  } catch (error) {
    logError('DELETE /api/buyer/pass-property', error, {
      userId: session.user.id
    });
    return ErrorResponses.databaseError('Failed to clear passed properties', error);
  }
}
