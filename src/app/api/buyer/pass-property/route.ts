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
  // Standardized authentication
  const authResult = await requireRole(request, 'buyer');
  if ('error' in authResult) return authResult.error;
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
    const profile = snapshot.docs[0].data();

    if (action === 'pass') {
      // 1. Add to quick lookup array (for fast filtering in properties API)
      await updateDoc(snapshot.docs[0].ref, {
        passedPropertyIds: arrayUnion(propertyId),
        updatedAt: serverTimestamp()
      });

      // 2. Store detailed interaction in subcollection (for ML and algorithm improvements)
      const interactionId = `${propertyId}_${Date.now()}`;
      const interaction: PropertyInteraction = {
        propertyId,
        timestamp: serverTimestamp() as any, // Firestore will convert to Timestamp
        passReason: passReason || null,
        context: propertyContext ? {
          // Property details
          monthlyPayment: propertyContext.monthlyPayment,
          downPayment: propertyContext.downPayment,
          bedrooms: propertyContext.bedrooms,
          bathrooms: propertyContext.bathrooms,
          squareFeet: propertyContext.squareFeet,
          city: propertyContext.city,

          // User's budget at time of interaction (for ML pattern recognition)
          userMaxMonthly: profile.maxMonthlyPayment || 0,
          userMaxDown: profile.maxDownPayment || 0,

          // Calculate budget match type
          budgetMatchType:
            propertyContext.monthlyPayment <= (profile.maxMonthlyPayment || 0) &&
            propertyContext.downPayment <= (profile.maxDownPayment || 0)
              ? 'both'
              : propertyContext.monthlyPayment <= (profile.maxMonthlyPayment || 0)
              ? 'monthly_only'
              : propertyContext.downPayment <= (profile.maxDownPayment || 0)
              ? 'down_only'
              : 'neither',

          source: propertyContext.source || 'curated',
        } : undefined,
      };

      await setDoc(
        doc(db, 'propertyInteractions', buyerId, 'passed', interactionId),
        interaction
      );

      console.log(`✅ [PASS] User ${buyerId} passed property ${propertyId} (reason: ${passReason || 'not specified'})`);

    } else if (action === 'unpass') {
      // Remove from quick lookup array
      // Note: We don't delete the detailed interaction (keep for ML training data)
      await updateDoc(snapshot.docs[0].ref, {
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
