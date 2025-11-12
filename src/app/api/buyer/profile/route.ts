import { NextRequest, NextResponse } from 'next/server';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { unifiedDb } from '@/lib/unified-db';
import { syncBuyerToGHL } from '@/lib/gohighlevel-api';
import { logInfo, logWarn } from '@/lib/logger';
import { requireRole } from '@/lib/auth-helpers';
import {
  ErrorResponses,
  createSuccessResponse,
  parseRequestBody,
  logError
} from '@/lib/api-error-handler';

/**
 * SIMPLIFIED BUYER PROFILE API
 * 
 * Stores ONLY essential buyer data:
 * - Contact info (from user record)
 * - Search preferences (city, budgets)
 * 
 * NO realtor matching, NO complex algorithms, NO dependencies.
 */

export async function GET(request: NextRequest) {
  // Standardized authentication
  const authResult = await requireRole(request, 'buyer');
  if ('error' in authResult) return authResult.error;
  const { session } = authResult;

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
      return createSuccessResponse({ profile: null });
    }

    const profile = {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data()
    };

    return createSuccessResponse({ profile });

  } catch (error) {
    logError('GET /api/buyer/profile', error, { userId: session.user.id });
    return ErrorResponses.databaseError('Failed to load profile', error);
  }
}

interface BuyerProfileUpdate {
  firstName?: string;
  lastName?: string;
  phone?: string;
  city: string;
  state: string;
  maxMonthlyPayment: number;
  maxDownPayment: number;
}

export async function POST(request: NextRequest) {
  // Standardized authentication
  const authResult = await requireRole(request, 'buyer');
  if ('error' in authResult) return authResult.error;
  const { session } = authResult;

  // Standardized body parsing
  const bodyResult = await parseRequestBody<BuyerProfileUpdate>(request);
  if (!bodyResult.success) {
    return (bodyResult as { success: false; response: NextResponse }).response;
  }

  const body = bodyResult.data;

  try {
    if (!db) {
      return ErrorResponses.serviceUnavailable('Database not available');
    }

    const {
      firstName,
      lastName,
      phone,
      city,
      state,
      maxMonthlyPayment,
      maxDownPayment
    } = body;

    // Validate required fields
    if (!city || !state || !maxMonthlyPayment || !maxDownPayment) {
      return ErrorResponses.validationError(
        'Missing required: city, state, maxMonthlyPayment, maxDownPayment'
      );
    }

    // Get user contact info from database if not provided
    const userRecord = await unifiedDb.users.findById(session.user.id);
    
    // Consolidated profile structure - includes lead selling fields
    const profileData = {
      userId: session.user.id,

      // Contact info (try request first, fallback to user record)
      firstName: firstName || userRecord?.name?.split(' ')[0] || '',
      lastName: lastName || userRecord?.name?.split(' ').slice(1).join(' ') || '',
      email: session.user.email!,
      phone: phone || userRecord?.phone || '',
      
      // Location (both formats for compatibility)
      preferredCity: city,
      preferredState: state,
      city: city,                    // API compatibility
      state: state,                  // API compatibility
      searchRadius: 25,
      
      // Budget constraints
      maxMonthlyPayment: Number(maxMonthlyPayment),
      maxDownPayment: Number(maxDownPayment),
      
      // Communication preferences
      languages: ['English'],
      emailNotifications: true,
      smsNotifications: true,
      
      // System fields
      profileComplete: true,
      isActive: true,
      
      // Property interaction arrays
      matchedPropertyIds: [],
      likedPropertyIds: [],
      passedPropertyIds: [],
      
      // Lead selling fields
      isAvailableForPurchase: true,
      leadPrice: 1,
      
      // Activity tracking
      lastActiveAt: serverTimestamp(),
      
      // Metadata
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };


    // Find existing profile or create new one
    const existingQuery = query(
      collection(db, 'buyerProfiles'),
      where('userId', '==', session.user.id)
    );
    const existing = await getDocs(existingQuery);

    let buyerId: string;

    if (existing.empty) {
      // Create new profile
      buyerId = `buyer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(db, 'buyerProfiles', buyerId), {
        ...profileData,
        id: buyerId
      });
    } else {
      // Update existing profile
      buyerId = existing.docs[0].id;
      await updateDoc(doc(db, 'buyerProfiles', buyerId), profileData);
    }

    // Lead selling fields are now part of the main profile - no separate buyerLinks needed

    // Sync buyer to GoHighLevel (async, don't block response)
    const isNewProfile = existing.empty;
    if (isNewProfile) {
      // Only sync new buyers to avoid overwhelming GoHighLevel with updates
      syncBuyerToGHL({
        id: buyerId,
        userId: session.user.id,
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email,
        phone: profileData.phone,
        city: profileData.city,
        state: profileData.state,
        maxMonthlyPayment: profileData.maxMonthlyPayment,
        maxDownPayment: profileData.maxDownPayment,
        searchRadius: profileData.searchRadius,
        languages: profileData.languages
      }).then(result => {
        if (result.success) {
          logInfo('Buyer synced to GoHighLevel', {
            action: 'buyer_ghl_sync',
            metadata: { buyerId, contactId: result.contactId }
          });
        } else {
          logWarn('Failed to sync buyer to GoHighLevel', {
            action: 'buyer_ghl_sync_failed',
            metadata: { buyerId, error: result.error }
          });
        }
      }).catch(error => {
        logWarn('Error syncing buyer to GoHighLevel', {
          action: 'buyer_ghl_sync_error',
          metadata: { buyerId, error: error.message }
        });
      });
    }

    return createSuccessResponse({
      buyerId,
      message: 'Profile saved successfully'
    });

  } catch (error) {
    logError('POST /api/buyer/profile', error, {
      userId: session.user.id,
      city: body.city,
      state: body.state
    });
    return ErrorResponses.databaseError('Failed to save profile', error);
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    },
  });
}